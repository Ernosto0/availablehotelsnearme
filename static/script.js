// script.js

// Mock hotel data (replace with real data later)
const hotels = [
    {"hotel_name": "Hotel Alpha", "latitude": 48.8566, "longitude": 2.3522, "price": "100.00"},
    {"hotel_name": "Hotel Beta", "latitude": 48.8567, "longitude": 2.3530, "price": "120.00"},
    {"hotel_name": "Hotel Gamma", "latitude": 48.8570, "longitude": 2.3540, "price": "90.00"},
    {"hotel_name": "Hotel Delta", "latitude": 48.8555, "longitude": 2.3525, "price": "200.00"},
    {"hotel_name": "Hotel Epsilon", "latitude": 48.8580, "longitude": 2.3500, "price": "85.00"},
    {"hotel_name": "Hotel Zeta", "latitude": 48.8550, "longitude": 2.3510, "price": "110.00"},
    {"hotel_name": "Hotel Eta", "latitude": 48.8568, "longitude": 2.3490, "price": "150.00"},
    {"hotel_name": "Hotel Theta", "latitude": 48.8575, "longitude": 2.3485, "price": "95.00"},
    {"hotel_name": "Hotel Iota", "latitude": 48.8590, "longitude": 2.3550, "price": "130.00"},
    {"hotel_name": "Hotel Kappa", "latitude": 48.8540, "longitude": 2.3475, "price": "160.00"}
];

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
