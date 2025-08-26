async function fetchAircraftData() {
    try {
        const positionResponse = await fetch('/aircraft/position');
        const positionData = await positionResponse.json();
        if (positionData.error) {
            console.error('Position Error:', positionData.error);
        } else {
            console.log('Position:', positionData);
            // Update map with positionData.latitude, positionData.longitude, positionData.altitude
        }

        const typeResponse = await fetch('/aircraft/type');
        const typeData = await typeResponse.json();
        if (typeData.error) {
            console.error('Type Error:', typeData.error);
        } else {
            console.log('Aircraft Type:', typeData.type);
            // Display typeData.type in UI
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}
setInterval(fetchAircraftData, 2000);