const synth = window.speechSynthesis;

const voiceMessages = {
    en: {
        start: "Measurement started. Keep walking around your land boundary.",
        stop: "Measurement completed. Total area calculated.",
        reset: "Measurement reset."
    },
    te: {
        start: "మీ భూమి కొలత ప్రారంభమైంది. దయచేసి మీ భూమి చుట్టూ నడవండి.",
        stop: "కొలత పూర్తయింది. మొత్తం విస్తీర్ణం లెక్కించబడింది.",
        reset: "కొలత రీసెట్ చేయబడింది."
    }
};

function speak(key) {
    if (!synth) return;
    
    // Vibrate phone if supported
    if ("vibrate" in navigator) {
        if (key === 'start') navigator.vibrate([100, 50, 100]);
        if (key === 'stop') navigator.vibrate(200);
    }

    // Stop any current speech
    synth.cancel();

    const text = voiceMessages[currentLang][key];
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find appropriate voice for language
    const voices = synth.getVoices();
    const langCode = currentLang === 'te' ? 'te-IN' : 'en-US';
    
    const voice = voices.find(v => v.lang.includes(langCode));
    if (voice) {
        utterance.voice = voice;
    }
    
    utterance.lang = langCode;
    utterance.pitch = 1.0;
    utterance.rate = 0.9;
    
    synth.speak(utterance);
}

// Ensure voices are loaded
window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
};
