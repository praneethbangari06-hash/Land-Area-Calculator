import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')


CORS(app)

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/land_calculator")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info() # trigger exception if cannot connect
    db = client.get_database()
    lands_collection = db.lands
    print("Connected to MongoDB successfully")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB: {e}")
    # Create a mock for local development if MongoDB is not available
    class MockCollection:
        def insert_one(self, data):
            data['_id'] = 'mock_id'
            return type('obj', (object,), {'inserted_id': 'mock_id'})
        def find(self):
            return type('cursor', (object,), {
                'sort': lambda self, key, order: [
                    {'_id': '1', 'name': 'Demo Land 1', 'area_acres': 2.5, 'area_sqm': 10117, 'timestamp': datetime.now()},
                    {'_id': '2', 'name': 'Demo Land 2', 'area_acres': 1.2, 'area_sqm': 4856, 'timestamp': datetime.now()}
                ]
            })()
        def delete_one(self, query): return type('obj', (object,), {'deleted_count': 1})
    lands_collection = MockCollection()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/save-land', methods=['POST'])
def save_land():
    try:
        data = request.json
        land_entry = {
            "name": data.get("name", "Unnamed Land"),
            "coordinates": data.get("coordinates", []),
            "area_acres": data.get("area_acres", 0),
            "area_guntas": data.get("area_guntas", 0),
            "area_hectares": data.get("area_hectares", 0),
            "area_sqft": data.get("area_sqft", 0),
            "area_sqm": data.get("area_sqm", 0),
            "distance_m": data.get("distance_m", 0),
            "timestamp": datetime.utcnow()
        }
        result = lands_collection.insert_one(land_entry)
        return jsonify({"message": "Land saved successfully", "id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lands', methods=['GET'])
def get_lands():
    try:
        lands = list(lands_collection.find().sort("timestamp", -1))
        for land in lands:
            land["_id"] = str(land["_id"])
        return jsonify(lands), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/land/<id>', methods=['DELETE'])
def delete_land(id):
    try:
        result = lands_collection.delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 1:
            return jsonify({"message": "Land deleted successfully"}), 200
        else:
            return jsonify({"error": "Land not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai-advice', methods=['POST'])
def ai_advice():
    try:
        acres = request.json.get('area', 0)
        
        if acres < 0.5:
            advice = "Small plot (under 0.5 acres). Best crops: Tomato, Brinjal, Chilli. Water: 2-3 hours daily by hand or pipe."
        elif acres < 2:
            advice = "Good size plot (0.5-2 acres). Best crops: Groundnut, Cotton, Maize. Borewell recommended for Telangana."
        elif acres < 10:
            advice = "Medium farm (2-10 acres). Best crops: Paddy, Cotton, Turmeric. Drip irrigation will save water costs."
        else:
            advice = "Large farm (10+ acres). Best crops: Paddy, Soybean, Sunflower. Hire tractor, plan seasonal crop rotation."
            
        return jsonify({"advice": advice}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai-verify', methods=['POST'])
def ai_verify():
    try:
        data = request.json
        area = float(data.get("area", 0))
        
        if area < 0.1:
            return jsonify({
                "warning": "⚠️ This measurement seems unusually small (less than 0.1 acres). Please re-verify your boundary points.",
                "is_unusual": True
            }), 200
        elif area > 50:
            return jsonify({
                "warning": "⚠️ This measurement seems unusually large (more than 50 acres). Please re-verify your boundary points.",
                "is_unusual": True
            }), 200
        else:
            return jsonify({"is_unusual": False}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.run(host='0.0.0.0', port=5000, debug=True)
