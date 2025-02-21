// Initialize the map with global hotel data


let markers = []; // Array to keep track of all markers

// Initialize the map with Leaflet
let userCircle = null;  // Declare circle globally to update it later



let markerClusterGroup = null; // Global cluster group

function initMap(lat = 48.8566, lng = 2.3522) {
    console.log('Initializing map with MapTiler tiles:', { lat, lng });
    
    const mapElement = document.getElementById("map");

    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }

    map = L.map(mapElement, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false 
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer(`https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=X7HwJPbLsgS0Hv3KpPyj`, {
        attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> contributors',
        maxZoom: 18,
    }).addTo(map);

    // Initialize the cluster group with adjusted settings
    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 80,
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: false,
        removeOutsideVisibleBounds: false,
        
        iconCreateFunction: function (cluster) {
            return L.divIcon({
                html: '', // ❌ No number text inside the cluster
                className: 'custom-cluster-icon',
                iconSize: L.point(40, 40) // Adjust size if needed
            });
        }
    });
    

    // Add the cluster group to the map
    map.addLayer(markerClusterGroup);

   

    // Add user's location marker
    createUserMarker(lat, lng);

    // Add radius circle
    addRadiusCircle(lat, lng, 2 * 1000);

    updateWeatherWidget(lat, lng);


    // Handle map text visibility
    const mapText = document.getElementById('map-text');
      if (mapText) {
        mapText.style.display = 'none';
      }

}



// Function to add/update circle around user's location
function addRadiusCircle(lat, lng, radius) {
    if (userCircle) {
        userCircle.setLatLng([lat, lng]);  // Update circle position
        userCircle.setRadius(radius);  // Update radius in meters
    } else {
        userCircle = L.circle([lat, lng], {
            color: 'blue',
            fillColor: '#add8e6',
            fillOpacity: 0.3,
            radius: radius // Radius in meters
        }).addTo(map);
    }
}

let circleCleared = false;  // Track if the circle has been cleared

function clearRadiusCircle() {
    if (userCircle) {
        map.removeLayer(userCircle);
        userCircle = null;
        circleCleared = true;  // Mark that the circle was cleared
    }
}

function updateHotelsOnMap(hotels) {

    console.log('Updating hotels on map:', hotels);

    if (!markerClusterGroup) {
        console.error('Marker cluster group is not initialized.');
        return;
    }

    clearMarkers(); // Clear old markers
    clearRadiusCircle();

    const markersToAdd = []; // Store markers before adding

    hotels.forEach(hotel => {
        const { hotel_name, price, location, booking_link, currency, status } = hotel;
        window.hotelCurrency = currency;

        if (location && location.latitude && location.longitude) {
            const marker = createCustomMarker(
                location.latitude,
                location.longitude,
                hotel_name,
                price,
                booking_link,
                status
            );
            markersToAdd.push(marker); // Collect markers
        } else {
            console.error(`Invalid location data for hotel: ${hotel_name}`);
        }
    });

    markerClusterGroup.addLayers(markersToAdd); // Add markers in bulk (better performance)
    map.addLayer(markerClusterGroup); // Ensure the cluster is added
    if (map.getZoom() < 14) {
        map.setZoom(16);
    }
}



// Clear all existing markers from the map
function clearMarkers() {
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers(); // Remove all clustered markers
    }
}

let highlightedMarker = null; // Global variable to store the currently highlighted marker


// Create a custom marker using OverlayView
function createCustomMarker(lat, lng, hotelName, hotelPrice, booking_link, status, isCheapest = false) {
    const currency = window.hotelCurrency;

    // Create marker icon with custom HTML
    const iconHtml = `
        <div class="custom-marker ${status}-marker ${isCheapest ? 'cheapest-marker' : ''}">
            <h4>${hotelPrice} ${currency}</h4>
            ${isCheapest ? '<div class="marker-tooltip">This is the cheapest hotel!</div>' : ''}
        </div>
    `;

    // Define a custom divIcon for the marker
    const customIcon = L.divIcon({
        className: 'custom-marker-container',
        html: iconHtml,
        iconSize: [85, 35], // Size of the custom marker (adjust as needed)
        iconAnchor: [40, 30], // Anchor point of the marker (centered)
    });

    // Create the marker and add it to the map
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    // Add a click event listener to the marker
    marker.on('click', () => {
        console.log('Clicked on hotel:', hotelName);
        
        document.getElementById('search-panel').style.display = 'none';
        if (highlightedMarker) {
            const prevElement = highlightedMarker.getElement();
            if (prevElement) prevElement.classList.remove('highlighted-marker');
        }

        // Add highlight to the clicked marker
        const markerElement = marker.getElement();
        if (markerElement) {
            markerElement.classList.add('highlighted-marker');
            highlightedMarker = marker; // Update the reference
        }

        // Fetch hotel details and display in the info panel
        fetchHotelDetails({ lat, lng }, hotelName, hotelPrice, lat, lng)
            .then(data => {
                const { photos, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber,  reviewData } = data;
                updatePhoneNumber(hotelPhoneNumber);
                showInfoPanel(
                    hotelName, hotelPrice, photos, hotelRating, userRatingsTotal,
                    hotelWebsite, hotelPhoneNumber, lat, lng, reviewData, booking_link
                );
            })
            .catch(error => {
                console.error('Error fetching place details:', error);
            });
    });
   

    document.getElementById('close-btn').addEventListener('click', () => {
        // Close the info panel
        document.getElementById('info-panel').classList.remove('activate');
        document.getElementById('search-panel').style.display = 'block';
        
        // Remove highlight from the currently highlighted marker
        if (highlightedMarker) {
            highlightedMarker.classList.remove('highlighted-marker');
            highlightedMarker = null; // Reset the highlighted marker
        } });
    return marker; // Return the created marker
}




function createUserMarker(lat, lng) {
    if (!lat || !lng) {
        console.error('Invalid user location data');
        return;
    }

    const userMarker = L.marker([lat, lng], {
        title: "You are here",
        icon: L.divIcon({
            className: 'user-marker',
            html: `
                <div style="
                    background-color: #4285F4;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid #ffffff;
                    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);">
                </div>
            `
        })
    }).addTo(map);

   
}



// Object to cache hotel data temporarily
const hotelCache = {};

function fetchHotelDetails(location, hotelName, hotelPrice, lat, lng) {
    return new Promise((resolve, reject) => {
        const cacheKey = `${lat},${lng},${hotelName}`;

        if (hotelCache[cacheKey]) {
            logToDjango('INFO', `Using cached data for: ${hotelName}`);
            resolve(hotelCache[cacheKey]);
            return;
        }

        logToDjango('INFO', `Fetching Places API for: ${hotelName} at (${lat}, ${lng})`);
        console.log(`Fetching new data from Places API for: ${hotelName} at (${lat}, ${lng})`);

        const service = new google.maps.places.PlacesService(document.createElement('div'));
        const request = {
            query: hotelName,
            locationBias: { lat: lat, lng: lng },
            fields: ['place_id']
        };

        service.findPlaceFromQuery(request, function (results, status) {
            logToDjango('DEBUG', `Places API response for ${hotelName}: ${JSON.stringify(results)} | Status: ${status}`);
            console.log('Google Places API Details Response:', 'Status:', status);

            if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
                const placeId = results[0].place_id;
                logToDjango('INFO', `Found Place ID for ${hotelName}: ${placeId}`);

                getPlaceDetails(service, placeId, hotelName, hotelPrice)
                    .then(data => {
                        hotelCache[cacheKey] = { ...data, lat: lat, lng: lng };
                        resolve(hotelCache[cacheKey]);
                    })
                    .catch(error => {
                        logToDjango('ERROR', `Error fetching place details: ${error}`);
                        reject(error);
                    });
            } else {
                logToDjango('WARNING', `Places search failed for ${hotelName}: ${status}`);
                reject(`Places search was not successful for ${hotelName}: ${status}`);
            }
        });
    });
}


// Function to get place details using place_id with a promise
function getPlaceDetails(service, placeId, hotelName, hotelPrice) {
    console.log('Fetching details for:', hotelName, placeId);
    
    return new Promise((resolve, reject) => {
        const request = {
            placeId: placeId,
            fields: [
                'name', 'rating', 'user_ratings_total', 'photos', 
                'formatted_phone_number', 'opening_hours', 'website',
                'price_level', 'reviews'
            ]
        };

        console.log('Details Request for Place ID:', placeId, request);

        service.getDetails(request, function (place, status) {
            console.log('Google Places API Details Response:', place, 'Status:', status);

            if (status === google.maps.places.PlacesServiceStatus.OK) {
                const hotelRating = place.rating ?? 'N/A';
                const userRatingsTotal = place.user_ratings_total ?? 'No reviews';
                const hotelWebsite = place.website || '#';
                const hotelPhoneNumber = place.formatted_phone_number || 'No phone number available';
                const priceLevel = place.price_level ?? 'No price level available';
                
                // Handle photos with fallback image
                const photos = place.photos?.length 
                    ? place.photos.map(photo => photo.getUrl({ maxWidth: 300, maxHeight: 200 })) 
                    : ['https://via.placeholder.com/300x200'];

                // Retrieve and limit reviews
                const reviewData  = place.reviews?.slice(0, 5).map(review => ({
                    author_name: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    time: review.time
                })) || [];

                console.log('Retrieved details:', { hotelRating, userRatingsTotal, priceLevel, reviewData });
                logToDjango('Retrieved details:', { hotelRating, userRatingsTotal, priceLevel, reviewData });

                resolve({
                    photos,
                    hotelRating,
                    userRatingsTotal,
                    hotelWebsite,
                    hotelPhoneNumber,
                    priceLevel,
                    reviewData 
                });
            } else {
                reject(`Place details request failed for ${hotelName}: ${status}`);
            }
        });
    });
}

// Function to log messages to Django backend
function logToDjango(level, message) {
    fetch('/log_google_places/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level, message })
    }).catch(error => console.error('Failed to send log:', error));
}



let currentPhotoIndex = 0;
let photoUrls = [];

let currentReviewIndex = 0;
let reviews = []; // This will hold all the reviews

// Function to show the info panel with hotel details, photos, and reviews
function showInfoPanel(
    hotelName,
    hotelPrice,
    photos,  // Array of photos
    hotelRating,
    userRatingsTotal,
    hotelWebsite,
    hotelPhoneNumber,
    lat,
    lng,
    reviewData,
    booking_link 
) {
    console.log(booking_link)
    reviews = reviewData;  // Store the reviews array globally
    currentReviewIndex = 0;  // Reset review navigation

    currency = window.hotelCurrency

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
    document.getElementById('hotel-price').innerText = `Price: ${hotelPrice} ${currency}`;
    document.getElementById('hotel-rating').innerText = `Rating: ${hotelRating} (${userRatingsTotal} reviews)`;
    document.getElementById('hotel-phone').innerText = `Phone: ${hotelPhoneNumber}`;
    document.getElementById('hotel-website').href = hotelWebsite;

    document.getElementById("info-panel").classList.add("activate");

    const reviewsContainer = document.getElementById('hotel-reviews');
    reviewsContainer.innerHTML = '';  // Clear previous reviews

    if (reviews && Array.isArray(reviews) && reviews.length > 0) {
        reviews.forEach((review, index) => {
            try {
                if (!review || typeof review !== "object") {
                    console.warn(`Invalid review at index ${index}:`, review);
                    return;
                }
    
                const reviewElement = document.createElement('div');
                reviewElement.classList.add('review');
    
                const authorName = review?.author_name || 'Anonymous'; // Use optional chaining
                const rating = review?.rating !== undefined ? generateStars(review.rating) : 'No rating';
                const text = review?.text || 'No review text available';
    
                reviewElement.innerHTML = `
                    <strong>${authorName}</strong> - Rating: ${rating}<br>
                    <p>${text}</p>
                `;
                reviewsContainer.appendChild(reviewElement);
            } catch (error) {
                console.error(`Error processing review at index ${index}:`, error);
            }
        });
    } else {
        console.warn('No reviews available or invalid reviews array:', reviews);
        reviewsContainer.innerHTML = '<p>No reviews available.</p>';
    }
    
    
    
    displayReview(currentReviewIndex);


    toggleReviewButtons();

    console.log(window.userLocation)
    console.log(lat, lng)
    if (window.userLocation) {
        const userLat = window.userLocation.latitude;
        const userLng = window.userLocation.longitude;
        const distance = calculateDistance(userLat, userLng, lat, lng).toFixed(2); // Get distance in km
        console.log('Distance:', distance, 'km');

        document.getElementById('hotel-distance').innerText = `Distance: ${distance} km`;
    } else {
        console.warn('User location is not available for distance calculation.');
    }

     // Set up the Get Directions button with dynamic coordinates
    const directionsBtn = document.getElementById('directions-btn');
    if (directionsBtn) {
         directionsBtn.onclick = function() {
             const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
             window.open(directionsUrl, '_blank');
         };
     }


     document.getElementById('next-review').onclick = () => {
        if (currentReviewIndex < reviews.length - 1) {
            currentReviewIndex++;
            displayReview(currentReviewIndex);
            toggleReviewButtons();
        }
    };

    document.getElementById('prev-review').onclick = () => {
        if (currentReviewIndex > 0) {
            currentReviewIndex--;
            displayReview(currentReviewIndex);
            toggleReviewButtons();
        }
    };

    const bookingBtn = document.getElementById('book-hotel-btn');
    if (bookingBtn) {
        bookingBtn.onclick = function () {
            window.open(booking_link, '_blank');
        };
    } else {
        console.error("Element with ID 'booking-hotel-btn' does not exist in the DOM.");
    }


    // Display the info panel
    document.getElementById('info-panel').classList.add("activate");

}

// Function to generate star icons based on rating
function generateStars(rating) {
    const fullStar = '<img src="/static/images/yellow-star.png" class="star-icon">';
    const emptyStar = '<img src="/static/images/black-star.png" class="star-icon">';
    const starCount = Math.round(rating);
    let stars = '';

    // Add full stars
    for (let i = 0; i < starCount; i++) {
        stars += fullStar;
    }
    // Add empty stars to make a total of 5
    for (let i = starCount; i < 5; i++) {
        stars += emptyStar;
    }
    console.log(starCount)
    return stars; // Return the string of HTML for stars
}



function displayReview(index) {
    // Ensure reviews is an array and the index is within bounds
    if (!reviews || !Array.isArray(reviews) || index < 0 || index >= reviews.length) {
        console.error(`Invalid review index: ${index}. Unable to display review.`);
        const reviewsContainer = document.getElementById('hotel-reviews');
        reviewsContainer.innerHTML = '<p>No reviews available.</p>';  // Fallback message
        return;
    }

    const review = reviews[index];

    try {
        if (!review || typeof review !== "object") {
            console.warn(`Invalid review at index ${index}:`, review);
            throw new Error("Review is not a valid object.");
        }

        // Safely access review properties with defaults
        const authorName = review?.author_name || 'Anonymous';
        const rating = review?.rating !== undefined ? generateStars(review.rating) : 'No rating';
        const text = review?.text || 'No review text available';

        // Create the review element
        const reviewElement = document.createElement('div');
        reviewElement.classList.add('review');
        reviewElement.innerHTML = `
            <strong>${authorName}</strong> - Rating: ${rating}<br>
            <p>${text}</p>
        `;

        // Update the reviews container
        const reviewsContainer = document.getElementById('hotel-reviews');
        reviewsContainer.innerHTML = '';  // Clear previous review
        reviewsContainer.appendChild(reviewElement);  // Add the new review
    } catch (error) {
        console.error(`Error displaying review at index ${index}:`, error);

        // Show fallback message in case of error
        const reviewsContainer = document.getElementById('hotel-reviews');
        reviewsContainer.innerHTML = '<p>Unable to display review. Please try again later.</p>';
    }
}



function toggleReviewButtons() {
    // Enable/disable next/prev buttons based on the current review index
    document.getElementById('next-review').disabled = currentReviewIndex >= reviews.length - 1;
    document.getElementById('prev-review').disabled = currentReviewIndex <= 0;
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

// Calculate the distance between hotel and user in kilometers
function calculateDistance(lat1, lng1, lat2, lng2) {
    
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    const earthRadius = 6371; // Radius of Earth in kilometers

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c; // Distance in kilometers
}


function calculateCheapestHotel(hotels) {
    if (!hotels || hotels.length === 0) {
        console.error("No hotels available to calculate the cheapest.");
        return null;
    }

    let cheapestHotel = null;

    hotels.forEach(hotel => {
        // Parse the price to a number, and handle invalid/missing prices
        const price = parseFloat(hotel.price);
        if (isNaN(price)) {
            console.warn(`Skipping hotel due to invalid price: ${hotel.hotel_name}`);
            return;
        }

        // Compare the parsed price
        if (!cheapestHotel || price < parseFloat(cheapestHotel.price)) {
            cheapestHotel = { ...hotel, price }; // Store the hotel with the parsed price
        }
    });

    return cheapestHotel;
}


// Call this function when the DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM is ready');
    // Check if the user's browser supports Geolocation API
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            window.userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
        console.log('User location:', window.userLocation);

        
        loadGoogleMapsAPI(window.userLocation.latitude, window.userLocation.longitude);


        fetchUserLocation(window.userLocation.latitude, window.userLocation.longitude);

            
        }, function (error) {
            console.error('Error getting location:', error.message);
            alert('Unable to get your location. Default location will be used.');
             // Default to Paris (latitude, longitude)
        });
        
    } else {
        console.error('Geolocation is not supported by this browser.');
        alert('Geolocation is not supported by your browser.');
        // Fallback to default behavior
    }
});


function fetchUserLocation(latitude, longitude) {
    console.log('User location:', latitude, longitude);
    fetch('/set-user-location/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken() 
        },
        body: JSON.stringify({ latitude, longitude })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Location sent to backend:', data);
        })
        .catch(error => {
            console.error('Error sending location to backend:', error);
        });
}

function updateWeatherWidget(lat, lon) {
    const apiKey = 'e64e643580dd413cac1100435250302';  // Replace with your actual WeatherAPI.com key
    const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`;
    console.log('Fetching weather data from:', url);
    fetch(url)
      .then(response => response.json())
      .then(data => {
        // Get current temperature in Celsius and the weather icon
        const temperature = data.current.temp_c;
        console.log('Current temperature:', temperature);
        const iconUrl = "https:" + data.current.condition.icon;
  
        // Update the weather widget with the icon and temperature text below it
        const widget = document.getElementById('weather-widget');
        console.log('Weather widget:', widget);
        if (widget) {
          widget.innerHTML = `
            <img src="${iconUrl}" alt="Weather Icon">
            <div class="temp">${temperature}°C</div>
          `;
        }
      })
      .catch(error => console.error('Error fetching weather data:', error));
  }
  

// Load Google Maps API dynamically
let isGoogleMapsAPILoaded = false;

function loadGoogleMapsAPI(lat, lng) {
    if (isGoogleMapsAPILoaded) {
        console.log("Google Maps API already loaded.");
        console.log("Initializing map with user location in loadGoogleMapsAPI function:", { lat, lng });
        initMap(lat, lng);
        return;
    }

    if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
        console.log("Google Maps API already available.");
        console.log("Initializing map with user location in loadGoogleMapsAPI function:", { lat, lng });
        initMap(lat, lng);
        isGoogleMapsAPILoaded = true;
        return;
    }

    // Use the API key injected from Django
    const googleapiKey = typeof GOOGLE_MAPS_API_KEY !== "undefined" ? GOOGLE_MAPS_API_KEY : "";

    console.log("Google API key:", googleapiKey);
    if (!googleapiKey) {
        console.error("Google API key is missing! key",googleapiKey);
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleapiKey}&libraries=places,marker&callback=initMapCallback`;
    script.async = true;
    script.defer = true;

    document.head.appendChild(script);

    window.initMapCallback = function () {
        console.log("Google Maps API initialized via callback.");
        console.log("Initializing map with user location in initMapCallback function:", { lat, lng });
        initMap(lat, lng);
        isGoogleMapsAPILoaded = true;
    };

    console.log("Google Maps API script added.");
}



function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || '';
}


function updatePhoneNumber(hotelPhoneNumber) {
    const phoneText = document.getElementById("phone-number-text");
    const callButton = document.getElementById("call-hotel-btn");

    if (!phoneText || !callButton) {
        console.error("Error: #phone-number-text or #call-hotel-btn not found in DOM.");
        return;
    }

    if (hotelPhoneNumber) {
        phoneText.textContent = hotelPhoneNumber;
        callButton.style.display = "inline-block"; // Show the button
        callButton.onclick = function () {
            window.location.href = `tel:${hotelPhoneNumber}`;
        };
    } else {
        phoneText.textContent = "No phone number available";
        callButton.style.display = "none"; // Hide the button if no number
    }
}
