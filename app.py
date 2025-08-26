from flask import Flask, jsonify, send_file, send_from_directory, Response
from flask_cors import CORS
from SimConnect import SimConnect, AircraftRequests
import logging
import os

# Initialize Flask app
app = Flask(__name__, static_folder='.')  # Serve all files from root
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
        latitude = aq.get("PLANE_LATITUDE")  # Degrees
        longitude = aq.get("PLANE_LONGITUDE")  # Degrees
        altitude = aq.get("PLANE_ALTITUDE")  # Feet
        heading = aq.get("PLANE_HEADING_DEGREES_TRUE")  # Degrees
        airspeed = aq.get("AIRSPEED_TRUE")  # Knots
        
        if latitude is None or longitude is None or altitude is None:
            return jsonify({"error": "Failed to retrieve position data"}), 500
        
        return jsonify({
            "latitude": float(latitude),
            "longitude": float(longitude),
            "altitude": float(altitude),
            "heading": float(heading or 0),
            "airspeed": float(airspeed or 0)
        })
    except Exception as e:
        logger.error(f"Error retrieving position: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/aircraft/type', methods=['GET'])
def get_aircraft_type():
    if sm is None or aq is None:
        return jsonify({"error": "SimConnect not initialized"}), 500
    
    try:
        atc_type = aq.get("ATC_TYPE")  # String
        if atc_type is None:
            return jsonify({"error": "Failed to retrieve aircraft type"}), 500
        
        return jsonify({"type": str(atc_type)})
    except Exception as e:
        logger.error(f"Error retrieving aircraft type: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "Backend running",
        "simconnect_connected": sm is not None and aq is not None
    })

@app.route('/')
def serve_index():
    return send_file('index.html')

@app.route('/favicon.ico')
def serve_favicon_ico():
    return Response(status=204)  # Suppress favicon.ico requests

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5500, debug=True)