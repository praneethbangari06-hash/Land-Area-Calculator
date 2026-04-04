document.addEventListener('DOMContentLoaded', () => {
    initMap();
    updateUIStrings();
    loadHistory();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
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

function closeSummary() {
    document.getElementById('summary-overlay').classList.add('hidden');
}

function measureAgain() {
    closeSummary();
    resetMeasurement();
}

async function getAIAdvice() {
    const adviceBtn = document.getElementById('ai-advice-btn');
    const adviceCard = document.getElementById('ai-advice-card');
    const adviceText = document.getElementById('ai-advice-text');
    
    if (!currentArea || currentArea.acres === 0) {
        alert("Please measure some land first.");
        return;
    }

    adviceBtn.disabled = true;
    adviceBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
    
    try {
        const response = await fetch('/api/ai-advice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acres: parseFloat(currentArea.acres) })
        });

        if (response.ok) {
            const data = await response.json();
            adviceText.textContent = data.advice;
            adviceCard.classList.remove('hidden');
            // Scroll to advice
            adviceCard.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert("Failed to get AI advice.");
        }
    } catch (error) {
        console.error("AI Advice error:", error);
        alert("Error connecting to server.");
    } finally {
        adviceBtn.disabled = false;
        adviceBtn.innerHTML = `<i class="fas fa-robot"></i> Get AI Advice`;
    }
}

function exportKML() {
    if (!currentCoords || currentCoords.length === 0) return;
    
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Polam Calculator Measurement</name>
    <Placemark>
      <name>Land Polygon</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${currentCoords.map(c => `${c[0]},${c[1]},0`).join('\n              ')}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    downloadFile(kml, `polam_${new Date().toISOString().slice(0, 10)}.kml`, 'application/vnd.google-earth.kml+xml');
}

function exportGeoJSON() {
    if (!currentCoords || currentCoords.length === 0) return;
    
    const geojson = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            properties: {
                area_acres: currentArea.acres,
                area_guntas: currentArea.guntas,
                timestamp: new Date().toISOString()
            },
            geometry: {
                type: "Polygon",
                coordinates: [currentCoords]
            }
        }]
    };

    downloadFile(JSON.stringify(geojson, null, 2), `polam_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

async function downloadResultImage() {
    const summaryOverlay = document.getElementById('summary-overlay');
    const footer = summaryOverlay.querySelector('.summary-footer');
    
    // Temporarily hide footer buttons for a cleaner image
    footer.style.display = 'none';
    
    try {
        const canvas = await html2canvas(summaryOverlay, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scale: 2 // Higher quality
        });
        
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.download = `Land_Measurement_${dateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        alert(currentLang === 'te' ? "రిజల్ట్ డౌన్‌లోడ్ చేయబడింది!" : "Result image downloaded!");
    } catch (error) {
        console.error("Capture error:", error);
        alert("Failed to capture image.");
    } finally {
        footer.style.display = 'flex'; // Restore footer
    }
}

async function confirmSave() {
    const nameInput = document.getElementById('land-name');
    const landName = nameInput.value || translations[currentLang].unnamed;

    const landData = {
        name: landName,
        coordinates: currentCoords,
        area_acres: currentArea.acres,
        area_guntas: currentArea.guntas,
        area_hectares: currentArea.hectares,
        area_sqft: currentArea.sqft,
        area_sqm: currentArea.sqm,
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
                const date = land.timestamp ? new Date(land.timestamp).toLocaleDateString() : '--';
                const item = document.createElement('div');
                item.className = 'history-item';
                
                // Safety check for coordinates before using replace
                const coordsStr = land.coordinates ? JSON.stringify(land.coordinates).replace(/"/g, '&quot;') : '[]';
                
                item.innerHTML = `
                    <h4>${land.name || translations[currentLang].unnamed}</h4>
                    <p><i class="fas fa-calendar"></i> ${date}</p>
                    <p><i class="fas fa-chart-area"></i> ${land.area_acres || '0.000'} Acres (${land.area_guntas || 0} Guntas)</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${land.area_hectares || '0.00'} Hectares</p>
                    <span class="delete-btn" onclick="deleteLand('${land._id}')">
                        <i class="fas fa-trash"></i>
                    </span>
                    <button class="btn-secondary" style="margin-top: 10px; width: 100%;" onclick="viewLandOnMap(${coordsStr})">
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

    const polygon = L.polygon(latLngs, { 
        color: '#27ae60', // Dark green boundary
        fillColor: '#2ecc71', // Light green fill
        fillOpacity: 0.35,
        weight: 3,
        lineJoin: 'round'
    }).addTo(drawnItems);
    map.fitBounds(polygon.getBounds());
    
    // Update area results
    calculateAreaFromCoords(coordinates);
}
