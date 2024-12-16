import json
from django.http import JsonResponse
from django.shortcuts import render
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed\

user_location = {}

# hotels=[{"hotel_name": "JEU DE PAUME", "room_type": "SUPERIOR_ROOM", "price": "372.13"}, {"hotel_name": "Citadines Les Halles Paris - Europe", "room_type": "DELUXE_ROOM", "price": "358.48"}, {"hotel_name": "9CONFIDENTIEL", "room_type": "SUPERIOR_ROOM", "price": "483.33"}, {"hotel_name": "Le Grand Mazarin", "room_type": "STANDARD_ROOM", "price": "770.73"}, {"hotel_name": "HIGHSTAY Louvre Rivoli Area", "room_type": "STANDARD_ROOM", "price": "681.50"}, {"hotel_name": "Hotel Bourg Tibourg", "room_type": "STANDARD_ROOM", "price": "605.00"}, {"hotel_name": "Novotel Paris Les Halles", "room_type": "SUPERIOR_ROOM", "price": "483.13"}, {"hotel_name": "Hotel Britannique", "room_type": "STANDARD_ROOM", "price": "465.20"}, {"hotel_name": "Hotel Des Ducs D Anjou", "room_type": "STANDARD_ROOM", "price": "304.00"}, {"hotel_name": "Hotel Duo", "room_type": "STANDARD_ROOM", "price": "252.13"}, {"hotel_name": "LE TEMPLE DE JEANNE", "room_type": "STANDARD_ROOM", "price": "510.20"}, {"hotel_name": "HIGHSTAY Arts et Metiers Le Marais Area", "room_type": "STANDARD_ROOM", "price": "913.40"}, {"hotel_name": "Grand Hotel Malher", "room_type": "SUPERIOR_ROOM", "price": "547.56"}, {"hotel_name": "Maison Colbert Member of Melia Collection", "room_type": "STANDARD_ROOM", "price": "779.00"}, {"hotel_name": "Hotel Dandy", "room_type": "SUPERIOR_ROOM", "price": "376.13"}, {"hotel_name": "Hotel Handsome", "room_type": "STANDARD_ROOM", "price": "288.20"}, {"hotel_name": "Snob Hotel", "room_type": "SUPERIOR_ROOM", "price": "411.13"}]
def display_hotel_map(request):
    access_token = get_access_token()
    if not access_token:
        return render(request, 'error.html', {'message': 'Unable to obtain access token'})

    # Retrieve location from the session
    user_location = request.session.get('user_location', {})
    print("User location from session:", user_location)

    # Use user's location if available; otherwise, fallback to default
    latitude = user_location.get('latitude', 48.8566)  # Default to Paris
    longitude = user_location.get('longitude', 2.3522)  # Default to Paris
    print("P")
    print("Latitude:", latitude)
    print("Longitude:", longitude)

    context = {}

    hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=1)

    if hotel_ids:
        check_in_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        check_out_date = (datetime.now() + timedelta(days=8)).strftime('%Y-%m-%d')
        available_hotels = check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token)

        if available_hotels:
            context = {
                'hotels': json.dumps(available_hotels), # Convert to JSON string
                'no_hotels_available': False 
            }
            
        else:
            print("No hotels available.")
            context = {
        'no_hotels_available': True,
        'hotels': json.dumps([])  # Empty list
    }
            
    else:
        print("No hotels found.")
        context = {
        'no_hotels_available': True,
        'hotels': json.dumps([])  # Empty list
    }
    return render(request, 'main.html', context)



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
                print(f"Location: Latitude={latitude}, Longitude={longitude}")
                
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


