# Smart Land Area Calculator

A mobile-friendly web application designed for farmers to measure land area easily using map drawing or GPS walking.

## Features
- **Two Measurement Modes**: Draw on map or Walk with GPS.
- **Mobile-First Design**: Large buttons and simple UI for ease of use.
- **Multi-language Support**: English and Telugu.
- **Voice Guidance**: Real-time instructions in English and Telugu.
- **Area Units**: Acres and Square Meters.
- **History Management**: Save, view, and delete land measurements.
- **WhatsApp Sharing**: Share land details directly via WhatsApp.
- **GPS Accuracy Display**: Real-time feedback on GPS signal quality.

## Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript, Leaflet.js, Turf.js.
- **Backend**: Flask (Python).
- **Database**: MongoDB.

## Setup Instructions

### Prerequisites
- Python 3.8+
- MongoDB (Local or Atlas)

### Installation
1. Clone the repository or extract the files.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file and set your `MONGO_URI`:
   ```
   MONGO_URI=mongodb://localhost:27017/land_calculator
   PORT=5000
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Open your browser and navigate to `http://localhost:5000`.

## API Endpoints
- `GET /api/lands`: Fetch all saved land measurements.
- `POST /api/save-land`: Save a new land measurement.
- `DELETE /api/land/<id>`: Delete a saved land measurement.
