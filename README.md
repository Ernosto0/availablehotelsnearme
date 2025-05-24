# Available Hotels Near Me

A Django-based web application that helps users find available hotels in their vicinity in real time map. The application integrates with multiple hotel booking APIs and search services to provide real-time hotel availability information.

The app was available on www.availablehotelsnear.me address for a few month. But it is not anymore. 

## Features

- Real-time hotel availability search
- Integration with multiple booking services (Amadeus, Google Places)
- Rate limiting to ensure API stability
- Beautiful and responsive user interface
- Location-based search functionality

## Tech Stack

- Python 3.x
- Django 5.0
- SQLite Database
- Various third-party APIs:
  - Amadeus API
  - Google Places API
  - Uber Rides API

## Prerequisites

- Python 3.x
- Virtual environment (recommended)
- API keys for integrated services

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/availablehotelsnearme.git
cd availablehotelsnearme
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On Unix or MacOS
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r req.txt
```

4. Set up environment variables:
Create a `.env` file in the root directory and add your API keys:
```
AMADEUS_API_KEY=your_key_here
GOOGLE_PLACES_API_KEY=your_key_here
```

5. Run database migrations:
```bash
python manage.py migrate
```

6. Start the development server:
```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000`

## Project Structure

```
availablehotelsnearme/
├── myapp/                  # Main Django application
│   ├── static/            # Static files (CSS, JS, images)
│   ├── templates/         # HTML templates
│   ├── views.py          # View functions
│   ├── models.py         # Database models
│   └── tests.py          # Test cases
├── static/                # Global static files
├── venv/                  # Virtual environment
├── manage.py             # Django management script
├── req.txt               # Project dependencies
└── README.md             # This file
```

## Logging

The application maintains two log files:
- `google_places.log`: Logs interactions with Google Places API
- `hotel_search.log`: Logs general hotel search operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
