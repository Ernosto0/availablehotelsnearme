
// Mock hotel data (only names, no latitude/longitude)


// Initialize the map
function initMap(hotels) {
    const centerLocation = { lat: 48.8566, lng: 2.3522 };  // Center the map on Paris
    console.log("init map function");
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: centerLocation,
    });

    const geocoder = new google.maps.Geocoder();  // Geocoder object

    console.log(hotels);
    // Check if hotels data is available before iterating
    if (hotels && Array.isArray(hotels)) {
        hotels.forEach(hotel => {
            geocodeHotelName(hotel.hotel_name, geocoder, map);
        });
    } else {
        console.error("Hotels data is undefined or not an array");
    }
}

// Geocode the hotel name and add a marker to the map
function geocodeHotelName(hotelName, geocoder, map) {
    geocoder.geocode({ 'address': hotelName }, function(results, status) {
        if (status === 'OK') {
            const location = results[0].geometry.location;

            // Create a custom marker as an HTML div element
            const markerElement = document.createElement('div');
            markerElement.className = 'custom-marker';
            markerElement.innerHTML = `
                <h3>${hotelName}</h3>
                <p>Price: Unknown EUR</p>
            `;

            // Use OverlayView to create custom HTML markers on Google Maps
            const marker = new google.maps.OverlayView();
            marker.onAdd = function() {
                const panes = this.getPanes();
                const div = document.createElement('div');
                div.style.position = 'absolute';
                div.appendChild(markerElement);
                panes.overlayMouseTarget.appendChild(div);
                this.div = div;
            };

            marker.draw = function() {
                const projection = this.getProjection();
                const point = projection.fromLatLngToDivPixel(location);

                if (point) {
                    this.div.style.left = (point.x - 60) + 'px';  // Adjust marker positioning
                    this.div.style.top = (point.y - 60) + 'px';
                }
            };

            marker.onRemove = function() {
                this.div.parentNode.removeChild(this.div);
                this.div = null;
            };

            marker.setMap(map);

        } else {
            console.log('Geocode was not successful for the following reason: ' + status);
        }
    });
}

// Load the Google Maps API with your API key
function loadGoogleMaps() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDvxJfUnj_5qojubJNy8IcGkESmG7D9dlI&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Load the map
loadGoogleMaps();
