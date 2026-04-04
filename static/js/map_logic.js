let map, drawControl, drawnItems;
let currentMode = 'draw';
let isEditing = false;
let editHandler = null;
let currentArea = { acres: 0, sqm: 0, sqft: 0 };
let currentCoords = [];
let manualPoints = []; // Track manual points for undo

function initMap() {
    // Initial view set to a default (can be updated to user location)
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([17.3850, 78.4867], 13); // Default to Hyderabad, India

    // ESRI World Imagery Tiles
    const esriWorldImagery = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
        { 
            attribution: 'Tiles © Esri', 
            maxZoom: 19 
        }
    ).addTo(map);

    // Feature group for drawn items
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Try to get user's current location to center map
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
        });
    }

    setupDrawControls();
}

function setupDrawControls() {
    drawControl = new L.Control.Draw({
        position: 'topright', // Move to top right to avoid overlap with our UI
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>Error:</strong> Polygon cannot intersect itself!'
                },
                shapeOptions: {
                    color: '#27ae60', // Dark green boundary
                    fillColor: '#2ecc71', // Light green fill
                    fillOpacity: 0.35,
                    weight: 3,
                    lineJoin: 'round'
                }
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: true, // Enable markers for manual point tracking
            circlemarker: false
        }
    });

    if (currentMode === 'draw') {
        map.addControl(drawControl);
    }

    // Tap detection for both mobile and desktop
    let touchStartTime = 0;
    let touchStartLatLng = null;
    let isMultiTouch = false;

    map.on('touchstart', function(e) {
        // Ignore multi-touch (pinch/zoom)
        if (e.originalEvent.touches.length > 1) {
            isMultiTouch = true;
            return;
        }
        isMultiTouch = false;
        touchStartTime = Date.now();
        touchStartLatLng = e.latlng;
    });

    map.on('touchend', function(e) {
        if (isMultiTouch) return;
        
        const duration = Date.now() - touchStartTime;
        // If it was a quick tap (less than 300ms), add a point
        if (duration < 300 && touchStartLatLng) {
            if (currentMode === 'draw' && !isEditing) {
                addManualPoint(touchStartLatLng);
            }
        }
        touchStartLatLng = null;
    });

    // Keep click for desktop, but prevent double trigger on mobile
    map.on('click', function(e) {
        // Only process click if it's not a simulated click from a recent touch
        const now = Date.now();
        if (now - touchStartTime > 500) {
            if (currentMode === 'draw' && !isEditing) {
                addManualPoint(e.latlng);
            }
        }
    });

    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        
        if (e.layerType === 'marker') {
            manualPoints.push(layer.getLatLng());
            updateManualPolygon();
            document.getElementById('undo-draw-btn').disabled = false;
            return;
        }

        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        
        const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
        // Close polygon for Turf
        const closedCoords = [...coords, coords[0]];
        calculateAreaFromCoords(closedCoords);
        
        // Speak result in Draw mode too
        setTimeout(() => {
            speakAreaResult(currentArea.acres, currentArea.guntas);
        }, 500);
    });

    map.on(L.Draw.Event.EDITED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
            const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
            const closedCoords = [...coords, coords[0]];
            calculateAreaFromCoords(closedCoords);
        });
    });
}

function addManualPoint(latlng) {
    manualPoints.push(latlng);
    updateManualPolygon();
    document.getElementById('undo-draw-btn').disabled = false;
}

function updateManualPolygon() {
    drawnItems.clearLayers();
    if (manualPoints.length === 0) return;

    // Redraw markers
    manualPoints.forEach(latlng => {
        L.circleMarker(latlng, {
            radius: 5,
            color: '#27ae60',
            fillColor: '#2ecc71',
            fillOpacity: 1
        }).addTo(drawnItems);
    });

    if (manualPoints.length < 2) return;

    // Sort points by angle from centroid to prevent crossing lines
    const sortedPoints = sortPointsByAngle(manualPoints);

    if (manualPoints.length === 2) {
        L.polyline(sortedPoints, { color: '#27ae60', weight: 3 }).addTo(drawnItems);
    } else {
        try {
            const polygon = L.polygon(sortedPoints, { 
                color: '#27ae60', 
                fillColor: '#2ecc71', 
                fillOpacity: 0.35,
                weight: 3
            }).addTo(drawnItems);
            
            const coords = sortedPoints.map(p => [p.lng, p.lat]);
            const closedCoords = [...coords, coords[0]];
            calculateAreaFromCoords(closedCoords);
        } catch (err) {
            console.error("Polygon error:", err);
        }
    }
}

function sortPointsByAngle(points) {
    if (points.length < 3) return points;

    // 1. Calculate centroid
    const centroid = points.reduce((acc, p) => ({
        lat: acc.lat + p.lat / points.length,
        lng: acc.lng + p.lng / points.length
    }), { lat: 0, lng: 0 });

    // 2. Sort by angle from centroid
    return [...points].sort((a, b) => {
        const angleA = Math.atan2(a.lat - centroid.lat, a.lng - centroid.lng);
        const angleB = Math.atan2(b.lat - centroid.lat, b.lng - centroid.lng);
        return angleA - angleB;
    });
}

function undoLastPoint() {
    if (manualPoints.length > 0) {
        manualPoints.pop();
        updateManualPolygon();
        if (manualPoints.length === 0) {
            document.getElementById('undo-draw-btn').disabled = true;
            resetMeasurement();
        }
    }
}

function calculateAreaFromCoords(coords) {
    if (!coords || coords.length < 3) return; 
    
    // 1. Remove duplicate points (except closing point for now)
    const points = coords.filter((coord, index) => {
        const next = coords[index + 1];
        if (!next) return true;
        return coord[0] !== next[0] || coord[1] !== next[1];
    });

    // 2. Remove closing point if it exists to sort clean
    if (points.length > 1 && points[0][0] === points[points.length-1][0] && points[0][1] === points[points.length-1][1]) {
        points.pop();
    }

    if (points.length < 3) return;

    // 3. Sort points by angle from centroid to prevent crossing lines
    const centroid = points.reduce((acc, p) => [acc[0] + p[0] / points.length, acc[1] + p[1] / points.length], [0, 0]);
    const sortedPoints = [...points].sort((a, b) => {
        return Math.atan2(a[1] - centroid[1], a[0] - centroid[0]) - Math.atan2(b[1] - centroid[1], b[0] - centroid[0]);
    });

    // 4. Always close the ring
    const finalCoords = [...sortedPoints, sortedPoints[0]];
    currentCoords = finalCoords;

    try {
        const polygon = turf.polygon([finalCoords]);
        const sqm = turf.area(polygon);
        
        // Accurate conversion factors
        const acres = sqm / 4046.86;
        const guntas = acres * 40;
        const hectares = sqm / 10000;
        const sqft = sqm * 10.7639;

        currentArea = {
            sqm: Math.round(sqm),
            acres: acres.toFixed(3),
            guntas: Math.round(guntas),
            hectares: hectares.toFixed(2),
            sqft: Math.round(sqft)
        };

        updateResultsUI();
    } catch (err) {
        console.error("Turf Area Calculation Error:", err);
    }
}

function updateResultsUI() {
    document.getElementById('area-acres').textContent = currentArea.acres;
    document.getElementById('area-guntas').textContent = currentArea.guntas;
    document.getElementById('area-sqft').textContent = currentArea.sqft.toLocaleString();
    document.getElementById('area-hectares').textContent = currentArea.hectares;
    document.getElementById('results-panel').classList.remove('hidden');
}

function toggleEditMode() {
    const editBtn = document.getElementById('edit-walk-btn');
    
    if (!isEditing) {
        // Start Editing
        isEditing = true;
        
        // Hide summary while editing
        closeSummary();
        
        editHandler = new L.EditToolbar.Edit(map, {
            featureGroup: drawnItems
        });
        editHandler.enable();
        
        editBtn.innerHTML = `<i class="fas fa-check"></i> <span data-i18n="finish_edit">${translations[currentLang].finish_edit}</span>`;
        editBtn.classList.replace('btn-secondary', 'btn-primary');
    } else {
        // Finish Editing
        isEditing = false;
        if (editHandler) {
            editHandler.save();
            editHandler.disable();
        }
        
        editBtn.innerHTML = `<i class="fas fa-edit"></i> <span data-i18n="edit">${translations[currentLang].edit}</span>`;
        editBtn.classList.replace('btn-primary', 'btn-secondary');
        
        // After editing, show summary again with updated values
        if (currentMode === 'walk') {
            showSummary();
        }
    }
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('draw-mode-btn').classList.toggle('active', mode === 'draw');
    document.getElementById('walk-mode-btn').classList.toggle('active', mode === 'walk');
    
    document.getElementById('draw-controls').classList.toggle('hidden', mode !== 'draw');
    document.getElementById('walk-controls').classList.toggle('hidden', mode !== 'walk');

    if (mode === 'draw') {
        map.addControl(drawControl);
    } else {
        map.removeControl(drawControl);
    }
    
    resetMeasurement();
}

function resetMeasurement() {
    if (drawnItems) drawnItems.clearLayers();
    if (typeof walkPolyline !== 'undefined' && walkPolyline) {
        map.removeLayer(walkPolyline);
        walkPolyline = null;
    }
    currentCoords = [];
    manualPoints = []; // Clear manual points
    currentArea = { acres: '0.000', guntas: 0, hectares: '0.00', sqft: 0, sqm: 0 };
    totalDistance = 0;
    
    // Reset AI Advice UI
    const adviceCard = document.getElementById('ai-advice-card');
    if (adviceCard) adviceCard.classList.add('hidden');
    
    // Reset editing state
    isEditing = false;
    if (editHandler) {
        editHandler.disable();
        editHandler = null;
    }
    const editBtn = document.getElementById('edit-walk-btn');
    if (editBtn) {
        editBtn.classList.add('hidden');
        editBtn.innerHTML = `<i class="fas fa-edit"></i> <span data-i18n="edit">${translations[currentLang].edit}</span>`;
        editBtn.classList.replace('btn-primary', 'btn-secondary');
    }
    
    document.getElementById('results-panel').classList.add('hidden');
    document.getElementById('area-acres').textContent = '0.000';
    document.getElementById('area-guntas').textContent = '0';
    document.getElementById('area-hectares').textContent = '0.00';
    document.getElementById('area-sqft').textContent = '0';
    document.getElementById('dist-walked').textContent = '0m';
    
    if (currentMode === 'walk' && isWalking) {
        stopWalking();
    }
}
