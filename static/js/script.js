document.addEventListener('DOMContentLoaded', () => {
    initMap();
    updateUIStrings();
    loadHistory();
});

function toggleHistory() {
    const sidebar = document.getElementById('history-sidebar');
    sidebar.classList.toggle('open');
}

function showSaveDialog() {
    if (currentArea.sqm === 0) {
        alert("Please draw or walk around a land area first.");
        return;
    }
    document.getElementById('save-modal').classList.remove('hidden');
}

function hideSaveDialog() {
    document.getElementById('save-modal').classList.add('hidden');
}

async function confirmSave() {
    const nameInput = document.getElementById('land-name');
    const landName = nameInput.value || translations[currentLang].unnamed;

    const landData = {
        name: landName,
        coordinates: currentCoords,
        area_acres: currentArea.acres,
        area_sqm: currentArea.sqm,
        area_sqft: currentArea.sqft,
        distance_m: typeof totalDistance !== 'undefined' ? Math.round(totalDistance) : 0
    };

    try {
        const response = await fetch('/api/save-land', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(landData)
        });

        if (response.ok) {
            alert("Land saved successfully!");
            nameInput.value = '';
            hideSaveDialog();
            closeSummary(); // Close summary if it was open
            loadHistory();
        } else {
            const err = await response.json();
            alert(`Error saving land: ${err.error}`);
        }
    } catch (error) {
        console.error("Save error:", error);
        alert("Could not connect to server.");
    }
}

function shareOnWhatsApp() {
    if (currentArea.sqm === 0) return;
    
    const text = `*Smart Land Area Calculator*%0A` +
                 `Area: ${currentArea.acres} Acres%0A` +
                 `Sq. Meters: ${currentArea.sqm.toLocaleString()}%0A` +
                 `Location: https://www.google.com/maps?q=${currentCoords[0][1]},${currentCoords[0][0]}`;
    
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<p style="text-align:center; padding: 20px;">Loading...</p>';

    try {
        const response = await fetch('/api/lands');
        if (response.ok) {
            const lands = await response.json();
            historyList.innerHTML = '';

            if (lands.length === 0) {
                historyList.innerHTML = '<p style="text-align:center; padding: 20px; color: #888;">No saved lands found.</p>';
                return;
            }

            lands.forEach(land => {
                const date = new Date(land.timestamp).toLocaleDateString();
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <h4>${land.name}</h4>
                    <p><i class="fas fa-calendar"></i> ${date}</p>
                    <p><i class="fas fa-chart-area"></i> ${land.area_acres} Acres</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${land.area_sqm.toLocaleString()} sqm</p>
                    <span class="delete-btn" onclick="deleteLand('${land._id}')">
                        <i class="fas fa-trash"></i>
                    </span>
                    <button class="btn-secondary" style="margin-top: 10px; width: 100%;" onclick="viewLandOnMap(${JSON.stringify(land.coordinates).replace(/"/g, '&quot;')})">
                        <i class="fas fa-eye"></i> View on Map
                    </button>
                `;
                historyList.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Load error:", error);
        historyList.innerHTML = '<p style="color:red; text-align:center;">Failed to load history.</p>';
    }
}

async function deleteLand(id) {
    if (!confirm(translations[currentLang].delete_confirm)) return;

    try {
        const response = await fetch(`/api/land/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadHistory();
        } else {
            alert("Failed to delete land.");
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error connecting to server.");
    }
}

function viewLandOnMap(coordinates) {
    if (!coordinates || coordinates.length === 0) return;

    // Reset everything first
    resetMeasurement();
    toggleHistory();

    // Map expects [lat, lng] for Leaflet polygons, but coordinates are stored as [lng, lat] for GeoJSON/Turf
    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
    
    // Remove last point if it's the same as first (it's closed for Turf, but Leaflet handles it)
    if (latLngs.length > 1 && latLngs[0][0] === latLngs[latLngs.length-1][0] && latLngs[0][1] === latLngs[latLngs.length-1][1]) {
        latLngs.pop();
    }

    const polygon = L.polygon(latLngs, { color: '#2ecc71', fillOpacity: 0.3 }).addTo(drawnItems);
    map.fitBounds(polygon.getBounds());
    
    // Update area results
    calculateAreaFromCoords(coordinates);
}
