// Initialize the map with global hotel data



function initMap() {
    const centerLocation = { lat: 48.8566, lng: 2.3522 };  // Center the map on Paris

    // Initialize the map
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: centerLocation,
    });

    // Initialize the geocoder
    const geocoder = new google.maps.Geocoder(); 

    // Now hotels is available as a global variable
    console.log("Hotels data in initMap:", window.hotels);

    // Check if hotels data is available before iterating
    if (window.hotels && Array.isArray(window.hotels)) {
        window.hotels.forEach(hotel => {
            geocodeHotelName(hotel.hotel_name, hotel.price, geocoder, map);
        });
    } else {
        console.error("Hotels data is undefined or not an array");
    }
}

// Geocode the hotel name and create a custom marker
function geocodeHotelName(hotelName, hotelPrice, geocoder, map) {
    geocoder.geocode({ 'address': hotelName }, function(results, status) {
        if (status === 'OK') {
            const location = results[0].geometry.location;

            // Create a custom marker with hotel details
            createCustomMarker(location, hotelName, hotelPrice, map);

            // Now, let's fetch the place details to get the photo
        } else {
            console.log('Geocode was not successful for the following reason: ' + status);
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

        // Add click event to show info panel in the left corner
        div.addEventListener('click', () => {
            console.log('Clicked on hotel:', hotelName);
            getHotelPhoto(location, hotelName, hotelPrice);
            showInfoPanel(hotelName, hotelPrice);
        });
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

// Function to show the info panel on the left corner of the map



// Function to get the photo and additional details of the hotel using Places API
// Function to get the photo and additional details of the hotel using Places API
// Function to get the photo and additional details of the hotel using Places API
function getHotelPhoto(location, hotelName, hotelPrice) {
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
                    // Once the promise resolves, show the info panel with the data
                    const { photoUrl,  hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours, } = data;
                    showInfoPanel(hotelName, hotelPrice, photoUrl, hotelRating, userRatingsTotal, hotelWebsite, hotelPhoneNumber, openingHours, );
                })
                .catch(error => {
                    console.error('Error fetching place details:', error);
                });
        } else {
            console.error('Places search was not successful: ' + status);
        }
    });
}

// Function to get place details using place_id with a promise
function getPlaceDetails(service, placeId, hotelName, hotelPrice) {
    return new Promise((resolve, reject) => {
        const request = {
            placeId: placeId,
            fields: ['name',  'rating', 'user_ratings_total', 'photos', 'formatted_phone_number', 'opening_hours', 'website']
        };

        // Fetch the data
        service.getDetails(request, function(place, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                // Extract additional hotel details
                const hotelRating = place.rating !== undefined ? place.rating : 'N/A';  // Fallback to 'N/A' if rating is undefined
                const userRatingsTotal = place.user_ratings_total !== undefined ? place.user_ratings_total : 'No reviews';  // Fallback if undefined
                const hotelWebsite = place.website || '#';  // Use '#' if no website is available
                const hotelPhoneNumber = place.formatted_phone_number || 'No phone number available';
                const openingHours = place.opening_hours ? (place.opening_hours.isOpen() ? 'Open now' : 'Closed') : 'Hours not available';

                // Fetch the first photo if available
                const photoUrl = place.photos && place.photos.length > 0 
                                 ? place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 }) 
                                 : 'https://via.placeholder.com/300x200';

                // Resolve the promise with all the data
                resolve({
                    photoUrl,
                    hotelRating,
                    userRatingsTotal,
                    hotelWebsite,
                    hotelPhoneNumber,
                    openingHours,
                    
                });
            } else {
                reject('Place details request failed: ' + status);
            }
        });
    });
}



// Function to show the info panel with hotel details 
function showInfoPanel(
    hotelName,           // Hotel name
    hotelPrice,          // Hotel price
    photoUrl,            // Photo URL
    hotelRating,         // Rating
    userRatingsTotal,    // Total number of user ratings
    hotelWebsite,        // Hotel website
    hotelPhoneNumber,    // Phone number
    openingHours,        // Opening hours
              // User review
) {
    // Populate the info panel with hotel details and photo
    document.getElementById('hotel-name').innerText = hotelName;
    document.getElementById('hotel-price').innerText = `Price: ${hotelPrice} EUR`;
    document.getElementById('hotel-photo').src = photoUrl;
    document.getElementById('hotel-rating').innerText = `Rating: ${hotelRating} (${userRatingsTotal} reviews)`;
    document.getElementById('hotel-phone').innerText = `Phone: ${hotelPhoneNumber}`;
    document.getElementById('hotel-website').href = hotelWebsite;
    document.getElementById('hotel-opening-hours').innerText = `Status: ${openingHours}`;

    // Display the info panel
    document.getElementById('info-panel').style.display = 'block';
}

// Call this function when the DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Load Google Maps API dynamically and trigger initMap once the API is loaded
    loadGoogleMapsAPI();
});



// Load Google Maps API dynamically
function loadGoogleMapsAPI() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDvxJfUnj_5qojubJNy8IcGkESmG7D9dlI&libraries=places&callback=initMap`;

    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}
