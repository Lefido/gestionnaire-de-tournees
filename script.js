let excelData = [], selectedBras = "", selectedCity = "", lastRecognized = "";

// Initialisation reconnaissance vocale
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) { 
    recognition.lang = "fr-FR"; 
    recognition.interimResults = false; 
}

// Utilitaire : Supprimer les accents pour une recherche plus flexible
const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function playBeep() {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.connect(gain); gain.connect(context.destination);
        osc.frequency.value = 800; osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.1);
        osc.stop(context.currentTime + 0.1);
    } catch(e) {}
}

function vibrateOnClick() {
    if (navigator.vibrate) {
        navigator.vibrate(100); // Vibration de 100ms
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("tourneeData");
    if (saved) {
        excelData = JSON.parse(saved);
        refreshUI();
    }
    checkDataWarning();
    document.getElementById("titleVille").style.display = "none";
    positionVoiceZone();
    window.addEventListener('resize', positionVoiceZone);

    // AUTO-SCROLL : Garder l'input en haut de l'écran quand le clavier sort
    const searchInput = document.getElementById("liveSearchInput");
    const searchContainer = document.getElementById("liveSearchContainer");

    searchInput.addEventListener("focus", () => {
        searchInput.classList.add('fixed-input');
        const results = document.getElementById('liveSearchResults');
        results.style.position = 'fixed';
        results.style.top = '130px';
        results.style.left = '50%';
        results.style.transform = 'translateX(-50%)';
        results.style.width = searchInput.offsetWidth + 'px';
        results.style.zIndex = '1000';
        results.style.background = 'var(--bg-panel)';
        results.style.borderRadius = '8px';
        results.style.maxHeight = '60vh';
        results.style.overflowY = 'auto';
        const clearBtn = document.getElementById('clearSearchBtn');
        clearBtn.style.position = 'fixed';
        clearBtn.style.top = (80 + searchInput.offsetHeight / 2 - 12) + 'px';
        clearBtn.style.right = 'calc(50% - ' + (searchInput.offsetWidth / 2) + 'px + 12px)';
        clearBtn.style.zIndex = '102';
    });

    searchInput.addEventListener("blur", () => {
        searchInput.classList.remove('fixed-input');
        searchInput.value = '';
        const results = document.getElementById('liveSearchResults');
        results.innerHTML = '';
        results.style.display = 'none';
        results.style.position = '';
        results.style.top = '';
        results.style.left = '';
        results.style.transform = '';
        results.style.width = '';
        results.style.zIndex = '';
        results.style.background = '';
        results.style.borderRadius = '';
        results.style.maxHeight = '';
        results.style.overflowY = '';
        const clearBtn = document.getElementById('clearSearchBtn');
        clearBtn.style.position = '';
        clearBtn.style.top = '';
        clearBtn.style.right = '';
        clearBtn.style.zIndex = '';
    });

    // Vérification disponibilité reconnaissance vocale et feedback UI
    const voiceBtn = document.getElementById("voiceBtn");
    const statusText = document.getElementById("statusText");
    if (!recognition) {
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.setAttribute('aria-disabled', 'true');
        }
        if (statusText) statusText.textContent = "Commande vocale non disponible";
    } else {
        if (statusText && statusText.textContent.trim() === '') statusText.textContent = "Prêt.";
    }
    // Masquer explicitement la boîte de confirmation vocale au chargement
    const voiceConfirmBox = document.getElementById("voiceConfirmBox");
    if (voiceConfirmBox) { voiceConfirmBox.classList.add('hidden'); voiceConfirmBox.style.display = 'none'; }
    // Masquer la popup vocale au chargement
    const voicePopupOverlay = document.getElementById("voicePopupOverlay");
    if (voicePopupOverlay) { voicePopupOverlay.classList.add('hidden'); voicePopupOverlay.style.display = 'none'; }

    // Ajouter vibration à tous les boutons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', vibrateOnClick);
    });
});

function checkDataWarning() {
    const warning = document.getElementById("noFileWarning");
    if (warning) warning.style.display = (excelData.length > 0) ? "none" : "block";
    
    const brasTitle = document.querySelector('#userPanel h2:first-of-type');
    const brasContainer = document.getElementById('brasBtnContainer');
    const searchContainer = document.getElementById('liveSearchContainer');
    const voiceZone = document.querySelector('.voice-zone');
    const hasData = excelData.length > 0;
    const hasSelected = selectedBras !== "";
    if (brasTitle) brasTitle.style.display = hasData ? "block" : "none";
    if (brasContainer) brasContainer.style.display = hasData ? "flex" : "none";
    if (searchContainer) searchContainer.style.display = (hasData && hasSelected) ? "block" : "none";
    if (voiceZone) voiceZone.style.display = (hasData && hasSelected) ? "flex" : "none";
}

// Importation Excel
document.getElementById("excelFile").addEventListener("change", function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        excelData = XLSX.utils.sheet_to_json(sheet).map(row => ({
            BRAS: String(row.BRAS || "").trim().toLowerCase(),
            Ville: String(row.Ville || "").trim().toLowerCase(),
            Adresse: String(row.Adresse || "").trim().toLowerCase(),
            Numero: String(row["Numéro de tournée"] || row["Numéro"] || "").trim()
        }));
        localStorage.setItem("tourneeData", JSON.stringify(excelData));
        refreshUI();
        checkDataWarning();
        alert("Données importées avec succès !");
    };
    reader.readAsArrayBuffer(file);
});

function refreshUI() {
    // Remplissage tableau Admin
    const tbody = document.getElementById("adminTableBody");
    if (tbody) {
        tbody.innerHTML = "";
        excelData.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${row.BRAS}</td><td>${row.Ville}</td><td>${row.Adresse}</td><td>${row.Numero}</td>`;
            tbody.appendChild(tr);
        });
    }

    // Génération boutons BRAS
    const brasUniques = [...new Set(excelData.map(r => r.BRAS))].filter(b => b).sort();
    const container = document.getElementById("brasBtnContainer"); 
    if (container) {
        container.innerHTML = "";
        brasUniques.forEach((bras, index) => {
            const btn = document.createElement("button"); 
            btn.className = "city-btn city-appear"; 
            btn.style.animationDelay = (index * 0.05) + "s";
            btn.textContent = bras;
            btn.onclick = () => selectBras(bras, btn); 
            container.appendChild(btn);
        });
    }
}

function selectBras(bras, btn) {
    selectedBras = bras; 
    selectedCity = "";
    
    // UI Reset
    document.querySelectorAll("#brasBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("liveSearchInput").value = "";
    document.getElementById("liveSearchResults").style.display = "none";
    
    // Villes
    document.getElementById("titleVille").style.display = "block";
    const villes = [...new Set(excelData.filter(r => r.BRAS === bras).map(r => r.Ville))].filter(v => v).sort();
    const cityContainer = document.getElementById("cityBtnContainer");
    cityContainer.innerHTML = "";
    villes.forEach((v, index) => {
        const vBtn = document.createElement("button"); 
        vBtn.className = "city-btn city-appear"; 
        vBtn.style.animationDelay = (index * 0.03) + "s";
        vBtn.textContent = v;
        vBtn.onclick = () => {
            selectedCity = v;
            document.querySelectorAll("#cityBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
            vBtn.classList.add("active");
        };
        cityContainer.appendChild(vBtn);
    });
    document.getElementById("liveSearchContainer").style.display = "block";
    document.querySelector('.voice-zone').style.display = "flex";
    positionVoiceZone();
}

// Recherche Live
document.getElementById("liveSearchInput").addEventListener("input", function() {
    const val = normalize(this.value.trim());
    const resDiv = document.getElementById("liveSearchResults");
    document.getElementById("clearSearchBtn").style.display = val ? "flex" : "none";

    if (val.length < 2 || !selectedBras) { 
        resDiv.innerHTML = ""; resDiv.style.display = "none"; return; 
    }

    const filtered = excelData.filter(r => 
        r.BRAS === selectedBras && 
        (!selectedCity || r.Ville === selectedCity) && 
        normalize(r.Adresse).includes(val)
    );

    if (filtered.length > 0) {
        resDiv.style.display = "block";
        let html = `<table class="popup-table"><tbody>`;
        filtered.forEach(r => { 
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`; 
        });
        resDiv.innerHTML = html + "</tbody></table>";
    } else { 
        resDiv.style.display = "none"; 
    }
});

document.getElementById("clearSearchBtn").onclick = function() {
    document.getElementById("liveSearchInput").value = "";
    document.getElementById("liveSearchResults").style.display = "none";
    this.style.display = "none";
};

// Reconnaissance Vocale
if (recognition) {
    document.getElementById("voiceBtn").onclick = () => {
        if (!selectedBras) { alert("Sélectionnez d'abord un BRAS"); return; }
        playBeep();
        try {
            recognition.start();
            document.getElementById("voiceBtn").classList.add("listening");
            document.getElementById("statusText").textContent = "J'écoute...";
        } catch (err) {
            console.error('Erreur démarrage reconnaissance vocale:', err);
            alert('Impossible de démarrer la reconnaissance vocale. Vérifiez les permissions du micro et le contexte (HTTPS).');
            document.getElementById("statusText").textContent = "Erreur micro";
        }
    };

    recognition.onresult = (e) => {
        const transcript = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) ? e.results[0][0].transcript.toLowerCase() : '';
        lastRecognized = transcript ? transcript.split(" ").pop() : '' ; // Prend le dernier mot
        document.getElementById("voiceConfirmText").textContent = `Chercher "${lastRecognized}" ?`;
        const box = document.getElementById("voicePopupOverlay");
        if (box) { box.classList.remove('hidden'); box.style.display = 'flex'; }
    };

    recognition.onerror = (evt) => {
        console.error('Speech recognition error', evt);
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Erreur reconnaissance";
        alert('Erreur reconnaissance vocale : ' + (evt.error || 'inconnue'));
    };

    recognition.onnomatch = () => {
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Aucun résultat";
    };

    recognition.onend = () => {
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Prêt.";
    };
}

document.getElementById("confirmBtn").onclick = () => {
    const val = normalize(lastRecognized);
    const filtered = excelData.filter(r => 
        r.BRAS === selectedBras && 
        (!selectedCity || r.Ville === selectedCity) && 
        normalize(r.Adresse).includes(val)
    );

    if (filtered.length > 0) {
        let html = `<table class="popup-table"><tbody>`;
        filtered.forEach(r => { 
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`; 
        });
        document.getElementById("popupContent").innerHTML = html + "</tbody></table>";
        document.getElementById("popupOverlay").style.display = "flex";
    } else { 
        alert("Aucun résultat pour : " + lastRecognized); 
    }
    const vBox = document.getElementById("voicePopupOverlay");
    if (vBox) { vBox.classList.add('hidden'); vBox.style.display = 'none'; }
};

// Interface Modals & Panels
document.getElementById("retryBtn").onclick = () => {
    const vBox2 = document.getElementById("voicePopupOverlay");
    if (vBox2) { vBox2.classList.add('hidden'); vBox2.style.display = 'none'; }
    document.getElementById("voiceBtn").click();
};

document.getElementById("cancelBtn").onclick = () => {
    const vBox3 = document.getElementById("voicePopupOverlay");
    if (vBox3) { vBox3.classList.add('hidden'); vBox3.style.display = 'none'; }
    document.getElementById("statusText").textContent = "Annulé.";
};

document.getElementById("popupClose").onclick = () => { 
    document.getElementById("popupOverlay").style.display = "none"; 
};

document.getElementById("modeToggle").onclick = function() {
    const admin = document.getElementById("adminPanel"), user = document.getElementById("userPanel");
    const adminHidden = admin.classList.contains('hidden');
    if (adminHidden) {
        admin.classList.remove('hidden'); admin.style.display = 'block';
        user.classList.add('hidden'); user.style.display = 'none';
        this.textContent = 'Accueil';
    } else {
        admin.classList.add('hidden'); admin.style.display = 'none';
        user.classList.remove('hidden'); user.style.display = 'block';
        document.getElementById("titleVille").style.display = "none";
        this.textContent = 'Paramètres';
    }
};

document.getElementById("clearStorageBtn").onclick = () => {
    if(confirm("Voulez-vous vraiment effacer toutes les données chargées ?")) {
        localStorage.clear(); location.reload();
    }
};

function positionVoiceZone() {
    const voiceZone = document.querySelector('.voice-zone');
    const searchContainer = document.getElementById('liveSearchContainer');
    const footer = document.querySelector('.app-footer');
    if (!voiceZone || !searchContainer || !footer) return;

    const searchRect = searchContainer.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const voiceZoneHeight = voiceZone.offsetHeight;

    // Calculate the center position between search input and footer
    const searchBottom = searchRect.bottom;
    const footerTop = footerRect.top;
    const availableSpace = footerTop - searchBottom;
    const centerY = searchBottom + (availableSpace / 2) - (voiceZoneHeight / 2);

    // Position the voice zone absolutely
    voiceZone.style.position = 'absolute';
    voiceZone.style.top = centerY + 'px';
    voiceZone.style.left = '50%';
    voiceZone.style.transform = 'translateX(-50%)';
    voiceZone.style.zIndex = '10';
}
