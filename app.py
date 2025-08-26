#!/usr/bin/env python3
"""
FlyCharts - Enhanced Flask Application with SimConnect Integration
"""

from flask import Flask, jsonify, send_file, send_from_directory, Response
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import logging
import os
import time
import threading
from datetime import datetime

# SimConnect imports with error handling
try:
    from SimConnect import SimConnect, AircraftRequests
    SIMCONNECT_AVAILABLE = True
except ImportError:
    SIMCONNECT_AVAILABLE = False
    logging.warning("SimConnect library not available")

# Initialize Flask app
app = Flask(__name__, static_folder='.')
app.config['SECRET_KEY'] = 'flycharts-secret-key-2024'

# Enable CORS
CORS(app)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SimConnectManager:
    def __init__(self):
        self.sm = None
        self.aq = None
        self.connected = False
        self.update_thread = None
        self.running = False
        self.last_position = None
        
    def connect(self):
        """Connect to SimConnect"""
        if not SIMCONNECT_AVAILABLE:
            return {
                "success": False,
                "message": "SimConnect library not installed",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
            
        try:
            self.sm = SimConnect()
            self.aq = AircraftRequests(self.sm, _time=500)  # 500ms cache
            
            # Test connection
            test_data = self.aq.get("PLANE_LATITUDE")
            
            self.connected = True
            self.start_update_loop()
            
            logger.info("Successfully connected to SimConnect")
            return {
                "success": True,
                "message": "Connected to SimConnect successfully",
                "connected": True,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to connect to SimConnect: {e}")
            self.connected = False
            return {
                "success": False,
                "message": f"Failed to connect: {str(e)}",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
    
    def disconnect(self):
        """Disconnect from SimConnect"""
        try:
            self.running = False
            
            if self.update_thread and self.update_thread.is_alive():
                self.update_thread.join(timeout=3)
                
            if self.sm:
                self.sm.exit()
                
            self.sm = None
            self.aq = None
            self.connected = False
            self.last_position = None
            
            logger.info("Disconnected from SimConnect")
            return {
                "success": True,
                "message": "Disconnected successfully",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")
            return {
                "success": False,
                "message": f"Disconnect error: {str(e)}",
                "connected": self.connected,
                "timestamp": datetime.now().isoformat()
            }
    
    def get_status(self):
        """Get current connection status"""
        return {
            "connected": self.connected,
            "simconnect_available": SIMCONNECT_AVAILABLE,
            "last_position": self.last_position,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_aircraft_position(self):
        """Get current aircraft position and details"""
        if not self.connected or not self.aq:
            return None
            
        try:
            # Get position data
            latitude = self.aq.get("PLANE_LATITUDE")
            longitude = self.aq.get("PLANE_LONGITUDE")
            altitude = self.aq.get("PLANE_ALTITUDE")
            heading = self.aq.get("PLANE_HEADING_DEGREES_MAGNETIC")
            airspeed = self.aq.get("AIRSPEED_TRUE")
            ground_speed = self.aq.get("GROUND_VELOCITY")
            vertical_speed = self.aq.get("VERTICAL_SPEED")
            
            # Get aircraft details
            aircraft_title = self.aq.get("TITLE")
            atc_id = self.aq.get("ATC_ID")
            
            if latitude is not None and longitude is not None:
                position_data = {
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                    "altitude": float(altitude or 0),
                    "heading": float(heading or 0),
                    "airspeed": float(airspeed or 0),
                    "ground_speed": float(ground_speed or 0),
                    "vertical_speed": float(vertical_speed or 0),
                    "aircraft_title": str(aircraft_title or "Unknown"),
                    "atc_id": str(atc_id or ""),
                    "timestamp": datetime.now().isoformat()
                }
                
                self.last_position = position_data
                return position_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting aircraft position: {e}")
            return None
    
    def start_update_loop(self):
        """Start background update loop"""
        if self.update_thread and self.update_thread.is_alive():
            return
            
        self.running = True
        self.update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self.update_thread.start()
    
    def _update_loop(self):
        """Background loop for real-time updates"""
        while self.running and self.connected:
            try:
                position = self.get_aircraft_position()
                if position:
                    # Emit to all connected clients
                    socketio.emit('aircraft_position_update', position)
                
                time.sleep(0.5)  # Update every second
                
            except Exception as e:
                logger.error(f"Error in update loop: {e}")
                time.sleep(2)

# Global SimConnect manager
simconnect_manager = SimConnectManager()

# Routes
@app.route('/')
def serve_index():
    """Serve main index page"""
    return send_file('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    status = simconnect_manager.get_status()
    return jsonify({
        "status": "Backend running",
        "simconnect_available": status["simconnect_available"],
        "simconnect_connected": status["connected"],
        "timestamp": status["timestamp"]
    })

# Legacy endpoints (backward compatibility)
@app.route('/aircraft/position', methods=['GET'])
def get_aircraft_position_legacy():
    """Legacy aircraft position endpoint"""
    position = simconnect_manager.get_aircraft_position()
    if position:
        return jsonify(position)
    else:
        return jsonify({"error": "No position data available"}), 500

@app.route('/aircraft/type', methods=['GET'])
def get_aircraft_type_legacy():
    """Legacy aircraft type endpoint"""
    position = simconnect_manager.get_aircraft_position()
    if position and position.get('aircraft_title'):
        return jsonify({"type": position['aircraft_title']})
    else:
        return jsonify({"error": "No aircraft data available"}), 500

# New SimConnect API endpoints
@app.route('/api/simconnect/connect', methods=['POST'])
def connect_simconnect():
    """Connect to SimConnect"""
    result = simconnect_manager.connect()
    socketio.emit('simconnect_status', result)
    return jsonify(result)

@app.route('/api/simconnect/disconnect', methods=['POST'])
def disconnect_simconnect():
    """Disconnect from SimConnect"""
    result = simconnect_manager.disconnect()
    socketio.emit('simconnect_status', result)
    return jsonify(result)

@app.route('/api/simconnect/status', methods=['GET'])
def get_simconnect_status():
    """Get SimConnect status"""
    return jsonify(simconnect_manager.get_status())

@app.route('/api/aircraft/position', methods=['GET'])
def get_aircraft_position_api():
    """Get current aircraft position"""
    position = simconnect_manager.get_aircraft_position()
    if position:
        return jsonify({"success": True, "data": position})
    else:
        return jsonify({"success": False, "message": "No position data available"})

# WebSocket events
@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info(f"Client connected: {request.sid}")
    
    # Send current status
    status = simconnect_manager.get_status()
    emit('simconnect_status', status)
    
    # Send current position if available
    if status['last_position']:
        emit('aircraft_position_update', status['last_position'])

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('request_status')
def handle_status_request():
    """Handle status request"""
    status = simconnect_manager.get_status()
    emit('simconnect_status', status)

@socketio.on('request_position')
def handle_position_request():
    """Handle position request"""
    position = simconnect_manager.get_aircraft_position()
    if position:
        emit('aircraft_position_update', position)

# Static file serving
@app.route('/favicon.ico')
def serve_favicon_ico():
    """Suppress favicon requests"""
    return Response(status=204)

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    if os.path.exists(path):
        return send_from_directory('.', path)
    return jsonify({"error": "File not found"}), 404

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error"}), 500

if __name__ == '__main__':
    logger.info("Starting FlyCharts application...")
    
    # Try to auto-connect on startup if available
    if SIMCONNECT_AVAILABLE:
        logger.info("Attempting auto-connect to SimConnect...")
        simconnect_manager.connect()
    
    try:
        socketio.run(
            app, 
            host='0.0.0.0', 
            port=5500, 
            debug=True,
            allow_unsafe_werkzeug=True
        )
    except KeyboardInterrupt:
        logger.info("Application stopped by user")
        simconnect_manager.disconnect()
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise