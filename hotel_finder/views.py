import json
from django.http import JsonResponse
from django.shortcuts import render
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.views.decorators.csrf import csrf_exempt

test_hotels = [{'hotel_name': 'Best Western Red Coach Inn', 'room_type': 'STANDARD_ROOM', 'price': 115, 'location': {'latitude': 37.78343, 'longitude': -122.41951}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=Best+Western+Red+Coach+Inn', 'currency': 'USD'}, {'hotel_name': 'San Francisco Proper a Member of Design Hotels', 'room_type': 'STANDARD_ROOM', 'price': 241, 'location': {'latitude': 37.78088, 'longitude': -122.41268}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=San+Francisco+Proper+a+Member+of+Design+Hotels', 'currency': 'USD'}, {'hotel_name': 'SF Central Hotel', 'room_type': 'STANDARD_ROOM', 'price': 95, 'location': {'latitude': 37.77223, 'longitude': -122.42444}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=SF+Central+Hotel', 'currency': 'USD'}, {'hotel_name': 'Signature San Francisco', 'room_type': 'STANDARD_ROOM', 'price': 135, 'location': {'latitude': 37.77735, 'longitude': -122.4082}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=Signature+San+Francisco', 'currency': 'USD'}, {'hotel_name': 'Rodeway Inn Civic Center', 'room_type': 'STANDARD_ROOM', 'price': 74, 'location': {'latitude': 37.78286, 'longitude': -122.42196}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=Rodeway+Inn+Civic+Center', 'currency': 'USD'}, {'hotel_name': 'SoMa House Hotel', 'room_type': 'SUPERIOR_ROOM', 'price': 120, 'location': {'latitude': 37.77879, 'longitude': -122.41007}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=SoMa+House+Hotel', 'currency': 'USD'}, {'hotel_name': 'Hotel Garrett', 'room_type': 'SUPERIOR_ROOM', 'price': 92, 'location': {'latitude': 37.77886, 'longitude': -122.411}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=Hotel+Garrett', 'currency': 'USD'}, {'hotel_name': 'CIVIC CENTER MOTOR INN', 'room_type': 'STANDARD_ROOM', 'price': 142, 'location': {'latitude': 37.77267, 'longitude': -122.41087}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=CIVIC+CENTER+MOTOR+INN', 'currency': 'USD'}, {'hotel_name': 'Hotel Fiona', 'room_type': 'DELUXE_ROOM', 'price': 119, 'location': {'latitude': 37.77865, 'longitude': -122.41041}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=Hotel+Fiona', 'currency': 'USD'}, {'hotel_name': 'YOTEL San Francisco', 'room_type': 'STANDARD_ROOM', 'price': 163, 'location': {'latitude': 37.78034, 'longitude': -122.41203}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=YOTEL+San+Francisco', 'currency': 'USD'}, {'hotel_name': 'San Francisco Inn', 'room_type': 'STANDARD_ROOM', 'price': 136, 'location': {'latitude': 37.77276, 'longitude': -122.41038}, 'booking_link': 'https://www.booking.com/searchresults.html?ss=San+Francisco+Inn', 'currency': 'USD'}]
user_location = {}

def display_hotel_map(request):
    # Render the page without hotel data initially
    context = {
        'hotels': json.dumps([]),  # Empty list
        'no_hotels_available': False  # Default to no hotels available
    }
    return render(request, 'main.html', context)


@csrf_exempt
@csrf_exempt
def fetch_hotels(request):
    available_hotels = []  # Clear available hotels
    
    if request.method == 'POST':
        # Get user location from the session
        user_location = request.session.get('user_location', {})
        if not user_location:
            return JsonResponse({'error': 'User location not set'}, status=400)
        
        # Parse the request body to get the adults value
        try:
            body = json.loads(request.body)
            adults = body.get('adults', 1)
            print(adults)  # Default to 1 if not provided
        except json.JSONDecodeError:
            print("Error parsing request body")
            adults = 1  # Default to 1 adult

        print("Number of adults:", adults)

        # Example: Use adults in the API call
        latitude = 37.7749  # Use session-stored latitude
        longitude = -122.4194  # Use session-stored longitude

        # Get access token
        # access_token = get_access_token()
        # if not access_token:
        #     return JsonResponse({'error': 'Unable to obtain access token'}, status=500)
        available_hotels = test_hotels
        available_hotels = calculate_price_status(available_hotels)
        # Fetch hotels by geolocation
        # hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=1)
        # if hotel_ids:
        #     check_in_date = datetime.now().strftime('%Y-%m-%d')
        #     check_out_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        #     available_hotels = check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token, adults=adults)
        #     return JsonResponse({'hotels': available_hotels})
        return JsonResponse({'hotels': available_hotels})
        return JsonResponse({'hotels': []})
    return JsonResponse({'error': 'Invalid request method'}, status=405)



  # Store user location globally (or use session for user-specific data)

from django.views.decorators.csrf import csrf_exempt

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
        print('Access token:', access_token)
        return access_token
    else:
        print(f"Failed to get access token. Status Code: {response.status_code}")
        print(response.json())
        return None

def get_hotels_by_geolocation(access_token, latitude, longitude, radius=1):
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

def check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token, adults=1):
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
                print(f"Processing hotel: {hotel_name}")
               
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
                            'currency':currency
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
