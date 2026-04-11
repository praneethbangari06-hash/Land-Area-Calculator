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

// ----------------------------------------------------
// UI Logic for Results Panel & Animations
// ----------------------------------------------------

function showResultsPanel() {
    const overlay = document.getElementById('result-overlay');
    if (overlay) overlay.classList.remove('hidden');
    
    // Clear any previous values back to 0 visually BEFORE the delay begins
    document.getElementById('area-acres').textContent = '0.000';
    document.getElementById('area-guntas').textContent = '0';
    document.getElementById('area-hectares').textContent = '0.00';
    document.getElementById('area-sqft').textContent = '0';
    document.getElementById('dist-walked').textContent = '0m';

    // Trigger count-up animation sequentially (stagger effect)
    if (typeof currentArea !== 'undefined') {
        const staggerDelay = 250; // Delay between each animation starting
        let currentDelay = 0;

        setTimeout(() => {
            animateValue("area-acres", 0, parseFloat(currentArea.acres) || 0, 800, false);
        }, currentDelay);
        currentDelay += staggerDelay;

        setTimeout(() => {
            animateValue("area-guntas", 0, currentArea.guntas || 0, 700, true);
        }, currentDelay);
        currentDelay += staggerDelay;

        setTimeout(() => {
            animateValue("area-hectares", 0, parseFloat(currentArea.hectares) || 0, 700, false);
        }, currentDelay);
        currentDelay += staggerDelay;

        setTimeout(() => {
            animateValue("area-sqft", 0, currentArea.sqft || 0, 900, true, true);
        }, currentDelay);
        currentDelay += staggerDelay;

        if (typeof totalDistance !== 'undefined') {
            setTimeout(() => {
                animateValue("dist-walked", 0, totalDistance, 600, true, false, 'm');
            }, currentDelay);
        }
    }
}

function hideResultsPanel(event) {
    // If event exists, ensure we only close if clicking the background or close button directly
    if (event && event.type === 'click' && event.target.id !== 'result-overlay' && !event.target.classList.contains('close-card-btn')) {
        return;
    }
    const overlay = document.getElementById('result-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        // Add a class that visually applies the swipe-down if triggered via touch, but the default css transition will fade and scale it normally too.
        overlay.classList.add('hidden');
    }
}

// Swipe down to close for Mobile UX
let cardTouchStartY = 0;
let cardTouchCurrentY = 0;

window.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('result-overlay');
    const card = document.getElementById('results-panel');
    
    if (overlay && card) {
        overlay.addEventListener('touchstart', (e) => {
            // Only capture single touches
            if (e.touches.length === 1) {
                cardTouchStartY = e.touches[0].clientY;
                cardTouchCurrentY = cardTouchStartY;
                card.style.transition = 'none'; // Disable transition during drag for immediate feedback
            }
        }, { passive: true });

        overlay.addEventListener('touchmove', (e) => {
            if (cardTouchStartY === 0) return;
            cardTouchCurrentY = e.touches[0].clientY;
            let diff = cardTouchCurrentY - cardTouchStartY;
            
            // Only allow dragging downwards
            if (diff > 0) {
                card.style.transform = `translateY(${diff}px) scale(1)`;
                card.style.opacity = Math.max(1 - (diff / 300), 0.3); // Fade out slightly as dragged
            }
        }, { passive: true });

        overlay.addEventListener('touchend', (e) => {
            if (cardTouchStartY === 0) return;
            let diff = cardTouchCurrentY - cardTouchStartY;
            
            // Re-enable smooth transitions
            card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.4s ease';
            
            // If swiped down more than 70px, close the card
            if (diff > 70) {
                hideResultsPanel();
                // Reset card inline styles so hidden CSS takes over
                setTimeout(() => {
                    card.style.transform = '';
                    card.style.opacity = '';
                }, 400); // After transition finishes
            } else {
                // Bounce back
                card.style.transform = 'translateY(0) scale(1)';
                card.style.opacity = '1';
                setTimeout(() => {
                    card.style.transform = '';
                    card.style.opacity = '';
                }, 400);
            }
            
            cardTouchStartY = 0;
        }, { passive: true });
    }
});

/**
 * Animates a number counting up from start to end.
 * @param {string} id - The DOM element ID to update
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} duration - Animation duration in ms
 * @param {boolean} isInteger - Whether to round to whole numbers
 * @param {boolean} useLocale - Whether to add commas for large numbers
 * @param {string} suffix - Optional string suffix (e.g. 'm' for meters)
 */
function animateValue(id, start, end, duration, isInteger, useLocale = false, suffix = '') {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    if (start === end || isNaN(end)) {
        let finalStr = isInteger ? Math.round(end).toString() : end.toFixed(3);
        if (useLocale) finalStr = Math.round(end).toLocaleString();
        obj.textContent = finalStr + suffix;
        return;
    }
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing out quintic for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 5);
        let currentVal = start + easeProgress * (end - start);
        
        let displayStr;
        if (isInteger) {
            displayStr = Math.round(currentVal).toString();
            if (useLocale) displayStr = Math.round(currentVal).toLocaleString();
        } else {
            // Check if it's hectares (needs 2 decimals) vs acres (needs 3)
            let decimals = id === "area-hectares" ? 2 : 3;
            displayStr = currentVal.toFixed(decimals);
        }
        
        obj.textContent = displayStr + suffix;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Force final exact value
            let finalStr = isInteger ? Math.round(end).toString() : end.toFixed(id === "area-hectares" ? 2 : 3);
            if (useLocale) finalStr = Math.round(end).toLocaleString();
            obj.textContent = finalStr + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

// Ensure map behaves nicely after smooth scrolling
function enterApp() {
    const landing = document.getElementById('landing-page');
    if (landing && !landing.classList.contains('scrolled-up')) {
        landing.classList.add('scrolled-up');
        setTimeout(() => {
            landing.style.display = 'none';
            if (typeof map !== 'undefined' && map.invalidateSize) {
                map.invalidateSize();
            }
        }, 1000); // 1s matches our CSS transition
    }
}

// Track mouse wheel down to scroll
window.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) {
        enterApp();
    }
}, { passive: true });

// Track touch swipe up to scroll
let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!touchStartY) return;
    let touchEndY = e.touches[0].clientY;
    if (touchStartY - touchEndY > 50) { 
        enterApp();
    }
}, { passive: true });
