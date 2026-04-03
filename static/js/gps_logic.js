let watchId = null;
let walkPath = [];
let walkPolyline = null;
let isWalking = false;
let gpsAccuracy = 0;
let totalDistance = 0;
let lastPoint = null;

function startWalking() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    isWalking = true;
    walkPath = [];
    totalDistance = 0;
    lastPoint = null;
    
    drawnItems.clearLayers();
    if (walkPolyline) map.removeLayer(walkPolyline);

    walkPolyline = L.polyline([], { 
        color: '#10ac84', 
        weight: 6,
        opacity: 0.8,
        lineJoin: 'round'
    }).addTo(map);

    document.getElementById('start-walk-btn').classList.add('hidden');
    document.getElementById('stop-walk-btn').classList.remove('hidden');
    document.getElementById('dist-walked').textContent = '0m';

    speak('start');

    watchId = navigator.geolocation.watchPosition(
        position => {
            const { latitude, longitude, accuracy } = position.coords;
            gpsAccuracy = accuracy;
            
            updateGPSAccuracyUI(accuracy);

            // Filter noisy points (accuracy > 30m is considered poor)
            if (accuracy <= 30) {
                const currentPoint = [latitude, longitude];
                
                if (lastPoint) {
                    // Calculate distance from last point using Turf
                    const from = turf.point([lastPoint[1], lastPoint[0]]);
                    const to = turf.point([longitude, latitude]);
                    const distance = turf.distance(from, to, { units: 'meters' });

                    // Ignore movement < 3 meters to reduce jitter/noise
                    if (distance < 3) return;

                    totalDistance += distance;
                    document.getElementById('dist-walked').textContent = `${Math.round(totalDistance)}m`;
                }
                
                lastPoint = currentPoint;
                walkPath.push(currentPoint);
                walkPolyline.addLatLng(currentPoint);
                
                // Smoothly pan map
                map.panTo(currentPoint, { animate: true, duration: 0.5 });

                // LIVE area update while walking (if path has enough points)
                if (walkPath.length >= 3) {
                    const coords = walkPath.map(p => [p[1], p[0]]);
                    // Create a temporary closed polygon for live area calculation
                    const liveCoords = [...coords, coords[0]];
                    calculateAreaFromCoords(liveCoords);
                }
            }
        },
        error => {
            console.error("GPS Error:", error);
            let msg = translations[currentLang].gps_error_timeout;
            if (error.code === 1) msg = translations[currentLang].gps_error_denied;
            else if (error.code === 2) msg = translations[currentLang].gps_error_unavailable;
            alert(msg);
            stopWalking();
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}

function stopWalking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    isWalking = false;
    document.getElementById('start-walk-btn').classList.remove('hidden');
    document.getElementById('stop-walk-btn').classList.add('hidden');

    if (walkPath.length >= 3) {
        // Pre-process path: Simplify to remove jitter
        const geojsonPath = turf.lineString(walkPath.map(p => [p[1], p[0]]));
        const simplified = turf.simplify(geojsonPath, { tolerance: 0.00001, highQuality: true });
        const smoothedCoords = simplified.geometry.coordinates;

        const latLngs = smoothedCoords.map(p => [p[1], p[0]]);
        const polygon = L.polygon(latLngs, { 
            color: '#27ae60', // Boundary
            fillColor: '#2ecc71', // Fill
            fillOpacity: 0.35,
            weight: 3,
            lineJoin: 'round'
        });
        
        drawnItems.clearLayers();
        drawnItems.addLayer(polygon);
        
        if (walkPolyline) map.removeLayer(walkPolyline);
        walkPolyline = null;

        // Ensure closing point for area calculation
        const coords = [...smoothedCoords];
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push(coords[0]);
        }
        
        calculateAreaFromCoords(coords);
        
        speak('stop');
        setTimeout(() => {
            speakAreaResult(currentArea.acres, currentArea.guntas);
        }, 1500); // Small delay after "Measurement completed"
        showSummary();
    } else {
        alert("Walk path is too short to calculate area. Please walk around the boundary.");
        resetMeasurement();
    }
}

function showSummary() {
    document.getElementById('summary-acres').textContent = currentArea.acres;
    document.getElementById('summary-guntas').textContent = currentArea.guntas;
    document.getElementById('summary-hectares').textContent = currentArea.hectares;
    document.getElementById('summary-sqft').textContent = currentArea.sqft.toLocaleString();
    document.getElementById('summary-distance').textContent = `${Math.round(totalDistance)}m`;
    
    let accText = translations[currentLang].poor;
    if (gpsAccuracy < 10) accText = translations[currentLang].good;
    else if (gpsAccuracy < 30) accText = translations[currentLang].medium;
    
    document.getElementById('summary-accuracy').textContent = accText;
    document.getElementById('summary-date').textContent = new Date().toLocaleString();
    
    document.getElementById('summary-overlay').classList.remove('hidden');
}

function closeSummary() {
    document.getElementById('summary-overlay').classList.add('hidden');
}

function updateGPSAccuracyUI(accuracy) {
    const accuracyVal = document.getElementById('gps-accuracy-val');
    let text = translations[currentLang].poor;

    if (accuracy < 10) {
        text = translations[currentLang].good;
        accuracyVal.style.color = '#10ac84';
    } else if (accuracy < 30) {
        text = translations[currentLang].medium;
        accuracyVal.style.color = '#f1c40f';
    } else {
        accuracyVal.style.color = '#ee5253';
    }

    accuracyVal.textContent = `${text} (${Math.round(accuracy)}m)`;
}

