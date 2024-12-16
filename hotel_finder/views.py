import json
from django.http import JsonResponse
from django.shortcuts import render
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.views.decorators.csrf import csrf_exempt

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
    if request.method == 'POST':
        # Get user location from the session
        user_location = request.session.get('user_location', {})
        if not user_location:
            return JsonResponse({'error': 'User location not set'}, status=400)

        # latitude = user_location.get('latitude')
        # longitude = user_location.get('longitude')

        latitude = 37.7749
        longitude = -122.4194

        # Get access token
        access_token = get_access_token()
        if not access_token:
            return JsonResponse({'error': 'Unable to obtain access token'}, status=500)

        # Fetch hotels by geolocation
        hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=1)
        if hotel_ids:
            check_in_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
            check_out_date = (datetime.now() + timedelta(days=8)).strftime('%Y-%m-%d')
            available_hotels = check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token)
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
    


def chunk_list(lst, chunk_size):
    """Helper function to split a list into chunks."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token):
    print('Checking hotel availability...')
    url = "https://api.amadeus.com/v3/shopping/hotel-offers"
    headers = {'Authorization': f'Bearer {access_token}'}
    available_hotels = []

    # Split hotel_ids into chunks of 20
    hotel_chunks = list(chunk_list(hotel_ids, 20))

    def fetch_availability_for_chunk(hotel_batch):
        """Helper function to fetch availability for a batch of hotels."""
        params = {
            'hotelIds': ','.join(hotel_batch),
            'checkInDate': check_in_date,
            'checkOutDate': check_out_date,
            'adults': '1',
            'currency': 'EUR'
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
               
                
                offers = hotel.get('offers', [])
                if offers:
                    for offer in offers:
                        room_type = offer.get('room', {}).get('typeEstimated', {}).get('category', 'Unknown room type')
                        price = offer.get('price', {}).get('total', 'Unknown price')
                        available_hotels.append({
                            'hotel_name': hotel_name,
                            'room_type': room_type,
                            'price': price,
                            'location': {
                                'latitude': latitude,
                                'longitude': longitude
                            }
                        })
        else:
            print(f"Failed to check availability. Status Code: {response.status_code}")
        print(f"Processed {len(hotel_batch)} hotels.")
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


