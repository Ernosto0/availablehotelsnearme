import json
from django.shortcuts import render
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed\

from django.http import JsonResponse, HttpResponse

def home(request):
    return HttpResponse("Welcome to Hotel Hunter!")

def display_hotel_map(request):
    # Render the initial HTML for the map page
    if request.method == 'GET' and not request.GET.get('latitude') and not request.GET.get('longitude'):
        return render(request, 'main.html')

    # Handle API request with latitude and longitude
    access_token = get_access_token()
    if not access_token:
        return JsonResponse({'error': 'Unable to obtain access token'}, status=500)

    latitude = request.GET.get('latitude')
    longitude = request.GET.get('longitude')

    if not latitude or not longitude:
        return JsonResponse({'error': 'Latitude and longitude are required'}, status=400)

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return JsonResponse({'error': 'Invalid latitude or longitude values'}, status=400)

    # Fetch hotels data
    hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=1)

    if hotel_ids:
        check_in_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        check_out_date = (datetime.now() + timedelta(days=8)).strftime('%Y-%m-%d')
        available_hotels = check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token)

        if available_hotels:
            return render(request, 'main.html', {'hotels': available_hotels})

        else:
            return JsonResponse({'error': 'No hotels available'}, status=404)

    return JsonResponse({'error': 'No hotel IDs found'}, status=404)




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
                hotel_name = hotel.get('hotel', {}).get('name', 'Unknown Hotel')
                offers = hotel.get('offers', [])
                if offers:
                    for offer in offers:
                        room_type = offer.get('room', {}).get('typeEstimated', {}).get('category', 'Unknown room type')
                        price = offer.get('price', {}).get('total', 'Unknown price')
                        available_hotels.append({
                            'hotel_name': hotel_name,
                            'room_type': room_type,
                            'price': price
                        })
        else:
            print(f"Failed to check availability. Status Code: {response.status_code}")
        print(len(available_hotels), 'hotels available.')
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
