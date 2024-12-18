// Initialize the map with global hotel data


function initMap(lat = 48.8566, lng = 2.3522) { // Default to Paris if lat/lng are not provided
    console.log('Initializing map with user location:', { lat, lng });

    const centerLocation = { lat, lng }; // Center the map on the user's location

    // Check if the map element exists
    const mapElement = document.getElementById("map");
    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }

    // Initialize the map
    const map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: centerLocation,
    });

    createUserMarker(centerLocation, map); // Add a marker for the user's location

    // Show the loading spinner when starting to fetch hotels
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    // Check if hotels data is available
    if (window.hotels && Array.isArray(window.hotels) && window.hotels.length > 0) {
        console.log('Hotels data:', window.hotels);

        const cheapestHotel = calculateCheapestHotel(window.hotels);
        console.log('Cheapest Hotel:', cheapestHotel);
        window.cheapestHotel = cheapestHotel; // Store it globally for later use

        window.hotels.forEach(hotel => {
            const { hotel_name, price, location } = hotel;
            if (location && location.latitude && location.longitude) {
                // Create a marker directly using latitude and longitude

                const hotelLocation = { lat: location.latitude, lng: location.longitude };
                const isCheapest = hotel_name === cheapestHotel.hotel_name; // Compare by unique property
                console.log(`Creating marker for ${hotel_name}, isCheapest: ${isCheapest}`);




                createCustomMarker(hotelLocation, hotel_name, price, map, isCheapest);
                
            } else {
                console.error(`Missing location data for hotel: ${hotel_name}`);
            }
        });

        // Hide the spinner after all hotels are processed
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    } else {
        console.error("Hotels data is undefined or not an array");
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}




// Create a custom marker using OverlayView
function createCustomMarker(location, hotelName, hotelPrice, map, isCheapest = false) {
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
        
        console.log(`Creating marker for ${hotelName}, isCheapest: ${isCheapest}`);

        if (isCheapest) {
            div.classList.add('cheapest-marker');
            const tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.innerText = 'This is the cheapest hotel!';
            div.appendChild(tooltip);
        }

        this.div = div;

        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(div);

        const lat = location.lat;
        const lng = location.lng;

        // Add click event to show info panel after API response is ready
        div.addEventListener('click', debounce(() => {
            console.log('Clicked on hotel:', hotelName);
            
            // Fetch hotel photos and other details from Places API
            fetchHotelDetails(location, hotelName, hotelPrice,lat,lng)
                .then(data => {
                    const { photos, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours,lat, lng, reviewData  } = data;
                    
                    // Show the info panel with multiple photos (photo gallery)
                    showInfoPanel(hotelName, hotelPrice, photos, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours, lat, lng, reviewData );
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


function createUserMarker(location, map) {
    if (location && location.lat && location.lng) {
        const userMarker = new google.maps.Marker({
            position: location,
            map: map,
            title: "You are here",
            icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            }
        });

        const infoWindow = new google.maps.InfoWindow({
            content: "<div><strong>You are here</strong></div>"
        });

        userMarker.addListener('click', () => {
            infoWindow.open(map, userMarker);
        });

        // Add a tooltip that highlights the marker with "You are here!" when the user hovers over it
        userMarker.addListener('mouseover', () => {
            infoWindow.open(map, userMarker);
        });

        userMarker.addListener('mouseout', () => {
            infoWindow.close();
        });
    } else {
        console.error('Invalid user location data');
    }
}

// Function to get the photo and additional details of the hotel using Places API
function fetchHotelDetails(location, hotelName, hotelPrice,lat,lng) {
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
                        resolve({
                            ...data,
                            lat: lat,  // Pass the latitude
                            lng: lng   // Pass the longitude
                        });
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
            fields: [
                'name', 'rating', 'user_ratings_total', 'photos', 
                'formatted_phone_number', 'opening_hours', 'website',
                'price_level', 'reviews'
            ]
        };

        service.getDetails(request, function (place, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                const hotelRating = place.rating !== undefined ? place.rating : 'N/A';
                const userRatingsTotal = place.user_ratings_total !== undefined ? place.user_ratings_total : 'No reviews';
                const hotelWebsite = place.website || '#';
                const hotelPhoneNumber = place.formatted_phone_number || 'No phone number available';
                const openingHours = place.opening_hours ? (place.opening_hours.isOpen() ? 'Open now' : 'Closed') : 'Hours not available';
                const priceLevel = place.price_level !== undefined ? place.price_level : 'No price level available';
                
                // Handle photos
                const photos = Array.isArray(place.photos) && place.photos.length > 0
                    ? place.photos.map(photo => photo.getUrl({ maxWidth: 300, maxHeight: 200 }))
                    : ['https://via.placeholder.com/300x200']; // Fallback image

                // Optionally, retrieve reviews (you can limit the number of reviews if necessary)
                const reviewData  = place.reviews ? place.reviews.slice(0, 5).map(review => ({
                    author_name: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    time: review.time
                })) : [];
                console.log(priceLevel, reviewData )
                resolve({
                    photos,
                    hotelRating,
                    userRatingsTotal,
                    hotelWebsite,
                    hotelPhoneNumber,
                    openingHours,
                    priceLevel,
                    reviewData 
                });
            } else {
                reject('Place details request failed: ' + status);
            }
        });
    });
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
    openingHours,
    lat,
    lng,
    reviewData 
) {

    reviews = reviewData;  // Store the reviews array globally
    currentReviewIndex = 0;  // Reset review navigation

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

    const reviewsContainer = document.getElementById('hotel-reviews');
    reviewsContainer.innerHTML = '';  // Clear previous reviews

    if (reviews.length > 0) {
        reviews.forEach(review => {
            const reviewElement = document.createElement('div');
            reviewElement.classList.add('review');
            reviewElement.innerHTML = `
                <strong>${review.author_name}</strong> - Rating: ${review.rating}<br>
                <p>${review.text}</p>
            `;
            reviewsContainer.appendChild(reviewElement);
        });
    } else {
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

    if (hotelName === window.cheapestHotel.hotel_name) {
        document.getElementById('hotel-name').innerText = `${hotelName} (Cheapest!)`;
    } else {
        document.getElementById('hotel-name').innerText = hotelName;
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

    // Display the info panel
    document.getElementById('info-panel').classList.add("activate");
}

function displayReview(index) {
    const review = reviews[index];
    const reviewElement = document.createElement('div');
    reviewElement.classList.add('review');
    reviewElement.innerHTML = `
        <strong>${review.author_name}</strong> - Rating: ${review.rating}<br>
        <p>${review.text}</p>
    `;
    
    const reviewsContainer = document.getElementById('hotel-reviews');
    reviewsContainer.innerHTML = '';  // Clear previous review
    reviewsContainer.appendChild(reviewElement);  // Add the new review
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
    print(lat1, lng1, lat2, lng2)
    print("calculate distance")
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


function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Load Google Maps API dynamically
let isGoogleMapsAPILoaded = false;

function loadGoogleMapsAPI(lat, lng) {
    if (isGoogleMapsAPILoaded) {
        console.log("Google Maps API already loaded.");
        console.log("Initializing map with user location in loadGoogleMapsAPI function:", { lat, lng }); 
        initMap(lat, lng); // Pass the correct lat/lng dynamically
        return;
    }

    if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
        console.log("Google Maps API already available.");
        console.log("Initializing map with user location in loadGoogleMapsAPI function:", { lat, lng });
        initMap(lat, lng); // Pass the correct lat/lng dynamically
        isGoogleMapsAPILoaded = true;
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDvxJfUnj_5qojubJNy8IcGkESmG7D9dlI&libraries=places&callback=initMapCallback`;
    script.async = true;
    script.defer = true;

    document.head.appendChild(script);

    // Define a global callback to dynamically initialize the map
    window.initMapCallback = function () {
        console.log("Google Maps API initialized via callback.");
        console.log("Initializing map with user location in initMapCallback function:", { lat, lng });
        initMap(lat, lng); // Pass the correct lat/lng dynamically
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

