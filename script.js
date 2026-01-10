/* ============================
   BEEP COMPATIBLE SMARTPHONE
============================ */
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 900;
        gainNode.gain.value = 0.2;

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

/* ============================
   PANELS ADMIN / UTILISATEUR
============================ */
const modeToggle = document.getElementById("modeToggle");
const adminPanel = document.getElementById("adminPanel");
const userPanel = document.getElementById("userPanel");

modeToggle.addEventListener("click", () => {
    const adminVisible = adminPanel.style.display === "block";
    adminPanel.style.display = adminVisible ? "none" : "block";
    userPanel.style.display = adminVisible ? "block" : "none";
});

/* ============================
   IMPORT EXCEL
============================ */
let excelData = [];

const excelInput = document.getElementById("excelFile");
const fileList = document.getElementById("fileList");
const dataTableBody = document.querySelector("#dataTable tbody");

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

        excelData = excelData.concat(json);

        json.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.Ville || ""}</td>
                <td>${row.Adresse || ""}</td>
                <td>${row["Numéro de tournée"] || ""}</td>
            `;
            dataTableBody.appendChild(tr);
        });

        document.getElementById("noFileWarning").style.display = "none";
        updateButtonsState();
    };
    reader.readAsBinaryString(file);
});

/* ============================
   DÉTECTION iPHONE
============================ */
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ============================
   MICRO & RECONNAISSANCE VOCALE
============================ */
const voiceBtn = document.getElementById("voiceBtn");
const statusText = document.getElementById("statusText");
const manualInputs = document.getElementById("manualInputs");
const manualBtn = document.getElementById("manualSearchBtn");

let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

/* ============================
   GESTION DES BOUTONS
============================ */
function updateButtonsState() {
    const hasFile = excelData.length > 0;

    if (!isIOS) {
        voiceBtn.disabled = !hasFile;
        voiceBtn.style.opacity = hasFile ? "1" : "0.5";
    }

    manualBtn.disabled = !hasFile;
    manualBtn.style.opacity = hasFile ? "1" : "0.5";
}

/* ----- MODE iPHONE ----- */
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

/* ============================
   WORKFLOW VOCAL (ANDROID)
============================ */
let step = 1;
let city = "";
let addressWord = "";
let timeoutID = null;

if (!isIOS) {
    voiceBtn.addEventListener("click", () => {

        playBeep();

        document.getElementById("resultTableBody").innerHTML = "";
        document.getElementById("resultCard").style.display = "none";

        statusText.textContent = step === 1 ? "Dites la ville…" : "Dites le dernier mot de l'adresse…";

        voiceBtn.classList.add("listening");
        recognition.start();

        clearTimeout(timeoutID);
        timeoutID = setTimeout(() => {
            recognition.stop();
            statusText.textContent = "Aucun son détecté.";
            voiceBtn.classList.remove("listening");
        }, 5000);
    });

    recognition.addEventListener("result", (event) => {
        clearTimeout(timeoutID);

        const text = event.results[0][0].transcript.trim();
        statusText.textContent = "Vous avez dit : " + text;

        if (step === 1) {
            city = text.toLowerCase();
            step = 2;
            statusText.textContent = "Ville détectée : " + city + ". Maintenant dites le dernier mot de l'adresse.";
        } else {
            addressWord = text.toLowerCase();
            step = 1;
            rechercherTournees(city, addressWord);
        }
    });

    recognition.addEventListener("end", () => {
        voiceBtn.classList.remove("listening");
    });
}

/* ============================
   MODE MANUEL (iPhone)
============================ */
manualBtn.addEventListener("click", () => {
    const city = document.getElementById("manualCity").value.toLowerCase();
    const addressWord = document.getElementById("manualAddress").value.toLowerCase();

    document.getElementById("resultTableBody").innerHTML = "";
    document.getElementById("resultCard").style.display = "none";

    rechercherTournees(city, addressWord);
});

/* ============================
   RECHERCHE DANS EXCEL
============================ */
function rechercherTournees(ville, motAdresse) {

    if (excelData.length === 0) {
        statusText.textContent = "Aucun fichier chargé.";
        return;
    }

    const resultCard = document.getElementById("resultCard");
    const resultTableBody = document.getElementById("resultTableBody");

    resultTableBody.innerHTML = "";

    const matches = excelData.filter(row =>
        (row.Ville || "").toLowerCase() === ville &&
        (row.Adresse || "").toLowerCase().includes(motAdresse)
    );

    if (matches.length === 0) {
        statusText.textContent = "Aucune tournée trouvée.";
        resultCard.style.display = "none";
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
}

/* ============================
   MESSAGE SI AUCUN FICHIER
============================ */
window.addEventListener("load", () => {
    if (excelData.length === 0) {
        document.getElementById("noFileWarning").style.display = "block";
    }
    updateButtonsState();
});
