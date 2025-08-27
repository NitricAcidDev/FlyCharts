/**
 * SimConnect Integration for FlyCharts
 * Adds real-time aircraft position tracking to existing FlyCharts functionality
 */

// SimConnect-specific variables
let socket = null;
let autoUpdateEnabled = true;
let isSimConnectConnected = false;

// Initialize WebSocket connection for real-time updates
function initWebSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', function() {
            console.log('Connected to FlyCharts server');
            updateStatus('Connected to server', 'success');
        });
        
        socket.on('disconnect', function() {
            console.log('Disconnected from FlyCharts server');
            updateStatus('Disconnected from server', 'warning');
        });
        
        socket.on('simconnect_status', function(data) {
            updateSimConnectStatus(data);
        });
        
        socket.on('aircraft_position_update', function(data) {
            if (autoUpdateEnabled && data) {
                handleRealtimePositionUpdate(data);
            }
        });
        
        socket.on('error', function(error) {
            console.error('Socket error:', error);
            updateStatus('Connection error', 'error');
        });
    } else {
        console.warn('Socket.IO not available - real-time updates disabled');
        updateStatus('Real-time updates unavailable', 'warning');
    }
}

// Connect to SimConnect
async function connectSimConnect() {
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    // Update button state
    connectBtn.disabled = true;
    connectBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
        Connecting...`;
    
    try {
        const response = await fetch('/api/simconnect/connect', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            isSimConnectConnected = true;
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            updateStatus('Connected to SimConnect successfully', 'success');
            
            // Show real-time indicator if auto-update is enabled
            if (autoUpdateEnabled) {
                document.getElementById('realtime-indicator').style.display = 'flex';
            }
            
            // Request initial position
            if (socket) {
                socket.emit('request_position');
            }
        } else {
            updateStatus(`Failed to connect: ${result.message}`, 'error');
            console.error('SimConnect connection failed:', result);
        }
    } catch (error) {
        updateStatus(`Connection error: ${error.message}`, 'error');
        console.error('Connection error:', error);
    } finally {
        // Reset button
        connectBtn.disabled = false;
        connectBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
            Connect`;
    }
}

// Disconnect from SimConnect
async function disconnectSimConnect() {
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    try {
        const response = await fetch('/api/simconnect/disconnect', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        isSimConnectConnected = false;
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        document.getElementById('realtime-indicator').style.display = 'none';
        
        updateStatus('Disconnected from SimConnect', 'success');
        console.log('SimConnect disconnected:', result);
        
    } catch (error) {
        updateStatus(`Disconnect error: ${error.message}`, 'error');
        console.error('Disconnect error:', error);
    }
}

// Update SimConnect status indicator
function updateSimConnectStatus(statusData) {
    const statusElement = document.getElementById('simconnect-status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    if (!statusElement) {
        console.warn('SimConnect status element not found');
        return;
    }
    
    if (statusData.connected) {
        statusElement.className = 'status-indicator status-connected';
        statusElement.innerHTML = '<div class="status-dot"></div><span>Connected</span>';
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        isSimConnectConnected = true;
        
        if (autoUpdateEnabled) {
            document.getElementById('realtime-indicator').style.display = 'flex';
        }
    } else {
        statusElement.className = 'status-indicator status-disconnected';
        statusElement.innerHTML = '<div class="status-dot"></div><span>Disconnected</span>';
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        isSimConnectConnected = false;
        document.getElementById('realtime-indicator').style.display = 'none';
    }
    
    console.log('SimConnect status updated:', statusData);
}

// Toggle auto-update feature
function toggleAutoUpdate() {
    const toggle = document.getElementById('auto-update-toggle');
    const indicator = document.getElementById('realtime-indicator');
    
    autoUpdateEnabled = !autoUpdateEnabled;
    
    if (autoUpdateEnabled) {
        toggle.classList.add('active');
        if (isSimConnectConnected) {
            indicator.style.display = 'flex';
        }
        updateStatus('Real-time updates enabled', 'success');
    } else {
        toggle.classList.remove('active');
        indicator.style.display = 'none';
        updateStatus('Real-time updates disabled', 'warning');
    }
}

// Handle real-time position updates from SimConnect
function handleRealtimePositionUpdate(positionData) {
    if (!autoUpdateEnabled) return;
    
    console.log('Received position update:', positionData);
    
    try {
        // Update form fields with new data
        const latField = document.getElementById('latitude');
        const lngField = document.getElementById('longitude');
        const altField = document.getElementById('altitude');
        const hdgField = document.getElementById('heading');
        
        if (latField) latField.value = positionData.latitude.toFixed(6);
        if (lngField) lngField.value = positionData.longitude.toFixed(6);
        if (altField) altField.value = Math.round(positionData.altitude);
        if (hdgField) hdgField.value = Math.round(positionData.heading);
        
        // Update global aircraft data
        aircraftData.latitude = positionData.latitude;
        aircraftData.longitude = positionData.longitude;
        aircraftData.altitude = positionData.altitude;
        aircraftData.heading = positionData.heading;
        aircraftData.groundSpeed = positionData.ground_speed;
        aircraftData.aircraft = positionData.aircraft_title;
        aircraftData.callsign = positionData.atc_id || '';
        
        // Update aircraft marker on map
        updateAircraftMarkerPosition(positionData.latitude, positionData.longitude, positionData.heading);
        
        // Show and update aircraft info panel
        showAircraftInfo();
        
        // Update status with latest position
        updateStatus(
            `Live: ${positionData.latitude.toFixed(4)}, ${positionData.longitude.toFixed(4)}, ${Math.round(positionData.altitude)}ft`, 
            'success'
        );
        
    } catch (error) {
        console.error('Error handling position update:', error);
        updateStatus('Error processing position data', 'error');
    }
}

// Update aircraft marker position (helper function)
function updateAircraftMarkerPosition(lat, lng, heading) {
    try {
        // Remove existing marker
        if (typeof aircraftMarker !== 'undefined' && aircraftMarker && map) {
            map.removeLayer(aircraftMarker);
        }
        
        // Create new aircraft icon with rotation
        const aircraftIcon = L.divIcon({
            html: `<div style="font-size: 32px; transform: rotate(${heading - 90}deg); color: #3b82f6; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">✈</div>`,
            className: 'aircraft-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        // Add new marker
        if (typeof map !== 'undefined' && map) {
            aircraftMarker = L.marker([lat, lng], { icon: aircraftIcon }).addTo(map);
        }
        
    } catch (error) {
        console.error('Error updating aircraft marker:', error);
    }
}

// Enhanced legacy fetch function for fallback
async function fetchAircraftDataEnhanced() {
    // Only use legacy fetch if WebSocket is not connected
    if (socket && socket.connected) return;
    
    if (!isSimConnectConnected) return;
    
    try {
        const positionResponse = await fetch('/aircraft/position');
        const positionData = await positionResponse.json();
        
        if (positionData.error) {
            console.error('Position Error:', positionData.error);
        } else {
            console.log('Position (legacy):', positionData);
            if (autoUpdateEnabled) {
                handleRealtimePositionUpdate(positionData);
            }
        }

        const typeResponse = await fetch('/aircraft/type');
        const typeData = await typeResponse.json();
        
        if (typeData.error) {
            console.error('Type Error:', typeData.error);
        } else {
            console.log('Aircraft Type (legacy):', typeData.type);
            aircraftData.aircraft = typeData.type;
        }
        
    } catch (error) {
        console.error('Legacy fetch error:', error);
    }
}

// Check SimConnect status periodically
async function checkSimConnectStatus() {
    try {
        const response = await fetch('/api/simconnect/status');
        const status = await response.json();
        updateSimConnectStatus(status);
    } catch (error) {
        console.error('Error checking SimConnect status:', error);
    }
}

// Initialize SimConnect integration
function initSimConnectIntegration() {
    console.log('Initializing SimConnect integration...');
    
    // Initialize WebSocket for real-time updates
    initWebSocket();
    
    // Check initial status
    checkSimConnectStatus();
    
    // Set up periodic status checks (every 10 seconds)
    setInterval(checkSimConnectStatus, 10000);
    
    // Set up legacy fallback polling (every 2 seconds)
    setInterval(fetchAircraftDataEnhanced, 2000);
    
    console.log('SimConnect integration initialized');
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimConnectIntegration);
} else {
    initSimConnectIntegration();
}

// Export functions for global access
window.connectSimConnect = connectSimConnect;
window.disconnectSimConnect = disconnectSimConnect;
window.toggleAutoUpdate = toggleAutoUpdate;