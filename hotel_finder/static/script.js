// Initialize the map with global hotel data


function initMap(userLatitude, userLongitude) {
    const centerLocation = { lat: userLatitude, lng: userLongitude };  
    
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
document.addEventListener('DOMContentLoaded', function () {
    const mapElement = document.getElementById('map');
    const loadingSpinner = document.getElementById('loading-spinner');

    if (navigator.geolocation) {
        // Get the user's location
        navigator.geolocation.getCurrentPosition(
            position => {
                const userLatitude = position.coords.latitude;
                const userLongitude = position.coords.longitude;

                console.log(`User's location: Latitude=${userLatitude}, Longitude=${userLongitude}`);

                // Show the loading spinner
                loadingSpinner.style.display = 'block';

                // Fetch hotel data from the backend
                fetch(`/hotels/map/?latitude=${encodeURIComponent(userLatitude)}&longitude=${encodeURIComponent(userLongitude)}`)
                    .then(response => response.json())
                    .then(data => {
                        loadingSpinner.style.display = 'none'; // Hide spinner

                        if (data.error) {
                            alert('Error fetching hotels: ' + data.error);
                            console.error('Backend Error:', data.error);
                            return;
                        }

                        console.log('Fetched Hotel Data:', data.hotels);

                        // Initialize the map with hotel data
                        initMap(userLatitude, userLongitude, data.hotels);
                    })
                    .catch(error => {
                        loadingSpinner.style.display = 'none'; // Hide spinner
                        console.error('Fetch Error:', error);
                        alert('Failed to fetch hotel data. Please try again.');
                    });
            },
            error => {
                console.error('Geolocation Error:', error);
                alert('Unable to retrieve your location. Using default location.');
                initMap(48.8566, 2.3522, []); // Default to Paris with no hotels
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Using default location.');
        initMap(48.8566, 2.3522, []); // Default to Paris with no hotels
    }
});

function initMap(latitude, longitude, hotels) {
    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: latitude, lng: longitude },
        zoom: 13,
    });

    hotels.forEach(hotel => {
        new google.maps.Marker({
            position: { lat: hotel.latitude, lng: hotel.longitude },
            map: map,
            title: hotel.name,
        });
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
