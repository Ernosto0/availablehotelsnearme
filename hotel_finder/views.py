import json
import logging
import random
from django.http import JsonResponse # type: ignore
from django.shortcuts import render # type: ignore
import requests # type: ignore
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.views.decorators.csrf import csrf_exempt # type: ignore
from hotel_finder.tests import test_hotels
logger = logging.getLogger('hotel_search')



user_location = {}

def display_hotel_map(request):
    # Render the page without hotel data initially
    context = {
        'hotels': json.dumps([]),  # Empty list
        'no_hotels_available': False  # Default to no hotels available
    }
    return render(request, 'main.html', context)




@csrf_exempt
def fetch_hotels(request):
    available_hotels = []  # Clear available hotels
    
    if request.method == 'POST':
        # Get user location from the session
        user_location = request.session.get('user_location', {})
        if not user_location:
            logging.warning('User location not set')
            return JsonResponse({'error': 'User location not set'}, status=400)
        
        # Parse the request body to get the adults and km value
        try:
            body = json.loads(request.body)
            adults = body.get('adults', 1)
            km = body.get('km', 1)
            check_in = body.get("checkInInput")
            check_out = body.get("checkOutInput")
            price_levels = body.get("checkboxes", [])
        except json.JSONDecodeError:
            logging.error('Error parsing request body')
            adults = 1  # Default to 1 adult
            km = 1  # Default to 1 km
            check_in = None
            check_out = None
            price_levels = []
        print(f"Check-in: {check_in}, Check-out: {check_out}, Adults: {adults}, Radius: {km}km, Price Levels: {price_levels}")
        
        latitude = 37.7749  # Use session-stored latitude
        longitude = -122.4194  # Use session-stored longitude

        global search_id
        search_id = createSearchId()

        logger.info(f"User searching hotels: Location=({latitude}, {longitude}), Adults={adults}, Radius={km}km, Search ID={search_id.get("id")}, Create Time={search_id.get('time')}")

        # Get access token
        access_token = get_access_token()
        if not access_token:
            logging.error('Failed to obtain access token')
            return JsonResponse({'error': 'Unable to obtain access token'}, status=500)
        


        available_hotels = test_hotels
        
        available_hotels = calculate_price_status(available_hotels)
        
        # Fetch hotels by geolocation
        # hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=km)

        available_hotels = calculate_price_status(available_hotels)

        return JsonResponse({'hotels': available_hotels})

        # if hotel_ids:
        #     
        #     # available_hotels = check_hotel_availability(hotel_ids, check_in, check_out, access_token, adults=adults)

            
            
        #     # Calculate price status for each hotel
        #     

        #     logger.info(f"Hotels found: {len(available_hotels)} Search ID={search_id}")
        #     for hotel in available_hotels[:5]:  # Log only first 5 to avoid clutter
        #         logger.debug(f"Hotel: {hotel['hotel_name']} | Price: {hotel.get('price')} ")


        #     return JsonResponse({'hotels': available_hotels})
        # else:
            # logger.warning('No hotels found')
            # return JsonResponse({'hotels': []})
    return JsonResponse({'error': 'Invalid request method'}, status=405)



# Store user location globally (or use session for user-specific data)

@csrf_exempt
def set_user_location(request):
    print('Setting user location...')
    if request.method == 'POST':
        data = json.loads(request.body)
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        print("Latitude:", latitude)
        print("Longitude:", longitude)
        if latitude and longitude:
            request.session['user_location'] = {'latitude': latitude, 'longitude': longitude}
            return JsonResponse({'message': 'Location received successfully'})
        return JsonResponse({'error': 'Invalid data'}, status=400)




def get_access_token():
    
    client_id = '3wcQWRrX2lgSRESxG5lbfVebTQbOPfZj'
    client_secret = 'Xjzpxk6nNJKX4ymL'
    url = 'https://api.amadeus.com/v1/security/oauth2/token'  

    data = {
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret,
    }

    response = requests.post(url, data=data)
    if response.status_code == 200:
        access_token = response.json().get('access_token')
        return access_token
    
    else:
        logger.error(f"Failed to get access token. Status Code: {response.status_code}")
        logger.infor(response.json())
        return None

def get_hotels_by_geolocation(access_token, latitude, longitude, radius):
    print('Fetching hotels by geolocation...')
    url = "https://api.amadeus.com/v1/reference-data/locations/hotels/by-geocode"  # Test URL

    headers = {'Authorization': f'Bearer {access_token}'}
    params = {
        'latitude': latitude,
        'longitude': longitude,
        'radius': radius,  # Search within 1 km
        'radiusUnit': 'KM'
    }

    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        hotels = response.json().get('data', [])
        # Limit results to the first 30 hotels
        limited_hotels = hotels[:100]  # Limit to 30 hotels
        hotel_ids = [hotel['hotelId'] for hotel in limited_hotels]
        print(f"Found {len(hotel_ids)} hotels near the location ({latitude}, {longitude}).")
        return hotel_ids
    else:
        print(f"Failed to get hotel data. Status Code: {response.status_code}")
        print(response.json())
        return []
    


def chunk_list(lst, chunk_size,):
    """Helper function to split a list into chunks."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token, adults):
    print('Checking hotel availability...')
    url = "https://api.amadeus.com/v3/shopping/hotel-offers"
    headers = {'Authorization': f'Bearer {access_token}'}
    available_hotels = []
    # currency = get_user_currency()

    currency = 'USD' # Hardcoded currency for now. Change to user's currency then final deployment
    print("searching for", adults, "adults")
    print(check_in_date, check_out_date)
    # Split hotel_ids into chunks of 20
    hotel_chunks = list(chunk_list(hotel_ids, 20))

    def fetch_availability_for_chunk(hotel_batch):
        """Helper function to fetch availability for a batch of hotels."""
        params = {
            'hotelIds': ','.join(hotel_batch),
            'checkInDate': check_in_date,
            'checkOutDate': check_out_date,
            'adults': adults,
            'currency': currency, 
        }

        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            hotel_offers = response.json().get('data', [])
            for hotel in hotel_offers:
                hotel_data = hotel.get('hotel', {})
                hotel_name = hotel_data.get('name', 'Unknown Hotel')
                latitude = hotel_data.get('latitude', None)
                longitude = hotel_data.get('longitude', None)
                
                # Debug print for location
                
                logger.debug(f"Processing hotel: {hotel_name} | Location: ({latitude}, {longitude})")

                #booking links
                booking_link = generate_booking_com_link(hotel_name)
                offers = hotel.get('offers', [])
                
                if offers:
                    for offer in offers:
                        room_type = offer.get('room', {}).get('typeEstimated', {}).get('category', 'Unknown room type')
                        price = int(float(offer.get('price', {}).get('total', '0')))
                        available_hotels.append({
                            'hotel_name': hotel_name,
                            'room_type': room_type,
                            'price': price,
                            'location': {
                                'latitude': latitude,
                                'longitude': longitude
                            },
                            'booking_link': booking_link,
                            'currency':currency,
                            'hotel_id': hotel.get('hotel', {}).get('hotelId')
                        })
        else:
            print(f"Failed to check availability. Status Code: {response.status_code}")
        print(f"Processed {len(hotel_batch)} hotels.")
        print(available_hotels)
        return available_hotels  # Return available hotels for this batch


    # Use ThreadPoolExecutor to parallelize requests
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_chunk = {executor.submit(fetch_availability_for_chunk, chunk): chunk for chunk in hotel_chunks}

        for future in as_completed(future_to_chunk):
            try:
                result = future.result()
                available_hotels.extend(result)  # Append available hotels from each future
            except Exception as exc:
                print(f"Generated an exception: {exc}")

    # Remove duplicates by hotel_name
    unique_hotels = {hotel['hotel_name']: hotel for hotel in available_hotels}.values()

    return list(unique_hotels)

def generate_booking_com_link(hotel_name):
    """
    Generate a Booking.com search link for a specific hotel.
    """
    base_url = "https://www.booking.com/searchresults.html"
    params = {
        "ss": hotel_name.replace(" ", "+"),  # Replace spaces with '+' for URL compatibility
    }
    query_string = "&".join(f"{key}={value}" for key, value in params.items())
    return f"{base_url}?{query_string}"

# Find user's currency by ip address
def get_user_currency():
    """
    Detect user's currency using the geoPlugin API.
    """
    try:
        # GeoPlugin API URL
        url = "http://www.geoplugin.net/json.gp"
        response = requests.get(url)

        if response.status_code == 200:
            data = response.json()
            # Extract the currency code from the response
            currency_code = data.get('geoplugin_currencyCode', 'EUR')  # Default to EUR
            print(f"Detected currency: {currency_code}")
            return currency_code
        else:
            print(f"Failed to fetch geolocation. Status: {response.status_code}")
    except Exception as e:
        print(f"Error detecting user's currency: {e}")

    # Fallback to default currency
    print("Falling back to default currency: EUR")
    return "EUR"

def calculate_price_status(hotels):
    """
    Calculate the average price and assign a color status for each hotel based on its price.
    """
    # Extract prices and calculate the average price
    prices = [hotel['price'] for hotel in hotels]
    if not prices:
        return hotels  # If no prices, return the original list

    average_price = sum(prices) / len(prices)
    print(f"Average price: {average_price}")

    # Define thresholds for green, yellow, and red
    high_threshold = average_price * 1.25  # 25% higher than average
    low_threshold = average_price * 0.75  # 25% lower than average

    # Assign color status
    for hotel in hotels:
        price = hotel['price']
        if price > high_threshold:
            hotel['status'] = 'red'
        elif price < low_threshold:
            hotel['status'] = 'green'
        else:
            hotel['status'] = 'yellow'
    
    return hotels

# Use our new logger for Google Places API logs
places_logger = logging.getLogger('google_places')

@csrf_exempt
def log_google_places(request):
    
    places_logger.info('Logging Google Places API request')
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            log_level = data.get('level', 'INFO')  # Default to INFO if not provided
            message = data.get('message', 'No message provided')

            if log_level == 'DEBUG':
                places_logger.debug("-----------------")
                places_logger.debug(f" Search ID= {search_id.get("id")}, Search time={search_id.get("time")} {message}" )
            elif log_level == 'WARNING':
                places_logger.warning(message)
            elif log_level == 'ERROR':
                places_logger.error(message)
            else:
                places_logger.info(message)  

            return JsonResponse({'status': 'logged'})
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

# Create temporary user ID for logging

def createSearchId():
    create_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    id = random.randint(1000, 9999)
    search_id = {'id': id, 'time': create_time}
    return search_id