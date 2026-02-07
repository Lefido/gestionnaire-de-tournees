/**
 * Données Excel chargées depuis le fichier importé
 * @type {Array<Object>}
 */
let donneesExcel = [];

/**
 * Bras de distribution actuellement sélectionné
 * @type {string}
 */
let brasSelectionne = "";

/**
 * Ville actuellement sélectionnée
 * @type {string}
 */
let villeSelectionnee = "";

/**
 * Dernier texte reconnu par la reconnaissance vocale
 * @type {string}
 */
let dernierReconnu = "";

/**
 * Flux de la caméra actif
 * @type {MediaStream|null}
 */
let fluxCamera = null;

// =====================================
// INITIALISATION DE LA RECONNAISSANCE VOCALE
// =====================================

/**
 * Objet de reconnaissance vocale
 * @type {SpeechRecognition|null}
 */
const reconnaissanceVocale = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Instance de reconnaissance vocale configurée
 * @type {SpeechRecognition|null}
 */
const instanceReconnaissance = reconnaissanceVocale ? new reconnaissanceVocale() : null;

if (instanceReconnaissance) {
    instanceReconnaissance.lang = "fr-FR";
    instanceReconnaissance.interimResults = false;
}

// =====================================
// UTILITAIRES
// =====================================

/**
 * Normalise une chaîne de caractères en supprimant les accents pour une recherche plus flexible
 * @param {string} str - La chaîne à normaliser
 * @returns {string} La chaîne normalisée en minuscules sans accents
 */
const normaliserTexte = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Joue un bip sonore pour indiquer une action
 */
function jouerBip() {
    try {
        const contexteAudio = new (window.AudioContext || window.webkitAudioContext)();
        const oscillateur = contexteAudio.createOscillator();
        const gain = contexteAudio.createGain();
        oscillateur.connect(gain);
        gain.connect(contexteAudio.destination);
        oscillateur.frequency.value = 800;
        oscillateur.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, contexteAudio.currentTime + 0.1);
        oscillateur.stop(contexteAudio.currentTime + 0.1);
    } catch(e) {}
}

/**
 * Fait vibrer l'appareil lors d'un clic (si supporté)
 */
function vibrerAuClic() {
    if (navigator.vibrate) {
        navigator.vibrate(50); // Vibration douce de 50ms
    }
}

// Prevent PWA install prompt to only allow desktop shortcut
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
});

// =====================================
// INITIALISATION DE L'APPLICATION
// =====================================

/**
 * Initialise l'application au chargement du DOM
 */
window.addEventListener("DOMContentLoaded", () => {
    // Charger les données sauvegardées
    const donneesSauvegardees = localStorage.getItem("tourneeData");
    if (donneesSauvegardees) {
        donneesExcel = JSON.parse(donneesSauvegardees);
        rafraichirInterface();
    }

    verifierAvertissementDonnees();
    positionnerZoneVocale();
    window.addEventListener('resize', positionnerZoneVocale);

    // Gestion du toggle caméra et persistance de l'état
    const toggleCamera = document.getElementById("cameraToggle");
    const boutonCamera = document.getElementById("cameraBtn");

    if (toggleCamera && boutonCamera) {
        // Charger et appliquer l'état initial depuis localStorage
        const cameraActivee = localStorage.getItem("cameraEnabled") === 'true';
        toggleCamera.checked = cameraActivee;
        boutonCamera.classList.toggle('hidden', !cameraActivee);

        // Gérer le changement et sauvegarder l'état
        toggleCamera.addEventListener("change", () => {
            const estCoche = toggleCamera.checked;
            boutonCamera.classList.toggle('hidden', !estCoche);
            localStorage.setItem("cameraEnabled", estCoche);
        });
    }

    // AUTO-SCROLL : Garder l'input en haut de l'écran quand le clavier sort
    const champRecherche = document.getElementById("liveSearchInput");
    const conteneurRecherche = document.getElementById("liveSearchContainer");

    champRecherche.addEventListener("focus", () => {
        champRecherche.classList.add('fixed-input');
        conteneurRecherche.classList.add('focused');
        const resultats = document.getElementById('liveSearchResults');
        resultats.style.position = 'fixed';
        resultats.style.top = '130px';
        resultats.style.left = '50%';
        resultats.style.transform = 'translateX(-50%)';
        resultats.style.width = champRecherche.offsetWidth + 'px';
        resultats.style.zIndex = '1000';
        resultats.style.background = 'var(--bg-panel)';
        resultats.style.borderRadius = '8px';
        resultats.style.maxHeight = '60vh';
        resultats.style.overflowY = 'auto';
        const boutonEffacer = document.getElementById('clearSearchBtn');
        boutonEffacer.style.position = 'fixed';
        boutonEffacer.style.top = (80 + champRecherche.offsetHeight / 2 - 12) + 'px';
        boutonEffacer.style.right = 'calc(50% - ' + (champRecherche.offsetWidth / 2) + 'px + 12px)';
        boutonEffacer.style.zIndex = '102';
    });

    champRecherche.addEventListener("blur", () => {
        champRecherche.classList.remove('fixed-input');
        conteneurRecherche.classList.remove('focused');
        champRecherche.value = '';
        const resultats = document.getElementById('liveSearchResults');
        resultats.innerHTML = '';
        resultats.style.display = 'none';
        resultats.style.position = '';
        resultats.style.top = '';
        resultats.style.left = '';
        resultats.style.transform = '';
        resultats.style.width = '';
        resultats.style.zIndex = '';
        resultats.style.background = '';
        resultats.style.borderRadius = '';
        resultats.style.maxHeight = '';
        resultats.style.overflowY = '';
        const boutonEffacer = document.getElementById('clearSearchBtn');
        boutonEffacer.style.position = '';
        boutonEffacer.style.top = '';
        boutonEffacer.style.right = '';
        boutonEffacer.style.zIndex = '';
        boutonEffacer.style.display = 'none';
    });

    // Vérification disponibilité reconnaissance vocale et feedback UI
    const boutonVocal = document.getElementById("voiceBtn");
    const texteStatut = document.getElementById("statusText");
    if (!instanceReconnaissance) {
        if (boutonVocal) {
            boutonVocal.disabled = true;
            boutonVocal.setAttribute('aria-disabled', 'true');
        }
        if (texteStatut) texteStatut.textContent = "Commande vocale non disponible";
    } else {
        if (texteStatut && texteStatut.textContent.trim() === '') texteStatut.textContent = "Prêt.";
    }

    // Masquer explicitement la boîte de confirmation vocale au chargement
    const boiteConfirmationVocale = document.getElementById("voiceConfirmBox");
    if (boiteConfirmationVocale) { boiteConfirmationVocale.classList.add('hidden'); }

    // Masquer la popup vocale au chargement
    const popupVocale = document.getElementById("voicePopupOverlay");
    if (popupVocale) { popupVocale.classList.add('hidden'); }

    // Ajouter vibration à tous les boutons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', vibrerAuClic);
    });

    // Ajouter vibration au bouton "Import Excel" (label)
    document.querySelector('label[for="excelFile"]').addEventListener('click', vibrerAuClic);
});

/**
 * Vérifie et met à jour l'affichage des avertissements et éléments d'interface selon la disponibilité des données
 */
function verifierAvertissementDonnees() {
    const avertissement = document.getElementById("noFileWarning");
    if (avertissement) avertissement.style.display = (donneesExcel.length > 0) ? "none" : "block";

    const titreBras = document.querySelector('#userPanel h2:first-of-type');
    const conteneurBras = document.getElementById('brasBtnContainer');
    const conteneurRecherche = document.getElementById('liveSearchContainer');
    const zoneVocale = document.querySelector('.voice-zone');
    const titreVille = document.getElementById("titleVille");
    const aDonnees = donneesExcel.length > 0;
    const aSelectionne = brasSelectionne !== "";
    if (titreBras) titreBras.style.display = aDonnees ? "block" : "none";
    if (conteneurBras) conteneurBras.style.display = aDonnees ? "flex" : "none";
    if (conteneurRecherche) conteneurRecherche.style.display = (aDonnees && aSelectionne) ? "block" : "none";
    if (zoneVocale) zoneVocale.style.display = (aDonnees && aSelectionne) ? "flex" : "none";
    if (titreVille) {
        if (aSelectionne) {
            titreVille.classList.remove("hidden");
        } else {
            titreVille.classList.add("hidden");
        }
    }
}

/**
 * Gestionnaire d'événement pour l'importation du fichier Excel
 */
document.getElementById("excelFile").addEventListener("change", function(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;

    const lecteur = new FileReader();
    lecteur.onload = (evt) => {
        const donnees = new Uint8Array(evt.target.result);
        const classeur = XLSX.read(donnees, { type: "array" });
        const feuille = classeur.Sheets[classeur.SheetNames[0]];

        // Transformation des données Excel en format interne
        donneesExcel = XLSX.utils.sheet_to_json(feuille).map(ligne => ({
            BRAS: String(ligne.BRAS || "").trim().toLowerCase(),
            Ville: String(ligne.Ville || "").trim().toLowerCase(),
            Adresse: String(ligne.Adresse || "").trim().toLowerCase(),
            Numero: String(ligne["Numéro de tournée"] || ligne["Numéro"] || "").trim(),
            TypeRecherche: String(ligne["Type Recherche"] || "").trim()
        }));

        // Sauvegarde dans le localStorage
        localStorage.setItem("tourneeData", JSON.stringify(donneesExcel));

        // Mise à jour de l'interface
        rafraichirInterface();
        verifierAvertissementDonnees();

        alert("Données importées avec succès !");
    };
    lecteur.readAsArrayBuffer(fichier);
});

/**
 * Rafraîchit l'interface utilisateur avec les données actuelles
 */
function rafraichirInterface() {
    // Remplissage du tableau d'administration
    const corpsTableau = document.getElementById("adminTableBody");
    if (corpsTableau) {
        corpsTableau.innerHTML = "";
        donneesExcel.forEach(ligne => {
            const ligneTableau = document.createElement("tr");
            ligneTableau.innerHTML = `<td>${ligne.BRAS}</td><td>${ligne.Ville}</td><td>${ligne.Adresse}</td><td>${ligne.Numero}</td>`;
            corpsTableau.appendChild(ligneTableau);
        });
    }

    // Génération des boutons BRAS
    const brasUniques = [...new Set(donneesExcel.map(l => l.BRAS))].filter(b => b).sort();
    const conteneur = document.getElementById("brasBtnContainer");
    if (conteneur) {
        conteneur.innerHTML = "";
        brasUniques.forEach((bras, index) => {
            const bouton = document.createElement("button");
            bouton.className = "city-btn city-appear";
            bouton.style.animationDelay = (index * 0.05) + "s";
            bouton.textContent = bras;
            bouton.onclick = () => { selectionnerBras(bras, bouton); vibrerAuClic(); };
            conteneur.appendChild(bouton);
        });
    }
}

/**
 * Sélectionne un bras de distribution et met à jour l'interface utilisateur
 * @param {string} bras - Le bras de distribution sélectionné
 * @param {HTMLElement} bouton - Le bouton cliqué pour la sélection
 */
function selectionnerBras(bras, bouton) {
    brasSelectionne = bras;
    villeSelectionnee = "";

    // Réinitialisation de l'interface utilisateur
    document.querySelectorAll("#brasBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
    bouton.classList.add("active");
    document.getElementById("liveSearchInput").value = "";
    document.getElementById("liveSearchResults").style.display = "none";
    document.getElementById("clearSearchBtn").style.display = "none";

    // Affichage des villes
    document.getElementById("titleVille").classList.remove("hidden");
    const villes = [...new Set(donneesExcel.filter(r => r.BRAS === bras).map(r => r.Ville))].filter(v => v).sort();
    const conteneurVille = document.getElementById("cityBtnContainer");

    // Retirer temporairement le bouton vocal s'il est dans le conteneur pour éviter de l'effacer
    const boutonVocal = document.getElementById('voiceBtn');
    let boutonVocalEtaitDansConteneur = false;
    if (boutonVocal && conteneurVille.contains(boutonVocal)) {
        conteneurVille.removeChild(boutonVocal);
        boutonVocalEtaitDansConteneur = true;
    }

    conteneurVille.innerHTML = "";
    villes.forEach((ville, index) => {
        const boutonVille = document.createElement("button");
        boutonVille.className = "city-btn city-appear";
        boutonVille.style.animationDelay = (index * 0.03) + "s";
        boutonVille.textContent = ville;
        boutonVille.onclick = () => {
            if (villeSelectionnee === ville) {
                villeSelectionnee = "";
                document.querySelectorAll("#cityBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
            } else {
                villeSelectionnee = ville;
                document.querySelectorAll("#cityBtnContainer .city-btn").forEach(b => b.classList.remove("active"));
                boutonVille.classList.add("active");
            }
            vibrerAuClic();
        };
        conteneurVille.appendChild(boutonVille);
    });

    // Si le bouton vocal était dans le conteneur, le remettre avec le style des boutons de ville
    if (boutonVocalEtaitDansConteneur) {
        boutonVocal.className = 'city-btn city-appear';
        conteneurVille.appendChild(boutonVocal);
    }

    // Mise à jour de l'interface basée sur la sélection
    verifierAvertissementDonnees();
}

// =====================================
// FONCTIONNALITÉS DE RECHERCHE
// =====================================

/**
 * Gestionnaire d'événement pour la recherche en temps réel
 */
document.getElementById("liveSearchInput").addEventListener("input", function() {
    const valeurRecherche = normaliserTexte(this.value.trim());
    const divResultats = document.getElementById("liveSearchResults");
    document.getElementById("clearSearchBtn").style.display = valeurRecherche ? "flex" : "none";

    if (valeurRecherche.length < 2 || !brasSelectionne) {
        divResultats.innerHTML = "";
        divResultats.style.display = "none";
        return;
    }

    // Essayer d'abord de trouver des correspondances dans TypeRecherche "1"
    let resultatsFiltres = donneesExcel.filter(r =>
        r.BRAS === brasSelectionne &&
        (!villeSelectionnee || r.Ville === villeSelectionnee) &&
        r.TypeRecherche === "1" &&
        normaliserTexte(r.Adresse).includes(valeurRecherche)
    );

    let estAlternatif = false;
    // Si aucun résultat dans "1", afficher tous les résultats de "2" qui correspondent à la ville et au BRAS
    if (resultatsFiltres.length === 0) {
        resultatsFiltres = donneesExcel.filter(r =>
            r.BRAS === brasSelectionne &&
            (!villeSelectionnee || r.Ville === villeSelectionnee) &&
            r.TypeRecherche === "2"
        );
        estAlternatif = true;
    }

    if (resultatsFiltres.length > 0) {
        divResultats.style.display = "block";
        let html = `<table class="popup-table"><tbody>`;
        if (estAlternatif) {
            html = `<p style="color: #ff6b6b; font-weight: bold; text-align: center; margin-bottom: 5px;">Aucun résultat trouvé. Résultats alternatifs :</p>` + html;
        }
        resultatsFiltres.forEach(r => {
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
        });
        divResultats.innerHTML = html + "</tbody></table>";
    } else {
        divResultats.style.display = "none";
    }
});

/**
 * Gestionnaire d'événement pour effacer la recherche
 */
document.getElementById("clearSearchBtn").onclick = function() {
    document.getElementById("liveSearchInput").value = "";
    document.getElementById("liveSearchResults").style.display = "none";
    this.style.display = "none";
};

// =====================================
// RECONNAISSANCE VOCALE
// =====================================

/**
 * Initialise les gestionnaires d'événements pour la reconnaissance vocale
 */
if (instanceReconnaissance) {
    document.getElementById("voiceBtn").onclick = () => {
        if (!brasSelectionne) {
            alert("Sélectionnez d'abord un BRAS");
            return;
        }
        vibrerAuClic();
        jouerBip();
        try {
            instanceReconnaissance.start();
            document.getElementById("voiceBtn").classList.add("listening");
            document.getElementById("statusText").textContent = "J'écoute...";
        } catch (erreur) {
            console.error('Erreur démarrage reconnaissance vocale:', erreur);
            alert('Impossible de démarrer la reconnaissance vocale. Vérifiez les permissions du micro et le contexte (HTTPS).');
            document.getElementById("statusText").textContent = "Erreur micro";
        }
    };

    instanceReconnaissance.onresult = (evenement) => {
        const transcription = (evenement.results && evenement.results[0] && evenement.results[0][0] && evenement.results[0][0].transcript) ?
            evenement.results[0][0].transcript.toLowerCase() : '';
        dernierReconnu = transcription ? transcription.split(" ").pop() : ''; // Prend le dernier mot
        document.getElementById("voiceConfirmText").textContent = `Chercher "${dernierReconnu}" ?`;
        const popup = document.getElementById("voicePopupOverlay");
        if (popup) { popup.classList.remove('hidden'); }
        // Garder le bouton vocal dans son conteneur, ne pas le déplacer
    };

    instanceReconnaissance.onerror = (evenement) => {
        console.error('Erreur reconnaissance vocale', evenement);
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Erreur reconnaissance";
        alert('Erreur reconnaissance vocale : ' + (evenement.error || 'inconnue'));
    };

    instanceReconnaissance.onnomatch = () => {
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Aucun résultat";
    };

    instanceReconnaissance.onend = () => {
        document.getElementById("voiceBtn").classList.remove("listening");
        document.getElementById("statusText").textContent = "Prêt.";
    };
}

/**
 * Gestionnaire d'événement pour confirmer la recherche vocale
 */
document.getElementById("confirmBtn").onclick = () => {
    const valeurRecherche = normaliserTexte(dernierReconnu);

    // Essayer d'abord de trouver des correspondances dans TypeRecherche "1"
    let resultatsFiltres = donneesExcel.filter(r =>
        r.BRAS === brasSelectionne &&
        (!villeSelectionnee || r.Ville === villeSelectionnee) &&
        r.TypeRecherche === "1" &&
        normaliserTexte(r.Adresse).includes(valeurRecherche)
    );

    let estAlternatif = false;
    // Si aucun résultat dans "1", afficher tous les résultats de "2" qui correspondent à la ville et au BRAS
    if (resultatsFiltres.length === 0) {
        resultatsFiltres = donneesExcel.filter(r =>
            r.BRAS === brasSelectionne &&
            (!villeSelectionnee || r.Ville === villeSelectionnee) &&
            r.TypeRecherche === "2"
        );
        estAlternatif = true;
    }

    if (resultatsFiltres.length > 0) {
        let html = `<table class="popup-table"><tbody>`;
        resultatsFiltres.forEach(r => {
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
        });
        document.getElementById("popupContent").innerHTML = html + "</tbody></table>";
        if (estAlternatif) {
            document.getElementById("popupTitle").innerHTML = "Résultats<br><span style='color: #ff6b6b; margin-top: 10px; display: block; font-size: 0.8em;'>Aucun résultat trouvé. Résultats alternatifs :</span>";
        } else {
            document.getElementById("popupTitle").innerHTML = "Résultats";
        }
        document.getElementById("popupOverlay").classList.remove("hidden");
    } else {
        alert("Aucun résultat pour : " + dernierReconnu);
    }

    const popupVocale = document.getElementById("voicePopupOverlay");
    if (popupVocale) {
        popupVocale.classList.add('hidden');
        // Remettre le bouton vocal dans la zone vocale
        const boutonVocal = document.getElementById('voiceBtn');
        const zoneVocale = document.querySelector('.voice-zone');
        if (boutonVocal && zoneVocale && !zoneVocale.contains(boutonVocal)) {
            zoneVocale.appendChild(boutonVocal);
        }
    }
};

// =====================================
// GESTION DES MODALES ET PANNEAUX
// =====================================

/**
 * Gestionnaire d'événement pour réessayer la reconnaissance vocale
 */
document.getElementById("retryBtn").onclick = () => {
    const popupVocale2 = document.getElementById("voicePopupOverlay");
    if (popupVocale2) { popupVocale2.classList.add('hidden'); }
    document.getElementById("voiceBtn").click();
};

/**
 * Gestionnaire d'événement pour annuler la reconnaissance vocale
 */
document.getElementById("cancelBtn").onclick = () => {
    const popupVocale3 = document.getElementById("voicePopupOverlay");
    if (popupVocale3) { popupVocale3.classList.add('hidden'); }
    document.getElementById("statusText").textContent = "Annulé.";
};

/**
 * Gestionnaire d'événement pour fermer la popup de résultats
 */
document.getElementById("popupClose").onclick = () => {
    document.getElementById("popupOverlay").classList.add("hidden");
};

/**
 * Gestionnaire d'événement pour basculer entre les modes (utilisateur/admin)
 */
document.getElementById("modeToggle").onclick = function() {
    const panneauAdmin = document.getElementById("adminPanel"), panneauUtilisateur = document.getElementById("userPanel");
    const panneauAdminCache = panneauAdmin.classList.contains('hidden');
    if (panneauAdminCache) {
        panneauAdmin.classList.remove('hidden'); panneauAdmin.style.display = 'block';
        panneauUtilisateur.classList.add('hidden'); panneauUtilisateur.style.display = 'none';
        this.textContent = 'Accueil';
    } else {
        panneauAdmin.classList.add('hidden'); panneauAdmin.style.display = 'none';
        panneauUtilisateur.classList.remove('hidden'); panneauUtilisateur.style.display = 'block';
        if (!brasSelectionne) {
            document.getElementById("titleVille").classList.add("hidden");
        } else {
            document.getElementById("titleVille").classList.remove("hidden");
        }
        // Remettre le bouton micro dans la zone vocale si un BRAS est sélectionné
        if (brasSelectionne) {
            const boutonVocal = document.getElementById('voiceBtn');
            const zoneVocale = document.querySelector('.voice-zone');
            if (boutonVocal && zoneVocale && !zoneVocale.contains(boutonVocal)) {
                boutonVocal.className = 'voice-btn';
                zoneVocale.appendChild(boutonVocal);
                zoneVocale.style.display = "flex";
                positionnerZoneVocale();
            }
        }
        this.textContent = 'Paramètres';
    }
};

/**
 * Gestionnaire d'événement pour effacer le stockage local
 */
document.getElementById("clearStorageBtn").onclick = () => {
    if(confirm("Voulez-vous vraiment effacer toutes les données chargées ?")) {
        localStorage.clear(); location.reload();
    }
};

/**
 * Analyse le texte extrait d'une image pour extraire l'adresse
 * @param {string} texte - Le texte reconnu par l'OCR
 * @returns {Object} Objet contenant la ville, la rue et le dernier mot de la rue
 */
function analyserAdresseDepuisTexte(texte) {
    const lignes = texte.split('\n').map(ligne => ligne.trim()).filter(ligne => ligne);
    let ville = '';
    let rue = '';

    // Améliorer la regex pour les codes postaux (5 chiffres)
    const regexCodePostal = /\b(\d{5})\b/;
    // Étendre la regex pour les types de rues (ajouter plus de variations)
    const regexRue = /\b(rue|boulevard|bd|avenue|av|place|pl|chemin|impasse|allee|route|rt|voie|square|sq|cours|imp|passage|pass|quai|pont|carrefour|car|résidence|res|lotissement|lot|zone|zn|parc|prk)\b/i;

    // Extraction de la ville : chercher après le code postal
    for (const ligne of lignes) {
        const correspondance = ligne.match(regexCodePostal);
        if (correspondance) {
            // Prendre le texte après le code postal, nettoyer et prendre les premiers mots
            const apresCode = ligne.substring(correspondance.index + correspondance[0].length).replace(/[^a-zA-Z\s-]/g, '').trim();
            const mots = apresCode.split(/\s+/).filter(m => m.length > 1); // Filtrer les mots courts
            ville = mots.slice(0, 3).join(' '); // Prendre jusqu'à 3 mots pour la ville
            if (ville) break;
        }
    }

    // Extraction de la rue : chercher les lignes avec des indicateurs de rue
    for (const ligne of lignes) {
        if (regexRue.test(ligne)) {
            // Nettoyer la ligne : enlever les chiffres au début, les types de rue, et les caractères spéciaux
            let nettoye = ligne.replace(/^\d+\s*/, ''); // Enlever les numéros au début
            nettoye = nettoye.replace(regexRue, '').replace(/[,.-]/g, '').trim();
            // Enlever les mots très courts et les mots communs
            const mots = nettoye.split(/\s+/).filter(m => m.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(m));
            rue = mots.join(' ');
            if (rue) break;
        }
    }

    // Si pas de rue trouvée, essayer de trouver une ligne qui ressemble à une adresse (contient des chiffres et des lettres)
    if (!rue) {
        for (const ligne of lignes) {
            if (/\d/.test(ligne) && /[a-zA-Z]/.test(ligne) && !regexCodePostal.test(ligne)) {
                let nettoye = ligne.replace(/^\d+\s*/, '').replace(/[,.-]/g, '').trim();
                const mots = nettoye.split(/\s+/).filter(m => m.length > 2);
                rue = mots.join(' ');
                if (rue) break;
            }
        }
    }

    // Extraire le dernier mot significatif de la rue
    const motsRue = rue.split(/\s+/).filter(m => m.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(m));
    const dernierMotRue = motsRue.length > 0 ? motsRue[motsRue.length - 1] : '';

    return {
        ville: ville,
        rue: rue,
        dernierMotRue: dernierMotRue
    };
}

/**
 * Effectue une recherche basée sur l'adresse analysée depuis l'OCR
 * @param {Object} adresseAnalysée - L'objet contenant l'adresse analysée
 */
function rechercherDepuisOCR(adresseAnalysée) {
    const termeRecherche = adresseAnalysée.dernierMotRue || adresseAnalysée.rue || adresseAnalysée.ville;
    if (!termeRecherche) {
        alert("Aucun terme de recherche valide n'a pu être extrait de l'image.");
        return;
    }

    const valeurNormalisee = normaliserTexte(termeRecherche);
    let resultatsFiltres = donneesExcel.filter(r =>
        r.BRAS === brasSelectionne &&
        (!villeSelectionnee || r.Ville === villeSelectionnee) &&
        normaliserTexte(r.Adresse).includes(valeurNormalisee)
    );

    if (adresseAnalysée.ville) {
        const valeurVille = normaliserTexte(adresseAnalysée.ville);
        const resultatsPlusFiltres = resultatsFiltres.filter(r => normaliserTexte(r.Ville).includes(valeurVille));
        if (resultatsPlusFiltres.length > 0) {
            resultatsFiltres = resultatsPlusFiltres;
        }
    }

    if (resultatsFiltres.length > 0) {
        let html = `<table class="popup-table"><tbody>`;
        resultatsFiltres.forEach(r => {
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
        });
        document.getElementById("popupContent").innerHTML = html + "</tbody></table>";
        document.getElementById("popupTitle").textContent = "Résultats de la recherche image";
        document.getElementById("popupOverlay").classList.remove("hidden");
    } else {
        alert("Aucun résultat pour : " + termeRecherche);
    }

    popupCamera.classList.add("hidden");
    arreterCamera();
}

// =====================================
// CAMÉRA ET OCR
// =====================================

/**
 * Popup de la caméra
 * @type {HTMLElement}
 */
const popupCamera = document.getElementById("cameraPopupOverlay");

/**
 * Bouton pour ouvrir la caméra
 * @type {HTMLElement}
 */
const boutonCamera = document.getElementById("cameraBtn");

/**
 * Bouton pour fermer la popup caméra
 * @type {HTMLElement}
 */
const fermeturePopupCamera = document.getElementById("cameraPopupClose");

/**
 * Flux vidéo de la caméra
 * @type {HTMLVideoElement}
 */
const fluxVideo = document.getElementById("cameraFeed");

/**
 * Statut de la caméra
 * @type {HTMLElement}
 */
const statutCamera = document.getElementById("cameraStatus");

/**
 * Configuration de numérisation optimisée pour les lettres et étiquettes
 * @type {Object}
 */
const configNumerisation = { haut: 0.25, gauche: 0.05, largeur: 0.9, hauteur: 0.5 }; // Grande zone couvrant les deux types de documents

/**
 * Démarre la caméra et initialise le flux vidéo
 */
async function demarrerCamera() {
    if (fluxCamera) {
        fluxCamera.getTracks().forEach(track => track.stop());
    }
    if(statutCamera) statutCamera.textContent = "Démarrage de la caméra...";
    try {
        const contraintes = {
            video: {
                facingMode: 'environment' // Prioriser la caméra arrière
            }
        };
        fluxCamera = await navigator.mediaDevices.getUserMedia(contraintes);
        fluxVideo.srcObject = fluxCamera;
        fluxVideo.onloadedmetadata = () => {
            if(statutCamera) statutCamera.textContent = "Prêt à capturer.";
        };
    } catch (erreur) {
        console.error("Erreur caméra:", erreur);
        if(statutCamera) statutCamera.textContent = "Erreur caméra. Vérifiez les permissions.";
        // Si la caméra arrière échoue, essayer la caméra par défaut
        try {
            const contraintesCameraParDefaut = { video: true };
            fluxCamera = await navigator.mediaDevices.getUserMedia(contraintesCameraParDefaut);
            fluxVideo.srcObject = fluxCamera;
            fluxVideo.onloadedmetadata = () => {
                if(statutCamera) statutCamera.textContent = "Prêt à capturer.";
            };
        } catch (e) {
            console.error("Erreur caméra (fallback):", e);
            if(statutCamera) statutCamera.textContent = "Impossible d'accéder à la caméra.";
        }
    }
}

/**
 * Arrête la caméra et nettoie le flux
 */
function arreterCamera() {
    if (fluxCamera) {
        fluxCamera.getTracks().forEach(track => track.stop());
        fluxCamera = null;
        fluxVideo.srcObject = null;
    }
}

/**
 * Met à jour la région de numérisation sur la vidéo
 */
function mettreAJourRegionNumerisation() {
    const regionNumerisation = document.getElementById('scanRegion');
    if (!regionNumerisation || !fluxVideo) return;

    regionNumerisation.style.top = (configNumerisation.haut * 100) + '%';
    regionNumerisation.style.left = (configNumerisation.gauche * 100) + '%';
    regionNumerisation.style.width = (configNumerisation.largeur * 100) + '%';
    regionNumerisation.style.height = (configNumerisation.hauteur * 100) + '%';
}

if (boutonCamera && popupCamera && fermeturePopupCamera) {
    boutonCamera.addEventListener("click", () => {
        popupCamera.classList.remove("hidden");
        demarrerCamera();
        mettreAJourRegionNumerisation();
    });

    fermeturePopupCamera.addEventListener("click", () => {
        popupCamera.classList.add("hidden");
        arreterCamera();
    });

    const boutonCapturer = document.getElementById("captureBtn");
    const toileCapture = document.getElementById("captureCanvas");

    if (boutonCapturer && toileCapture) {
        boutonCapturer.addEventListener('click', async () => {
            if (!fluxCamera) {
                if(statutCamera) statutCamera.textContent = "Aucun flux caméra actif.";
                return;
            }

            // --- Capture de l'image vers le canvas ---
            const contexte = toileCapture.getContext('2d');
            toileCapture.width = fluxVideo.videoWidth;
            toileCapture.height = fluxVideo.videoHeight;
            contexte.drawImage(fluxVideo, 0, 0, fluxVideo.videoWidth, fluxVideo.videoHeight);

            // --- OCR avec Tesseract ---
            if(statutCamera) statutCamera.textContent = "Analyse de l'image...";

            try {
                const rectangle = {
                    top: fluxVideo.videoHeight * configNumerisation.haut,
                    left: fluxVideo.videoWidth * configNumerisation.gauche,
                    width: fluxVideo.videoWidth * configNumerisation.largeur,
                    height: fluxVideo.videoHeight * configNumerisation.hauteur
                };

                const resultat = await Tesseract.recognize(
                    toileCapture,
                    'fra', // Langue française
                    {
                        logger: m => {
                            console.log(m);
                            if(statutCamera && m.status === 'recognizing text') {
                                statutCamera.textContent = `Analyse... ${Math.round(m.progress * 100)}%`;
                            }
                        },
                        rectangle: rectangle
                    }
                );

                const texteReconnu = resultat.data.text;
                console.log('Texte reconnu:', texteReconnu);

                const adresseAnalysée = analyserAdresseDepuisTexte(texteReconnu);
                console.log('Adresse analysée:', adresseAnalysée);

                rechercherDepuisOCR(adresseAnalysée);

            } catch (erreur) {
                console.error("Erreur OCR:", erreur);
                if(statutCamera) statutCamera.textContent = "Erreur lors de l'analyse.";
            }
        });
    }
}

/**
 * Positionne la zone vocale de manière fixe en bas de l'écran, au-dessus du pied de page
 */
function positionnerZoneVocale() {
    const zoneVocale = document.querySelector('.voice-zone');
    const piedPage = document.querySelector('.app-footer');
    if (!zoneVocale || !piedPage) return;

    const hauteurPiedPage = piedPage.offsetHeight;
    const hauteurZoneVocale = zoneVocale.offsetHeight;

    // Positionner la zone vocale de manière fixe en bas de l'écran, au-dessus du pied de page
    zoneVocale.style.position = 'fixed';
    zoneVocale.style.bottom = hauteurPiedPage + 'px';
    zoneVocale.style.left = '50%';
    zoneVocale.style.transform = 'translateX(-50%)';
    zoneVocale.style.zIndex = '10';
}
