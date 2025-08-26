async function fetchAircraftData() {
    try {
        // Fetch position
        const positionResponse = await fetch('http://localhost:5000/aircraft/position');
        const positionData = await positionResponse.json();
        if (positionData.error) {
            console.error('Position Error:', positionData.error);
        } else {
            console.log('Position:', positionData);
            // Update your map with positionData.latitude, positionData.longitude, positionData.altitude
        }

        // Fetch aircraft type
        const typeResponse = await fetch('http://localhost:5000/aircraft/type');
        const typeData = await typeResponse.json();
        if (typeData.error) {
            console.error('Type Error:', typeData.error);
        } else {
            console.log('Aircraft Type:', typeData.type);
            // Display typeData.type in your UI
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

// Poll data every 2 seconds
setInterval(fetchAircraftData, 2000);