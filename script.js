let excelData = [], selectedBras = "", selectedCity = "", lastRecognized = "";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) { recognition.lang = "fr-FR"; recognition.interimResults = false; }

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

window.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("tourneeData");
    if (saved) { excelData = JSON.parse(saved); refreshUI(); }
    checkDataWarning();

    // AUTO-SCROLL quand on clique sur la recherche
    const searchInput = document.getElementById("liveSearchInput");
    searchInput.addEventListener("focus", () => {
        setTimeout(() => {
            document.getElementById("liveSearchContainer").scrollIntoView({ behavior: 'smooth' });
        }, 300); // Petit délai pour laisser le clavier sortir
    });
});

function checkDataWarning() {
    const warning = document.getElementById("noFileWarning");
    if (warning) warning.style.display = (excelData.length > 0) ? "none" : "block";
}

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
        alert("Données importées !");
    };
    reader.readAsArrayBuffer(file);
});

function refreshUI() {
    const tbody = document.getElementById("adminTableBody");
    if (tbody) {
        tbody.innerHTML = "";
        excelData.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${row.BRAS}</td><td>${row.Ville}</td><td>${row.Adresse}</td><td>${row.Numero}</td>`;
            tbody.appendChild(tr);
        });
    }

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
    selectedBras = bras; selectedCity = "";
    document.querySelectorAll("#brasBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
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
}

document.getElementById("liveSearchInput").addEventListener("input", function() {
    const val = this.value.toLowerCase().trim();
    const resDiv = document.getElementById("liveSearchResults");
    document.getElementById("clearSearchBtn").style.display = val ? "flex" : "none";
    if (val.length < 2 || !selectedBras) { resDiv.innerHTML = ""; resDiv.style.display = "none"; return; }
    const filtered = excelData.filter(r => r.BRAS === selectedBras && (!selectedCity || r.Ville === selectedCity) && r.Adresse.includes(val));
    if (filtered.length > 0) {
        resDiv.style.display = "block";
        let html = `<table class="popup-table"><tbody>`;
        filtered.forEach(r => { html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`; });
        resDiv.innerHTML = html + "</tbody></table>";
    } else { resDiv.style.display = "none"; }
});

document.getElementById("clearSearchBtn").onclick = function() {
    document.getElementById("liveSearchInput").value = "";
    document.getElementById("liveSearchResults").style.display = "none";
    this.style.display = "none";
};

if (recognition) {
    document.getElementById("voiceBtn").onclick = () => {
        if (!selectedBras) { alert("Sélectionnez d'abord un BRAS"); return; }
        document.getElementById("liveSearchInput").value = "";
        document.getElementById("liveSearchResults").style.display = "none";
        playBeep();
        recognition.start();
        document.getElementById("voiceBtn").classList.add("listening");
        document.getElementById("statusText").textContent = "Dites le dernier mot...";
    };
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.toLowerCase();
        lastRecognized = transcript.split(" ").pop();
        document.getElementById("voiceConfirmText").textContent = `Rechercher : "${transcript}" ?`;
        document.getElementById("voiceConfirmBox").style.display = "flex";
    };
    recognition.onend = () => {
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Prêt.";
    };
}

document.getElementById("confirmBtn").onclick = () => {
    const filtered = excelData.filter(r => r.BRAS === selectedBras && (!selectedCity || r.Ville === selectedCity) && r.Adresse.includes(lastRecognized));
    if (filtered.length > 0) {
        let html = `<table class="popup-table"><tbody>`;
        filtered.forEach(r => { html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`; });
        document.getElementById("popupContent").innerHTML = html + "</tbody></table>";
        document.getElementById("popupOverlay").style.display = "flex";
    } else { alert("Aucun résultat."); }
    document.getElementById("voiceConfirmBox").style.display = "none";
};

document.getElementById("retryBtn").onclick = () => {
    document.getElementById("voiceConfirmBox").style.display = "none";
    document.getElementById("voiceBtn").click();
};

document.getElementById("popupClose").onclick = () => { document.getElementById("popupOverlay").style.display = "none"; };
document.getElementById("modeToggle").onclick = function() {
    const admin = document.getElementById("adminPanel"), user = document.getElementById("userPanel");
    const isUser = admin.style.display === "none";
    admin.style.display = isUser ? "block" : "none"; user.style.display = isUser ? "none" : "block";
    this.textContent = isUser ? "Accueil" : "Paramètres";
};
document.getElementById("clearStorageBtn").onclick = () => { if(confirm("Effacer tout ?")) { localStorage.clear(); location.reload(); } };