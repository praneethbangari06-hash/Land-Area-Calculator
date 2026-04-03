let map, drawControl, drawnItems;
let currentMode = 'draw';
let currentArea = { acres: 0, sqm: 0, sqft: 0 };
let currentCoords = [];

function initMap() {
    // Initial view set to a default (can be updated to user location)
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([17.3850, 78.4867], 13); // Default to Hyderabad, India

    // Google Satellite Tiles
    const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3']
    }).addTo(map);

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
            marker: false,
            circlemarker: false
        }
    });

    if (currentMode === 'draw') {
        map.addControl(drawControl);
    }

    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        
        const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
        // Close polygon for Turf
        coords.push(coords[0]);
        calculateAreaFromCoords(coords);
        
        // Speak result in Draw mode too
        setTimeout(() => {
            speakAreaResult(currentArea.acres, currentArea.guntas);
        }, 500);
    });

    map.on(L.Draw.Event.EDITED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
            const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
            coords.push(coords[0]);
            calculateAreaFromCoords(coords);
        });
    });
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
    document.getElementById('area-acres').textContent = currentArea.acres;
    document.getElementById('area-guntas').textContent = currentArea.guntas;
    document.getElementById('area-sqft').textContent = currentArea.sqft.toLocaleString();
    document.getElementById('area-hectares').textContent = currentArea.hectares;
    document.getElementById('results-panel').classList.remove('hidden');
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
    currentArea = { acres: '0.000', guntas: 0, hectares: '0.00', sqft: 0, sqm: 0 };
    totalDistance = 0;
    
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
