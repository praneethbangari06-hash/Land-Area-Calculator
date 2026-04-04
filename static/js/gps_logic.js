let watchId = null;
let walkPath = [];
let walkPolyline = null;
let isWalking = false;
let gpsAccuracy = 0;
let totalDistance = 0;
let lastPoint = null;
let lastSampleTime = 0;

function startWalking() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    isWalking = true;
    walkPath = [];
    totalDistance = 0;
    lastPoint = null;
    lastSampleTime = 0;
    
    drawnItems.clearLayers();
    if (walkPolyline) map.removeLayer(walkPolyline);
    
    // Hide edit button when starting new walk
    document.getElementById('edit-walk-btn').classList.add('hidden');

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

            const currentTime = Date.now();
            // STEP 2: Control Point Sampling (every 2-3 seconds)
            // Removed aggressive multi-sample averaging to fix mobile buffering/irritation
            if (walkPath.length > 0 && currentTime - lastSampleTime < 2500) return;

            // Filter noisy points (accuracy > 30m is considered poor)
            if (accuracy <= 30) {
                const currentPoint = [latitude, longitude];
                
                if (lastPoint) {
                    const from = turf.point([lastPoint[1], lastPoint[0]]);
                    const to = turf.point([longitude, latitude]);
                    const distance = turf.distance(from, to, { units: 'meters' });

                    // STEP 1: GPS NOISE FILTERING (Ignore movement < 3 meters)
                    if (distance < 3) return;

                    totalDistance += distance;
                    document.getElementById('dist-walked').textContent = `${Math.round(totalDistance)}m`;
                }
                
                lastPoint = currentPoint;
                lastSampleTime = currentTime;
                walkPath.push(currentPoint);
                walkPolyline.addLatLng(currentPoint);
                
                map.panTo(currentPoint, { animate: true, duration: 0.5 });

                if (walkPath.length >= 3) {
                    const coords = walkPath.map(p => [p[1], p[0]]);
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
        
        // Show edit button after walking
        document.getElementById('edit-walk-btn').classList.remove('hidden');
        
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
    const accuracyBadge = document.getElementById('accuracy-badge');
    const accuracyText = document.getElementById('accuracy-text');
    
    accuracyText.textContent = `📍 Accuracy: ±${Math.round(accuracy)}m`;
    
    accuracyBadge.classList.remove('accuracy-good', 'accuracy-medium', 'accuracy-poor');
    
    if (accuracy < 5) {
        accuracyBadge.classList.add('accuracy-good');
    } else if (accuracy <= 10) {
        accuracyBadge.classList.add('accuracy-medium');
    } else {
        accuracyBadge.classList.add('accuracy-poor');
        // Notify user to move to open area
        const warning = currentLang === 'te' 
            ? "మెరుగైన ఖచ్చితత్వం కోసం ఖాళీ ప్రదేశానికి వెళ్ళండి" 
            : "Move to open area for better accuracy";
        
        // We can show this as a toast or small text if needed
        console.log(warning);
    }
}

