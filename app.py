from flask import Flask, jsonify
from flask_cors import CORS
from SimConnect import SimConnect, AircraftRequests
import logging

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize SimConnect
try:
    sm = SimConnect()
    aq = AircraftRequests(sm, _time=1000)  # Cache data for 1 second
    logger.info("Connected to Microsoft Flight Simulator")
except Exception as e:
    logger.error(f"Failed to connect to SimConnect: {str(e)}")
    sm = None
    aq = None

@app.route('/aircraft/position', methods=['GET'])
def get_aircraft_position():
    if sm is None or aq is None:
        return jsonify({"error": "SimConnect not initialized"}), 500
    
    try:
        # Retrieve aircraft position
        latitude = aq.get("PLANE_LATITUDE")  # Degrees
        longitude = aq.get("PLANE_LONGITUDE")  # Degrees
        altitude = aq.get("PLANE_ALTITUDE")  # Feet
        
        if latitude is None or longitude is None or altitude is None:
            return jsonify({"error": "Failed to retrieve position data"}), 500
        
        return jsonify({
            "latitude": float(latitude),
            "longitude": float(longitude),
            "altitude": float(altitude)
        })
    except Exception as e:
        logger.error(f"Error retrieving position: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/aircraft/type', methods=['GET'])
def get_aircraft_type():
    if sm is None or aq is None:
        return jsonify({"error": "SimConnect not initialized"}), 500
    
    try:
        # Retrieve aircraft type
        atc_type = aq.get("ATC_TYPE")  # String
        if atc_type is None:
            return jsonify({"error": "Failed to retrieve aircraft type"}), 500
        
        return jsonify({"type": str(atc_type)})
    except Exception as e:
        logger.error(f"Error retrieving aircraft type: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Backend running", "simconnect_connected": sm is not None})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)