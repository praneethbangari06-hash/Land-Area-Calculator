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

    // Add direct map click handler for easier drawing on mobile
    map.on('click', onMapClick);
    
    // Add touch support for mobile
    map.on('touchstart', function(e) {
        if (e.originalEvent.touches.length > 1) return; // Ignore multi-touch
        onMapClick(e);
    });
    
    map.on('touchend', function(e) {
        // Handle if needed, but touchstart is usually enough for single tap
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

function onMapClick(e) {
    if (currentMode === 'draw' && !isEditing) {
        // Prevent default touch behavior if it's a touch event
        if (e.originalEvent && e.originalEvent.preventDefault) {
            // e.originalEvent.preventDefault(); // Sometimes this blocks map pan
        }
        
        manualPoints.push(e.latlng);
        updateManualPolygon();
        document.getElementById('undo-draw-btn').disabled = false;
    }
}

function updateManualPolygon() {
    drawnItems.clearLayers();
    if (manualPoints.length === 0) return;

    // Redraw all markers
    manualPoints.forEach((latlng, index) => {
        L.circleMarker(latlng, {
            radius: 5,
            color: '#27ae60',
            fillColor: '#2ecc71',
            fillOpacity: 1
        }).addTo(drawnItems);
    });

    if (manualPoints.length < 2) return;

    if (manualPoints.length === 2) {
        // Draw line for 2 points
        L.polyline(manualPoints, { 
            color: '#27ae60', 
            weight: 3,
            dashArray: '5, 10' // Dashed line until it becomes a polygon
        }).addTo(drawnItems);
    } else {
        // SORT POINTS TO PREVENT CROSSING LINES (Angle-based Ordering)
        // 1. Calculate centroid
        const centroid = manualPoints.reduce((acc, curr) => {
            return { lat: acc.lat + curr.lat / manualPoints.length, lng: acc.lng + curr.lng / manualPoints.length };
        }, { lat: 0, lng: 0 });

        // 2. Sort by angle from centroid
        const sortedPoints = [...manualPoints].sort((a, b) => {
            const angleA = Math.atan2(a.lat - centroid.lat, a.lng - centroid.lng);
            const angleB = Math.atan2(b.lat - centroid.lat, b.lng - centroid.lng);
            return angleA - angleB;
        });

        // Create closed coordinate ring for turf
        const coords = sortedPoints.map(p => [p.lng, p.lat]);
        const closedCoords = [...coords, coords[0]];
        
        // Use turf.polygon to validate and redraw
        try {
            const polygonFeature = turf.polygon([closedCoords]);
            
            // Clear previous layers again just to be sure
            drawnItems.clearLayers();
            
            // Redraw markers
            manualPoints.forEach(latlng => {
                L.circleMarker(latlng, {
                    radius: 5,
                    color: '#27ae60',
                    fillColor: '#2ecc71',
                    fillOpacity: 1
                }).addTo(drawnItems);
            });

            // Add the polygon layer using sorted points
            L.polygon(sortedPoints, { 
                color: '#27ae60', 
                fillColor: '#2ecc71', 
                fillOpacity: 0.35,
                weight: 3,
                lineJoin: 'round'
            }).addTo(drawnItems);

            calculateAreaFromCoords(closedCoords);
        } catch (error) {
            console.error("Turf Polygon Error:", error);
            // Fallback to simple polyline if turf fails (e.g., self-intersection)
            L.polyline(sortedPoints, { color: '#e74c3c', weight: 3 }).addTo(drawnItems);
        }
    }
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
    if (!coords || coords.length < 4) return; // Need at least 3 unique points + 1 closing point
    
    // Remove duplicate consecutive points
    const uniqueCoords = coords.filter((coord, index) => {
        if (index === 0) return true;
        const prev = coords[index - 1];
        return coord[0] !== prev[0] || coord[1] !== prev[1];
    });

    if (uniqueCoords.length < 4) return;

    currentCoords = uniqueCoords;
    const polygon = turf.polygon([uniqueCoords]);
    const sqm = turf.area(polygon);
    
    // Accurate conversion factors
    // 1 Acre = 4046.86 sqm
    // 1 Acre = 40 Guntas
    // 1 Gunta = 101.17 sqm (approx)
    // 1 Hectare = 10000 sqm
    // 1 Acre = 43560 sqft
    
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
}

function updateResultsUI() {
    // Only update inner text, do not force the panel to show automatically.
    document.getElementById('area-acres').textContent = currentArea.acres;
    document.getElementById('area-guntas').textContent = currentArea.guntas;
    document.getElementById('area-sqft').textContent = currentArea.sqft.toLocaleString();
    document.getElementById('area-hectares').textContent = currentArea.hectares;
    
    // If the panel is ALREADY open, trigger count-up on new values
    const panel = document.getElementById('result-overlay');
    if (panel && !panel.classList.contains('hidden')) {
        animateValue("area-acres", 0, parseFloat(currentArea.acres), 800, false);
        animateValue("area-guntas", 0, currentArea.guntas, 800, true);
        animateValue("area-sqft", 0, currentArea.sqft, 800, true, true);
        animateValue("area-hectares", 0, parseFloat(currentArea.hectares), 800, false);
    }
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
    
    const panel = document.getElementById('result-overlay');
    if(panel) panel.classList.add('hidden');
    
    document.getElementById('area-acres').textContent = '0.000';
    document.getElementById('area-guntas').textContent = '0';
    document.getElementById('area-hectares').textContent = '0.00';
    document.getElementById('area-sqft').textContent = '0';
    document.getElementById('dist-walked').textContent = '0m';
    
    if (currentMode === 'walk' && isWalking) {
        stopWalking();
    }
}

// AI Feature Functions
async function getAIAdvice() {
    if (!currentArea.acres || parseFloat(currentArea.acres) === 0) {
        alert("Please measure an area first.");
        return;
    }

    const card = document.getElementById('ai-result-card');
    const content = document.getElementById('ai-content');
    const loading = document.getElementById('ai-loading');

    card.classList.remove('hidden');
    content.innerHTML = '';
    loading.classList.remove('hidden');

    try {
        const response = await fetch('/api/ai-advice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                area: currentArea.acres,
                location: "Telangana", // Default to Telangana as requested
                season: new Date().getMonth() > 5 && new Date().getMonth() < 10 ? "Kharif (Rainy)" : "Rabi (Winter)"
            })
        });

        const data = await response.json();
        loading.classList.add('hidden');

        if (data.advice) {
            content.innerHTML = `<strong>🌱 AI Land Health Advisor</strong><br><br>${data.advice.replace(/\n/g, '<br>')}`;
        } else {
            content.innerHTML = `<span style="color: #e74c3c;">Error: ${data.error || "Failed to get advice"}</span>`;
        }
    } catch (error) {
        loading.classList.add('hidden');
        content.innerHTML = `<span style="color: #e74c3c;">Connection Error: ${error.message}</span>`;
    }
}


function closeAICard() {
    document.getElementById('ai-result-card').classList.add('hidden');
}
