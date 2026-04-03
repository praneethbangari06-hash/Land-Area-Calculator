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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
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
                    color: '#2ecc71',
                    fillOpacity: 0.3
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
    if (coords.length < 4) return; // Need at least 3 points + 1 closing point
    
    currentCoords = coords;
    const polygon = turf.polygon([coords]);
    const sqm = turf.area(polygon);
    const acres = sqm * 0.000247105;
    const sqft = sqm * 10.7639;

    currentArea = {
        sqm: Math.round(sqm),
        acres: acres.toFixed(3),
        sqft: Math.round(sqft)
    };

    updateResultsUI();
}

function updateResultsUI() {
    document.getElementById('area-acres').textContent = currentArea.acres;
    document.getElementById('area-sqm').textContent = currentArea.sqm.toLocaleString();
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
    currentArea = { acres: '0.000', sqm: 0, sqft: 0 };
    totalDistance = 0;
    
    document.getElementById('results-panel').classList.add('hidden');
    document.getElementById('area-acres').textContent = '0.000';
    document.getElementById('area-sqm').textContent = '0';
    document.getElementById('dist-walked').textContent = '0m';
    
    if (currentMode === 'walk' && isWalking) {
        stopWalking();
    }
}
