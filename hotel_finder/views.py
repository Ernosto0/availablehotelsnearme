import json
from django.shortcuts import render
import requests
from datetime import datetime, timedelta

# Your existing functions for getting access token, hotels, etc. should be here

# Example Django view to render the map with hotel locations
def display_hotel_map(request):
    access_token = get_access_token()
    if not access_token:
        return render(request, 'error.html', {'message': 'Unable to obtain access token'})

    latitude = 48.8566
    longitude = 2.3522

    hotel_ids = get_hotels_by_geolocation(access_token, latitude, longitude, radius=1)

    if hotel_ids:
        check_in_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        check_out_date = (datetime.now() + timedelta(days=8)).strftime('%Y-%m-%d')
        available_hotels = check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token)

        if available_hotels:
        # Now pass the available hotels to the template
            context = {
                'hotels': available_hotels  # This is a Python list/dict
            }
            print('contex:', context)
            return render(request, 'main.html', context)
        else:
            return render(request, 'error.html', {'message': 'No hotels available'})
    else:
        return render(request, 'error.html', {'message': 'No hotel IDs found'})

# The 'map.html' template will contain the Google Maps API integration from above


def get_access_token():
    
    client_id = '3wcQWRrX2lgSRESxG5lbfVebTQbOPfZj'
    client_secret = 'Xjzpxk6nNJKX4ymL'
    url = 'https://api.amadeus.com/v1/security/oauth2/token'  # Test environment URL

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
        limited_hotels = hotels[:30]  # Limit to 30 hotels
        hotel_ids = [hotel['hotelId'] for hotel in limited_hotels]
        print(f"Found {len(hotel_ids)} hotels near the location ({latitude}, {longitude}).")
        return hotel_ids
    else:
        print(f"Failed to get hotel data. Status Code: {response.status_code}")
        print(response.json())
        return []
    

def check_hotel_availability(hotel_ids, check_in_date, check_out_date, access_token):
    print('Checking hotel availability...')
    url = "https://api.amadeus.com/v3/shopping/hotel-offers"  # Test URL
    headers = {'Authorization': f'Bearer {access_token}'}

    valid_hotel_ids = hotel_ids.copy()  # Copy hotel IDs to filter invalid ones

    available_hotels = []

    for i in range(0, len(hotel_ids), 20):  # Process hotels in batches of 20
        hotel_batch = hotel_ids[i:i + 20]
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
                    print(f"\n{hotel_name} has availability.")
                    for offer in offers:
                        room_type = offer.get('room', {}).get('typeEstimated', {}).get('category', 'Unknown room type')
                        price = offer.get('price', {}).get('total', 'Unknown price')
                        available_hotels.append({
                            'hotel_name': hotel_name,
                            'room_type': room_type,
                            'price': price
                        })
                else:
                    print(f"\n{hotel_name} has no available offers.")
        else:
            print(f"Failed to check availability. Status Code: {response.status_code}")
            errors = response.json().get('errors', [])
            for error in errors:
                error_code = error.get('code')
                error_detail = error.get('detail')
                error_hotel_ids = error.get('source', {}).get('parameter', '').replace('hotelIds=', '').split(',')
                print(f"Error: {error_detail} (Hotel IDs: {error_hotel_ids})")

                # Remove invalid hotel IDs based on the error type
                if error_code == 1257:  # Invalid property code
                    valid_hotel_ids = [hotel_id for hotel_id in valid_hotel_ids if hotel_id not in error_hotel_ids]
                elif error_code in [3664, 3289]:  # No rooms available or rate not available
                    valid_hotel_ids = [hotel_id for hotel_id in valid_hotel_ids if hotel_id not in error_hotel_ids]

    # Retry with valid hotel IDs only
    if valid_hotel_ids != hotel_ids:
        print(f"Retrying with valid hotel IDs: {valid_hotel_ids}")
        check_hotel_availability(valid_hotel_ids, check_in_date, check_out_date, access_token)
    return available_hotels