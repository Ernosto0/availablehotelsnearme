import json
from django.shortcuts import render
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed\

from django.http import JsonResponse

from django.http import JsonResponse

from django.http import JsonResponse

// Initialize the map with global hotel data


function initMap(userLatitude, userLongitude) {
    const centerLocation = { lat: userLatitude, lng: userLongitude };  // Use user's location
    console.log("User's location:", centerLocation);
    // Initialize the map
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: centerLocation,
    });

    // Show the loading spinner when starting to fetch hotels
    document.getElementById('loading-spinner').style.display = 'block';

    // Initialize the geocoder
    const geocoder = new google.maps.Geocoder(); 

    console.log("Hotels data in initMap:", window.hotels);

    // Check if hotels data is available before iterating
    if (window.hotels && Array.isArray(window.hotels)) {
        let remainingRequests = window.hotels.length;

        window.hotels.forEach(hotel => {
            geocodeHotelName(hotel.hotel_name, hotel.price, geocoder, map, () => {
                // Decrement the remaining requests
                remainingRequests--;

                // Hide the spinner once all hotels are processed
                if (remainingRequests === 0) {
                    document.getElementById('loading-spinner').style.display = 'none';
                }
            });
        });
    } else {
        console.error("Hotels data is undefined or not an array");
        document.getElementById('loading-spinner').style.display = 'none';
    }
}



// Geocode the hotel name and create a custom marker
function geocodeHotelName(hotelName, hotelPrice, geocoder, map, onComplete) {
    geocoder.geocode({ 'address': hotelName }, function(results, status) {
        if (status === 'OK') {
            const location = results[0].geometry.location;

            // Create a custom marker with hotel details
            createCustomMarker(location, hotelName, hotelPrice, map);

            // Invoke the callback after the geocoding completes
            onComplete();
        } else {
            console.log('Geocode was not successful for the following reason: ' + status);

            // Invoke the callback even if geocoding fails, so the spinner can hide
            onComplete();
        }
    });
}


// Create a custom marker using OverlayView
function createCustomMarker(location, hotelName, hotelPrice, map) {
    // Define a new custom OverlayView
    const CustomMarker = function (position, map) {
        this.position = position;
        this.map = map;
        this.div = null;
        this.setMap(map);
    };

    CustomMarker.prototype = new google.maps.OverlayView();

    CustomMarker.prototype.onAdd = function () {
        const div = document.createElement('div');
        div.className = 'custom-marker';
        div.innerHTML = `
            <h3>${hotelName}</h3>
            <p>${hotelPrice} EUR</p>
        `;

        this.div = div;

        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(div);

        // Add click event to show info panel after API response is ready
        div.addEventListener('click', debounce(() => {
            console.log('Clicked on hotel:', hotelName);

            // Fetch hotel photos and other details from Places API
            fetchHotelDetails(location, hotelName, hotelPrice)
                .then(data => {
                    const { photos, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours } = data;
                    
                    // Show the info panel with multiple photos (photo gallery)
                    showInfoPanel(hotelName, hotelPrice, photos, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours);
                })
                .catch(error => {
                    console.error('Error fetching place details:', error);
                });

        }, 300));  // Delay click handling by 300ms to debounce
    };

    CustomMarker.prototype.draw = function () {
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(this.position);

        if (position) {
            this.div.style.left = position.x - 40 + 'px'; // Adjust to center horizontally
            this.div.style.top = position.y - 60 + 'px';  // Adjust to center vertically
        }
    };

    CustomMarker.prototype.onRemove = function () {
        if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
        }
    };

    // Instantiate the custom marker
    new CustomMarker(location, map);
}


// Function to get the photo and additional details of the hotel using Places API
function fetchHotelDetails(location, hotelName, hotelPrice) {
    return new Promise((resolve, reject) => {  // Return a new promise
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        const request = {
            location: location,
            radius: 50,  // Search within a small radius around the location
            query: hotelName
        };

        // Perform a text search to get basic details and place_id
        service.textSearch(request, function(results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
                const hotel = results[0];
                const placeId = hotel.place_id;

                // Use a promise to wait for place details before displaying the info window
                getPlaceDetails(service, placeId, hotelName, hotelPrice)
                    .then(data => {
                        // Resolve the promise with the data
                        resolve(data);
                    })
                    .catch(error => {
                        reject('Error fetching place details: ' + error);
                    });
            } else {
                reject('Places search was not successful: ' + status);
            }
        });
    });
}


// Function to get place details using place_id with a promise
function getPlaceDetails(service, placeId, hotelName, hotelPrice) {
    return new Promise((resolve, reject) => {
        const request = {
            placeId: placeId,
            fields: ['name', 'rating', 'user_ratings_total', 'photos', 'formatted_phone_number', 'opening_hours', 'website']
        };

        service.getDetails(request, function (place, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                const hotelRating = place.rating !== undefined ? place.rating : 'N/A';
                const userRatingsTotal = place.user_ratings_total !== undefined ? place.user_ratings_total : 'No reviews';
                const hotelWebsite = place.website || '#';
                const hotelPhoneNumber = place.formatted_phone_number || 'No phone number available';
                const openingHours = place.opening_hours ? (place.opening_hours.isOpen() ? 'Open now' : 'Closed') : 'Hours not available';

                // Log the photos data to verify if they are fetched correctly
                console.log('Place photos:', place.photos);

                // Ensure 'photos' exists and is an array with at least one photo
                const photos = Array.isArray(place.photos) && place.photos.length > 0
                               ? place.photos.map(photo => photo.getUrl({ maxWidth: 300, maxHeight: 200 }))
                               : ['https://via.placeholder.com/300x200'];  // Use a placeholder image if no photos are available

                console.log('Processed photos URLs:', photos);  // Log the processed photo URLs

                resolve({
                    photos,
                    hotelRating,
                    userRatingsTotal,
                    hotelWebsite,
                    hotelPhoneNumber,
                    openingHours
                });
            } else {
                reject('Place details request failed: ' + status);
            }
        });
    });
}



// Function to show the info panel with hotel details
let currentPhotoIndex = 0;
let photoUrls = [];

// Function to show the info panel with hotel details and photos
function showInfoPanel(
    hotelName,
    hotelPrice,
    photos,  // Array of photos
    hotelRating,
    userRatingsTotal,
    hotelWebsite,
    hotelPhoneNumber,
    openingHours
) {
    // Store the photos in a global variable for gallery navigation
    photoUrls = photos;
    currentPhotoIndex = 0;  // Start with the first photo
    console.log(photos)
    // Check if there are photos to display
    if (photos) {
        
        document.getElementById('hotel-photo').src = photos[currentPhotoIndex];  // Display the first photo
    } else {
        document.getElementById('hotel-photo').src = 'https://via.placeholder.com/300x200';  // Fallback to placeholder
    }

    // Populate other hotel details
    document.getElementById('hotel-name').innerText = hotelName;
    document.getElementById('hotel-price').innerText = `Price: ${hotelPrice} EUR`;
    document.getElementById('hotel-rating').innerText = `Rating: ${hotelRating} (${userRatingsTotal} reviews)`;
    document.getElementById('hotel-phone').innerText = `Phone: ${hotelPhoneNumber}`;
    document.getElementById('hotel-website').href = hotelWebsite;
    document.getElementById('hotel-opening-hours').innerText = `Status: ${openingHours}`;

    // Display the info panel
    document.getElementById('info-panel').style.display = 'block';
}

// Function to go to the next photo
function nextPhoto() {
    if (photoUrls && photoUrls.length > 0) {
        currentPhotoIndex = (currentPhotoIndex + 1) % photoUrls.length;  // Loop through the photos
        document.getElementById('hotel-photo').src = photoUrls[currentPhotoIndex];
    }
}

// Function to go to the previous photo
function prevPhoto() {
    if (photoUrls && photoUrls.length > 0) {
        currentPhotoIndex = (currentPhotoIndex - 1 + photoUrls.length) % photoUrls.length;  // Loop through the photos
        document.getElementById('hotel-photo').src = photoUrls[currentPhotoIndex];
    }
}


// Call this function when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (navigator.geolocation) {
        // Attempt to get the user's location
        navigator.geolocation.getCurrentPosition(
            position => {
                const userLatitude = position.coords.latitude; // Get latitude
                const userLongitude = position.coords.longitude; // Get longitude
                
                console.log(`User's location: ${userLatitude}, ${userLongitude}`);
                
                // Send the user's location to the backend
                fetch(`/hotels/map/?latitude=${userLatitude}&longitude=${userLongitude}`, {
                    method: 'GET',
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error("Error from backend:", data.error);
                        alert("Unable to fetch hotels: " + data.error);
                        return;
                    }

                    // Set global hotels variable and initialize map
                    window.hotels = data.hotels;
                    console.log("Hotels fetched from backend:", window.hotels);

                    initMap(userLatitude, userLongitude); // Initialize map with user location
                })
                .catch(error => {
                    console.error("Error fetching hotels:", error);
                    alert("Unable to fetch hotels. Showing default location.");
                    initMap(48.8566, 2.3522); // Default to Paris
                });
            },
            error => {
                console.error("Geolocation error:", error);
                alert("Unable to retrieve your location. Showing a default location.");

                // Fallback to a default location (e.g., Paris)
                fetch(`/hotels/map/?latitude=48.8566&longitude=2.3522`, {
                    method: 'GET',
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error("Error from backend:", data.error);
                        alert("Unable to fetch hotels: " + data.error);
                        return;
                    }

                    window.hotels = data.hotels;
                    console.log("Hotels fetched from backend:", window.hotels);

                    initMap(48.8566, 2.3522); // Initialize map with default location
                })
                .catch(error => {
                    console.error("Error fetching hotels:", error);
                });
            }
        );
    } else {
        console.error("Geolocation is not supported by this browser.");
        alert("Geolocation is not supported. Showing a default location.");

        // Fallback to default location (e.g., Paris)
        fetch(`/hotels/map/?latitude=48.8566&longitude=2.3522`, {
            method: 'GET',
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Error from backend:", data.error);
                alert("Unable to fetch hotels: " + data.error);
                return;
            }

            window.hotels = data.hotels;
            console.log("Hotels fetched from backend:", window.hotels);

            initMap(48.8566, 2.3522); // Initialize map with default location
        })
        .catch(error => {
            console.error("Error fetching hotels:", error);
        });
    }
});




function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Load Google Maps API dynamically
function loadGoogleMapsAPI() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDvxJfUnj_5qojubJNy8IcGkESmG7D9dlI&libraries=places&callback=initMap`;

    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    // Set global variables to hold the user's location for the callback
    window.userLatitude = userLatitude;
    window.userLongitude = userLongitude;

    // Define the callback function dynamically
    window.initMapWithUserLocation = function () {
        initMap(userLatitude, userLongitude);
    };
}






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
    url = "https://api.amadeus.com/v1/reference-data/locations/hotels/by-geocode"  
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
        limited_hotels = hotels[:40]  # Limit to 30 hotels
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

