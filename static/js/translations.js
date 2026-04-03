const translations = {
    en: {
        draw: "Draw",
        walk: "Walk",
        acres: "Acres",
        guntas: "Guntas",
        sqft: "Sq. Feet",
        hectares: "Hectares",
        sqm: "Sq. Meters",
        distance: "Distance",
        accuracy: "Accuracy",
        share: "Share",
        reset: "Reset",
        save: "Save",
        start: "Start Walking",
        stop: "Stop & Finish",
        history: "Saved Lands",
        save_land: "Save Land",
        cancel: "Cancel",
        confirm: "Save",
        summary: "Measurement Summary",
        total_area: "Total Area",
        total_distance: "Total Distance",
        avg_accuracy: "Avg. Accuracy",
        save_history: "Save to History",
        close: "Close",
        measure_again: "Measure Again",
        download_image: "Download Image",
        measurement_started: "Measurement started",
        keep_walking: "Keep walking around boundary",
        measurement_completed: "Measurement completed",
        good: "Good",
        medium: "Medium",
        poor: "Poor",
        enter_name: "Enter land name",
        unnamed: "Unnamed Land",
        delete_confirm: "Are you sure you want to delete this land?",
        gps_error_denied: "Please enable location permission to measure land.",
        gps_error_unavailable: "GPS is not working. Please stay in an open area.",
        gps_error_timeout: "GPS signal timed out. Please try again."
    },
    te: {
        draw: "డ్రా",
        walk: "నడక",
        acres: "ఎకరాలు",
        guntas: "గుంటలు",
        sqft: "చ.అడుగులు",
        hectares: "హెక్టార్లు",
        sqm: "చ.మీటర్లు",
        distance: "దూరం",
        accuracy: "ఖచ్చితత్వం",
        share: "షేర్",
        reset: "రీసెట్",
        save: "సేవ్ చేయండి",
        start: "ప్రారంభించండి",
        stop: "ఆపివేయి",
        history: "సేవ్ చేసిన భూములు",
        save_land: "భూమిని సేవ్ చేయండి",
        cancel: "రద్దు",
        confirm: "సేవ్",
        summary: "కొలత సారాంశం",
        total_area: "మొత్తం విస్తీర్ణం",
        total_distance: "మొత్తం దూరం",
        avg_accuracy: "సగటు ఖచ్చితత్వం",
        save_history: "హిస్టరీలో సేవ్ చేయండి",
        close: "ముగించు",
        measure_again: "మళ్ళీ కొలవండి",
        download_image: "రిజల్ట్ డౌన్‌లోడ్",
        measurement_started: "మీ భూమి కొలత ప్రారంభమైంది",
        keep_walking: "దయచేసి మీ భూమి చుట్టూ నడవండి",
        measurement_completed: "కొలత పూర్తయింది",
        good: "మంచిది",
        medium: "మధ్యస్థం",
        poor: "తక్కువ",
        enter_name: "భూమి పేరు నమోదు చేయండి",
        unnamed: "పేరు లేని భూమి",
        delete_confirm: "మీరు ఈ భూమిని తొలగించాలనుకుంటున్నారా?",
        area_result_te: "మీ భూమి విస్తీర్ణం",
        gps_error_denied: "దయచేసి లొకేషన్ పర్మిషన్ ఇవ్వండి. అప్పుడే కొలత సాధ్యమవుతుంది.",
        gps_error_unavailable: "మీ ఫోన్‌లో GPS పనిచేయడం లేదు. దయచేసి సిగ్నల్ వచ్చే చోట ఉండండి.",
        gps_error_timeout: "GPS సిగ్నల్ అందడం లేదు. దయచేసి మళ్ళీ ప్రయత్నించండి."
    }
};

let currentLang = 'en';

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'te' : 'en';
    document.getElementById('lang-btn').textContent = currentLang.toUpperCase();
    updateUIStrings();
}

function updateUIStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });
    
    // Update placeholders
    const nameInput = document.getElementById('land-name');
    if (nameInput) {
        nameInput.placeholder = translations[currentLang].enter_name;
    }
}
