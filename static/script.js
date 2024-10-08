// script.js

// Mock hotel data (replace with real data later)


// Initialize the map
function initMap() {
    const centerLocation = { lat: 48.8566, lng: 2.3522 };  // Center the map on Paris

    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: centerLocation,
    });

    // Add regular markers with custom overlays for each hotel
    hotels.forEach(hotel => {
        const hotelLocation = {
            lat: parseFloat(hotel.latitude),
            lng: parseFloat(hotel.longitude)
        };

        // Create a regular Google Maps marker
        const marker = new google.maps.Marker({
            position: hotelLocation,
            map: map,
            title: hotel.hotel_name
        });

        // Create a custom label to display above the marker
        const labelElement = document.createElement('div');
        labelElement.className = 'custom-marker-label';
        labelElement.innerHTML = `
            <h3>${hotel.hotel_name}</h3>
            <p>Price: ${hotel.price} EUR</p>
        `;

        // Use OverlayView to place the custom label on the map
        const labelOverlay = new google.maps.OverlayView();
        labelOverlay.onAdd = function() {
            const panes = this.getPanes();
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.appendChild(labelElement);
            panes.overlayMouseTarget.appendChild(div);
            this.div = div;
        };

        labelOverlay.draw = function() {
            const position = new google.maps.LatLng(hotelLocation.lat, hotelLocation.lng);
            const projection = this.getProjection();
            const point = projection.fromLatLngToDivPixel(position);

            if (point) {
                this.div.style.left = (point.x - 40) + 'px';  // Center horizontally
                this.div.style.top = (point.y - 50) + 'px';   // Offset vertically above marker
            }
        };

        labelOverlay.onRemove = function() {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
        };

        labelOverlay.setMap(map);
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
