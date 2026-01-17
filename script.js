/* ---------------------------------------------------------
   NORMALISATION DES TEXTES
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   BIP AUDIO
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   VIBRATION
--------------------------------------------------------- */
function vibrate(ms) {
    navigator.vibrate?.(ms);
}

/* ---------------------------------------------------------
   VARIABLES GLOBALES
--------------------------------------------------------- */
let excelData = [];
let selectedBras = "";
let selectedCity = "";
let addressWords = [];
let addressWordFrequency = {};

/* ---------------------------------------------------------
   PHONÉTIQUE FRANÇAISE (SOUNDEX FR)
--------------------------------------------------------- */
function soundexFr(word) {
    if (!word) return "";

    word = normalizeText(word).replace(/[^a-z]/g, "");
    if (!word) return "";

    const first = word[0];

    const map = {
        a:"", e:"", i:"", o:"", u:"", y:"",
        h:"", w:"",
        b:"1", p:"1",
        c:"2", k:"2", q:"2",
        d:"3", t:"3",
        l:"4",
        m:"5", n:"5",
        r:"6",
        f:"7", v:"7",
        g:"8", j:"8",
        s:"9", x:"9", z:"9"
    };

    let code = first.toUpperCase();
    let lastDigit = map[first] || "";

    for (let i = 1; i < word.length; i++) {
        const ch = word[i];
        const digit = map[ch] ?? "";

        if (digit !== "" && digit !== lastDigit) {
            code += digit;
            lastDigit = digit;
        } else if (digit !== "") {
            lastDigit = digit;
        } else {
            lastDigit = "";
        }
    }

    return code.padEnd(4, "0").slice(0, 4);
}

/* ---------------------------------------------------------
   EXTRACTION DES MOTS D'ADRESSES + FRÉQUENCES
--------------------------------------------------------- */
function buildAddressWords() {
    const set = new Set();
    addressWordFrequency = {};

    excelData.forEach(row => {
        const addr = normalizeText(row.Adresse);
        addr.split(" ").forEach(word => {
            const w = word.trim();
            if (w.length > 2) {
                set.add(w);
                addressWordFrequency[w] = (addressWordFrequency[w] || 0) + 1;
            }
        });
    });

    addressWords = Array.from(set);
}

/* ---------------------------------------------------------
   DISTANCE DE LEVENSHTEIN
--------------------------------------------------------- */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

/* ---------------------------------------------------------
   NETTOYAGE DE PHRASE & EXTRACTION DU MOT UTILE
--------------------------------------------------------- */
const PARASITES = new Set([
    "la","le","les","des","de","du","d","l",
    "au","aux","a","à",
    "dans","sur","sous","chez","pour",
    "rue","avenue","boulevard","bd","impasse",
    "chemin","place","allee","allée","route","quai"
]);

function cleanPhraseToKeyWord(phrase) {
    const tokens = normalizeText(phrase).split(" ").filter(Boolean);
    const filtered = tokens.filter(t => !PARASITES.has(t));

    if (filtered.length === 0) {
        return tokens.length ? tokens[tokens.length - 1] : "";
    }
    return filtered[filtered.length - 1];
}

/* ---------------------------------------------------------
   TROUVER LE MOT LE PLUS PROBABLE
--------------------------------------------------------- */
function getBestAddressWord(inputWord) {
    if (!inputWord || addressWords.length === 0) return null;

    const input = normalizeText(inputWord);

    if (input.length <= 3) {
        if (addressWords.includes(input)) return input;
        return null;
    }

    const inputSoundex = soundexFr(input);

    let bestWord = null;
    let bestScore = Infinity;

    addressWords.forEach(w => {
        const wSoundex = soundexFr(w);
        const lev = levenshtein(input, w);

        const phoneticPenalty = (inputSoundex === wSoundex) ? 0 : 2;
        const freqBonus = Math.log(1 + (addressWordFrequency[w] || 1));
        const score = lev + phoneticPenalty - 0.3 * freqBonus;

        if (score < bestScore) {
            bestScore = score;
            bestWord = w;
        }
    });

    const maxAllowed = Math.max(2.5, input.length * 0.6);
    if (bestScore > maxAllowed) return null;

    return bestWord;
}

/* ---------------------------------------------------------
   SÉLECTEURS DOM
--------------------------------------------------------- */
const modeToggle = document.getElementById("modeToggle");
const adminPanel = document.getElementById("adminPanel");
const userPanel = document.getElementById("userPanel");

const excelInput = document.getElementById("excelFile");
const fileList = document.getElementById("fileList");
const dataTableBody = document.querySelector("#dataTable tbody");

const brasBtnContainer = document.getElementById("brasBtnContainer");
const cityBtnContainer = document.getElementById("cityBtnContainer");

const voiceBtn = document.getElementById("voiceBtn");
const statusText = document.getElementById("statusText");
const manualInputs = document.getElementById("manualInputs");
const manualBtn = document.getElementById("manualSearchBtn");
const noFileWarning = document.getElementById("noFileWarning");

const voiceConfirmBox = document.getElementById("voiceConfirmBox");
const voiceConfirmText = document.getElementById("voiceConfirmText");
const confirmBtn = document.getElementById("confirmBtn");
const retryBtn = document.getElementById("retryBtn");

const popupOverlay = document.getElementById("popupOverlay");
const popupContent = document.getElementById("popupContent");
const popupClose = document.getElementById("popupClose");

/* 🔍 RECHERCHE LIVE */
const liveSearchContainer = document.getElementById("liveSearchContainer");
const liveSearchInput = document.getElementById("liveSearchInput");
const liveSearchResults = document.getElementById("liveSearchResults");

/* ---------------------------------------------------------
   BASCULE PARAMÈTRES / ACCUEIL
--------------------------------------------------------- */
modeToggle.addEventListener("click", () => {
    const settingsVisible = adminPanel.style.display === "block";

    adminPanel.style.display = settingsVisible ? "none" : "block";
    userPanel.style.display = settingsVisible ? "block" : "none";

    modeToggle.textContent = settingsVisible ? "Paramètres" : "Accueil";
});

/* ---------------------------------------------------------
   CHARGEMENT DU FICHIER EXCEL
--------------------------------------------------------- */
excelInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = file.name;
    fileList.appendChild(li);

    const reader = new FileReader();
    reader.onload = (evt) => {
        const workbook = XLSX.read(evt.target.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        json.forEach(row => {
            row.BRAS = normalizeText(row.BRAS);
            row.Ville = normalizeText(row.Ville);
            row.Adresse = normalizeText(row.Adresse);
            row["Numéro de tournée"] = String(row["Numéro de tournée"] || "").trim();
        });

        excelData = json;
        buildAddressWords();

        /* BRAS UNIQUES */
        let brasUniques = [...new Set(json.map(row => row.BRAS))]
            .filter(b => b.trim() !== "")
            .sort();

        brasBtnContainer.innerHTML = "";
        cityBtnContainer.innerHTML = "";
        selectedBras = "";
        selectedCity = "";

        brasUniques.forEach(b => {
            const btn = document.createElement("button");
            btn.classList.add("city-btn");
            btn.textContent = b.toUpperCase();
            btn.dataset.value = b;

            btn.addEventListener("click", () => {
                vibrate(50);

                selectedBras = b;
                selectedCity = "";

                document.querySelectorAll("#brasBtnContainer .city-btn")
                    .forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                /* VILLES DU BRAS */
                const villes = [...new Set(
                    excelData
                        .filter(r => r.BRAS === b)
                        .map(r => r.Ville)
                )].sort();

                cityBtnContainer.innerHTML = "";

                villes.forEach(v => {
                    const vbtn = document.createElement("button");
                    vbtn.classList.add("city-btn");
                    vbtn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
                    vbtn.dataset.value = v;

                    vbtn.addEventListener("click", () => {
                        vibrate(50);

                        selectedCity = v;

                        document.querySelectorAll("#cityBtnContainer .city-btn")
                            .forEach(b => b.classList.remove("active"));
                        vbtn.classList.add("active");
                    });

                    cityBtnContainer.appendChild(vbtn);
                });

                /* AFFICHER LE MOTEUR DE RECHERCHE */
                liveSearchContainer.style.display = "block";
                liveSearchInput.value = "";
                liveSearchResults.innerHTML = "";
            });

            brasBtnContainer.appendChild(btn);
        });

        /* TABLEAU APERÇU */
        dataTableBody.innerHTML = "";
        json.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.BRAS}</td>
                <td>${row.Ville}</td>
                <td>${row.Adresse}</td>
                <td>${row["Numéro de tournée"]}</td>
            `;
            dataTableBody.appendChild(tr);
        });

        noFileWarning.style.display = "none";
        updateButtonsState();
    };

    reader.readAsBinaryString(file);
});

/* ---------------------------------------------------------
   DÉTECTION iOS
--------------------------------------------------------- */
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

/* ---------------------------------------------------------
   ÉTAT DES BOUTONS
--------------------------------------------------------- */
function updateButtonsState() {
    const hasFile = excelData.length > 0;

    if (!isIOS) {
        voiceBtn.disabled = !hasFile;
        voiceBtn.style.opacity = hasFile ? "1" : "0.5";
    }

    manualBtn.disabled = !hasFile;
    manualBtn.style.opacity = hasFile ? "1" : "0.5";
}

/* ---------------------------------------------------------
   CONFIGURATION iOS / NON-iOS
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   RECONNAISSANCE VOCALE
--------------------------------------------------------- */
let lastRecognized = "";
let timeoutID = null;

if (!isIOS) {
    voiceBtn.addEventListener("click", () => {
        vibrate(60);
        startListening();
    });

    function startListening() {
        playBeep();

        voiceConfirmBox.style.display = "none";
        lastRecognized = "";

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

        const transcript = normalizeText(event.results[0][0].transcript);

        const rawKeyWord = cleanPhraseToKeyWord(transcript);

        const bestWord = getBestAddressWord(rawKeyWord);

        if (bestWord) {
            voiceConfirmText.textContent =
                `Vous avez dit : "${rawKeyWord}", interprété comme : "${bestWord}"`;
            lastRecognized = bestWord;
        } else {
            voiceConfirmText.textContent =
                `Vous avez dit : "${rawKeyWord}" (aucun mot proche trouvé, recherche directe)`;
            lastRecognized = rawKeyWord;
        }

        voiceConfirmBox.style.display = "block";
        statusText.textContent = "Confirmez ou recommencez.";
    });

    recognition.addEventListener("end", () => {
        voiceBtn.classList.remove("listening");
    });

    confirmBtn.addEventListener("click", () => {
        rechercherTournees(lastRecognized);
        voiceConfirmBox.style.display = "none";
    });

    retryBtn.addEventListener("click", () => {
        voiceConfirmBox.style.display = "none";
        startListening();
    });
}

/* ---------------------------------------------------------
   MODE MANUEL
--------------------------------------------------------- */
manualBtn.addEventListener("click", () => {
    const raw = normalizeText(document.getElementById("manualAddress").value);

    const cleaned = cleanPhraseToKeyWord(raw);
    const bestWord = getBestAddressWord(cleaned) || cleaned;

    rechercherTournees(bestWord);
});

/* ---------------------------------------------------------
   🔍 RECHERCHE LIVE AUTOMATIQUE
--------------------------------------------------------- */
liveSearchInput.addEventListener("input", () => {
    const query = normalizeText(liveSearchInput.value);

    setTimeout(() => {
        liveSearchContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    if (!selectedBras) {
        liveSearchResults.innerHTML = "<p style='color:#aaa;'>Sélectionnez un BRAS.</p>";
        return;
    }

    if (query.length < 2) {
        liveSearchResults.innerHTML = "";
        return;
    }

    const matches = excelData.filter(row =>
        row.BRAS === selectedBras &&
        (!selectedCity || row.Ville === selectedCity) &&
        row.Adresse.includes(query)
    );

    if (matches.length === 0) {
        liveSearchResults.innerHTML = "<p style='color:#aaa;'>Aucun résultat.</p>";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Ville</th>
                    <th>Adresse</th>
                    <th>Numéro</th>
                </tr>
            </thead>
            <tbody>
    `;

    matches.forEach(m => {
        html += `
            <tr>
                <td>${m.Ville}</td>
                <td>${m.Adresse}</td>
                <td>${m["Numéro de tournée"]}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";

    liveSearchResults.innerHTML = html;
});

/* ---------------------------------------------------------
   RECHERCHE DES TOURNÉES + POPUP
--------------------------------------------------------- */
function rechercherTournees(motAdresse) {

    if (!selectedBras) {
        statusText.textContent = "Veuillez sélectionner un BRAS.";
        return;
    }

    if (!motAdresse) {
        statusText.textContent = "Dites ou saisissez le dernier mot de l'adresse.";
        return;
    }

    const matches = excelData.filter(row =>
        row.BRAS === selectedBras &&
        (!selectedCity || row.Ville === selectedCity) &&
        row.Adresse.includes(normalizeText(motAdresse))
    );

    if (matches.length === 0) {
        statusText.textContent = "Aucune tournée trouvée.";
        popupOverlay.style.display = "none";
        return;
    }

    let html = `
    <table>
      <thead>
        <tr>
          <th>Ville</th>
          <th>Adresse</th>
          <th>Numéro</th>
        </tr>
      </thead>
      <tbody>
    `;
    matches.forEach(m => {
        html += `
        <tr>
          <td>${m.Ville}</td>
          <td>${m.Adresse}</td>
          <td>${m["Numéro de tournée"]}</td>
        </tr>`;
    });

    html += "</tbody></table>";

    popupContent.innerHTML = html;
    popupOverlay.style.display = "flex";

    statusText.textContent = `${matches.length} résultat(s) trouvé(s).`;
}

/* ---------------------------------------------------------
   FERMETURE POPUP
--------------------------------------------------------- */
popupClose.addEventListener("click", () => {
    popupOverlay.style.display = "none";
});

popupOverlay.addEventListener("click", (e) => {
    if (e.target === popupOverlay) {
        popupOverlay.style.display = "none";
    }
});

/* ---------------------------------------------------------
   ÉTAT INITIAL
--------------------------------------------------------- */
window.addEventListener("load", () => {
    adminPanel.style.display = "none";
    userPanel.style.display = "block";
    modeToggle.textContent = "Paramètres";
    updateButtonsState();
});
