const translations = {
    en: {
        draw: "Draw",
        walk: "Walk",
        acres: "Acres",
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
        measurement_started: "Measurement started",
        keep_walking: "Keep walking around boundary",
        measurement_completed: "Measurement completed",
        good: "Good",
        medium: "Medium",
        poor: "Poor",
        enter_name: "Enter land name",
        unnamed: "Unnamed Land",
        delete_confirm: "Are you sure you want to delete this land?"
    },
    te: {
        draw: "డ్రా",
        walk: "నడక",
        acres: "ఎకరాలు",
        sqm: "చ.మీటర్లు",
        distance: "దూరం",
        accuracy: "ఖచ్చితత్వం",
        share: "షేర్",
        reset: "రీసెట్",
        save: "సేవ్",
        start: "ప్రారంభించు",
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
        measurement_started: "మీ భూమి కొలత ప్రారంభమైంది",
        keep_walking: "దయచేసి మీ భూమి చుట్టూ నడవండి",
        measurement_completed: "కొలత పూర్తయింది",
        good: "మంచిది",
        medium: "మధ్యస్థం",
        poor: "తక్కువ",
        enter_name: "భూమి పేరు నమోదు చేయండి",
        unnamed: "పేరు లేని భూమి",
        delete_confirm: "మీరు ఈ భూమిని తొలగించాలనుకుంటున్నారా?"
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
