function normalizeText(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/œ/g, "oe")
        .replace(/æ/g, "ae")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 900;
        gain.gain.value = 0.2;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

const modeToggle = document.getElementById("modeToggle");
const adminPanel = document.getElementById("adminPanel");
const userPanel = document.getElementById("userPanel");

modeToggle.addEventListener("click", () => {
    const settingsVisible = adminPanel.style.display === "block";

    adminPanel.style.display = settingsVisible ? "none" : "block";
    userPanel.style.display = settingsVisible ? "block" : "none";

    modeToggle.textContent = settingsVisible ? "Paramètres" : "Accueil";
});

let excelData = [];
let selectedCity = "";

const excelInput = document.getElementById("excelFile");
const fileList = document.getElementById("fileList");
const dataTableBody = document.querySelector("#dataTable tbody");
const cityBtnContainer = document.getElementById("cityBtnContainer");

excelInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const li = document.createElement("li");
    li.textContent = file.name;
    fileList.appendChild(li);

    const reader = new FileReader();
    reader.onload = (evt) => {
        const workbook = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        json.forEach(row => {
            row.Ville = normalizeText(row.Ville);
            row.Adresse = normalizeText(row.Adresse);
            row["Numéro de tournée"] = String(row["Numéro de tournée"] || "").trim();
        });

        excelData = json;

        let villesUniques = [...new Set(json.map(row => row.Ville))];
        villesUniques = villesUniques.filter(v => v.trim() !== "");
        villesUniques.sort();

        cityBtnContainer.innerHTML = "";

        villesUniques.forEach(v => {
            const btn = document.createElement("button");
            btn.classList.add("city-btn");
            btn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            btn.dataset.value = v;

            btn.addEventListener("click", () => {
                document.querySelectorAll(".city-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                selectedCity = v;
            });

            cityBtnContainer.appendChild(btn);
        });

        dataTableBody.innerHTML = "";

        json.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.Ville}</td>
                <td>${row.Adresse}</td>
                <td>${row["Numéro de tournée"]}</td>
            `;
            dataTableBody.appendChild(tr);
        });

        document.getElementById("noFileWarning").style.display = "none";

        applyMobileLabels();
        updateButtonsState();
    };

    reader.readAsBinaryString(file);
});

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

const voiceBtn = document.getElementById("voiceBtn");
const statusText = document.getElementById("statusText");
const manualInputs = document.getElementById("manualInputs");
const manualBtn = document.getElementById("manualSearchBtn");

const voiceConfirmBox = document.getElementById("voiceConfirmBox");
const voiceConfirmText = document.getElementById("voiceConfirmText");
const confirmBtn = document.getElementById("confirmBtn");
const retryBtn = document.getElementById("retryBtn");

let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function updateButtonsState() {
    const hasFile = excelData.length > 0;

    if (!isIOS) {
        voiceBtn.disabled = !hasFile;
        voiceBtn.style.opacity = hasFile ? "1" : "0.5";
    }

    manualBtn.disabled = !hasFile;
    manualBtn.style.opacity = hasFile ? "1" : "0.5";
}

if (isIOS) {
    statusText.textContent = "Reconnaissance vocale non supportée sur iPhone. Utilisez le mode manuel.";
    manualInputs.style.display = "block";
    voiceBtn.disabled = true;
    voiceBtn.style.opacity = "0.5";
} else {
    manualInputs.style.display = "none";
    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
}

let addressWord = "";
let lastRecognized = "";
let timeoutID = null;

if (!isIOS) {
    voiceBtn.addEventListener("click", () => {
        startListening();
    });

    function startListening() {
        playBeep();

        voiceConfirmBox.style.display = "none";
        lastRecognized = "";

        document.getElementById("resultCard").style.display = "none";
        document.getElementById("resultTableBody").innerHTML = "";

        statusText.textContent = "Dites le dernier mot de l'adresse…";

        voiceBtn.classList.add("listening");
        recognition.start();

        clearTimeout(timeoutID);
        timeoutID = setTimeout(() => {
            recognition.stop();
            statusText.textContent = "Aucun son détecté.";
            voiceBtn.classList.remove("listening");
        }, 5000);
    }

    recognition.addEventListener("result", (event) => {
        clearTimeout(timeoutID);

        lastRecognized = normalizeText(event.results[0][0].transcript);

        voiceConfirmText.textContent = "Vous avez dit : " + lastRecognized;
        voiceConfirmBox.style.display = "block";

        statusText.textContent = "Confirmez ou recommencez.";
    });

    recognition.addEventListener("end", () => {
        voiceBtn.classList.remove("listening");
    });

    confirmBtn.addEventListener("click", () => {
        addressWord = normalizeText(lastRecognized);
        voiceConfirmBox.style.display = "none";
        rechercherTournees(selectedCity, addressWord);
    });

    retryBtn.addEventListener("click", () => {
        voiceConfirmBox.style.display = "none";
        startListening();
    });
}

manualBtn.addEventListener("click", () => {
    const city = normalizeText(selectedCity);
    const addressWord = normalizeText(document.getElementById("manualAddress").value);

    document.getElementById("resultTableBody").innerHTML = "";
    document.getElementById("resultCard").style.display = "none";

    rechercherTournees(city, addressWord);
});

function rechercherTournees(ville, motAdresse) {

    if (!ville || ville.trim() === "") {
        statusText.textContent = "Veuillez sélectionner une ville.";
        return;
    }

    if (excelData.length === 0) {
        statusText.textContent = "Aucun fichier chargé.";
        return;
    }

    const resultCard = document.getElementById("resultCard");
    const resultTableBody = document.getElementById("resultTableBody");

    resultTableBody.innerHTML = "";

    const matches = excelData.filter(row =>
        row.Ville === normalizeText(ville) &&
        row.Adresse.includes(normalizeText(motAdresse))
    );

    if (matches.length === 0) {
        statusText.textContent = "Aucune tournée trouvée.";
        return;
    }

    matches.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.Ville}</td>
            <td>${m.Adresse}</td>
            <td>${m["Numéro de tournée"]}</td>
        `;
        resultTableBody.appendChild(tr);
    });

    resultCard.style.display = "block";
    resultCard.style.animation = "slideDown 0.4s ease forwards";

    statusText.textContent = `${matches.length} résultat(s) trouvé(s).`;

    applyMobileLabels();
}

function applyMobileLabels() {
    const tables = document.querySelectorAll("table");

    tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent.trim());
        const rows = table.querySelectorAll("tbody tr");

        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            cells.forEach((cell, index) => {
                cell.setAttribute("data-label", headers[index] || "");
            });
        });
    });
}

window.addEventListener("load", () => {
    adminPanel.style.display = "none";
    userPanel.style.display = "block";
    modeToggle.textContent = "Paramètres";
});
