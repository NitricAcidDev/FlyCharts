let map, currentBaseLayer, currentOverlayLayer;
let airportMarkers = L.layerGroup();

function updateStatus(message, type = 'success') {
    document.getElementById('status').textContent = message;
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (type === 'success') {
        dot.style.background = '#10b981';
        text.textContent = 'Succeeded';
    } else if (type === 'error') {
        dot.style.background = '#ef4444';
        text.textContent = 'Failed';
    }
}

async function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView([39.8283, -98.5795], 4);
    map.createPane('labels');
    map.getPane('labels').style.zIndex = 650;
    map.getPane('labels').style.pointerEvents = 'none';
    currentBaseLayer = L.maplibreGL({
        style: 'https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAQ3NzVldyNW9vRE8xNGM4UjtYzY1cmw1O_KElrrp1-a36.json?key=8c6bwORxaSZca2MW4UclcA8gGYt8lbmE',
        attribution: '© TomTom | © OpenStreetMap contributors'
    }).addTo(map);
    map.zoomControl.setPosition('bottomright');
    airportMarkers.addTo(map);

    try {
        const response = await fetch('airports.json');
        const airports = await response.json();
        addAirportMarkers(airports);
        map.on('zoomend', () => {
            addAirportMarkers(airports);
            updateStatus(`Updated airport markers for zoom level ${map.getZoom()}`, 'success');
        });
    } catch (error) {
        updateStatus('Failed to load airports.json', 'error');
    }
    updateStatus('Map loaded successfully', 'success');
}

function addAirportMarkers(airports) {
    airportMarkers.clearLayers();
    const zoom = map.getZoom();

    const filteredAirports = airports.filter(a => {
        if (zoom < 5) return a.size === 1;
        if (zoom <= 8) return a.size <= 2;
        return true;
    });

    filteredAirports.forEach(a => {
        const marker = L.marker([a.lat, a.lng], {
            icon: L.icon({
                iconUrl: 'image/airport.svg',
                iconSize: [70, 70],
                iconAnchor: [35, 35],
                popupAnchor: [0, -35]
            })
        }).bindPopup(`${a.code}`);
        airportMarkers.addLayer(marker);
    });

    airportMarkers.addTo(map);
}

function changeMapLayer() {
    const selectedLayer = document.getElementById('mapLayer').value;
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    if (currentOverlayLayer) map.removeLayer(currentOverlayLayer);
    currentOverlayLayer = null;

    let baseUrl, baseAttribution, maxZoom = 19, options = {};
    switch (selectedLayer) {
        case 'satellite':
            baseUrl = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
            baseAttribution = '© Google';
            options.subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];
            break;
        case 'terrain':
            baseUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png';
            baseAttribution = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
            options.subdomains = 'abcd';
            maxZoom = 18;
            break;
        case 'topo':
            baseUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
            baseAttribution = '© OpenTopoMap contributors';
            maxZoom = 17;
            break;
        case 'dark':
            baseUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            baseAttribution = '© CARTO';
            break;
        case 'hybrid':
            baseUrl = 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
            baseAttribution = '© Google';
            options.subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];
            break;
        case 'darkHybrid':
            baseUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            baseAttribution = '© CARTO | © Google';
            currentBaseLayer = L.tileLayer(baseUrl, { attribution: baseAttribution, maxZoom }).addTo(map);
            currentOverlayLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
                attribution: '',
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                pane: 'labels',
                maxZoom: 20
            }).addTo(map);
            addAirportMarkers(airports);
            updateStatus(`Map layer changed to ${selectedLayer}`, 'success');
            return;
        case 'tomtom':
            currentBaseLayer = L.maplibreGL({
                style: 'https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAQ3NzVldyNW9vRE8xNGM4UjtYzY1cmw1O_KElrrp1-a36.json?key=8c6bwORxaSZca2MW4UclcA8gGYt8lbmE',
                attribution: '© TomTom | © OpenStreetMap contributors'
            }).addTo(map);
            addAirportMarkers(airports);
            updateStatus(`Map layer changed to ${selectedLayer}`, 'success');
            return;
        default:
            baseUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            baseAttribution = '© OpenStreetMap contributors';
    }
    currentBaseLayer = L.tileLayer(baseUrl, { attribution: baseAttribution, maxZoom, ...options }).addTo(map);
    addAirportMarkers(airports);
    updateStatus(`Map layer changed to ${selectedLayer}`, 'success');
}

initMap();