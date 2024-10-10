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

            // Create a custom marker
            createCustomMarker(location, hotelName, hotelPrice, map);
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
function showInfoPanel(hotelName, hotelPrice) {
    // Populate the info panel with hotel details
    document.getElementById('hotel-name').innerText = hotelName;
    document.getElementById('hotel-price').innerText = `Price: ${hotelPrice} EUR`;

    // For now, let's use a placeholder image
    document.getElementById('hotel-photo').src = 'https://via.placeholder.com/300x200'; 

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDvxJfUnj_5qojubJNy8IcGkESmG7D9dlI&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}
