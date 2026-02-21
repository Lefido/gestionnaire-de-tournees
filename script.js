/**
 * =====================================
 * GESTIONNAIRE DE DONNÉES EXCEL
 * =====================================
 * Classe responsable de la gestion des données Excel importées
 */
class GestionnaireDonnees {
    constructor() {
        this.donneesExcel = [];
        this.brasSelectionne = '';
        this.villeSelectionnee = '';
        this.nomFichier = '';
    }

    chargerDepuisStockage() {
        const donneesSauvegardees = localStorage.getItem('tourneeData');
        if (donneesSauvegardees) {
            this.donneesExcel = JSON.parse(donneesSauvegardees);
        }
        const nomFichierSauvegarde = localStorage.getItem('tourneeNomFichier');
        if (nomFichierSauvegarde) {
            this.nomFichier = nomFichierSauvegarde;
        }
    }

    sauvegarderDansStockage() {
        localStorage.setItem('tourneeData', JSON.stringify(this.donneesExcel));
    }

    async importerDepuisExcel(fichier) {
        return new Promise((resolve, reject) => {
            const lecteur = new FileReader();
            lecteur.onload = (evt) => {
                try {
                    const donnees = new Uint8Array(evt.target.result);
                    const classeur = XLSX.read(donnees, { type: 'array' });
                    const feuille = classeur.SheetNames[0];
                    const donneesBrutes = XLSX.utils.sheet_to_json(classeur.Sheets[feuille]);

                    this.donneesExcel = donneesBrutes.map(ligne => ({
                        BRAS: String(ligne.BRAS || '').trim().toLowerCase(),
                        Ville: String(ligne.Ville || '').trim().toLowerCase(),
                        Adresse: String(ligne.Adresse || '').trim().toLowerCase(),
                        Numero: String(ligne['Numéro de tournée'] || ligne['Numéro'] || '').trim(),
                        TypeRecherche: String(ligne['Type Recherche'] || '').trim()
                    }));

                    this.nomFichier = fichier.name;
                    localStorage.setItem('tourneeNomFichier', this.nomFichier);
                    this.sauvegarderDansStockage();
                    resolve();
                } catch (erreur) {
                    reject(erreur);
                }
            };
            lecteur.readAsArrayBuffer(fichier);
        });
    }

    rechercherAdresses(termeRecherche, typeRecherche = null) {
        const valeurNormalisee = this.normaliserTexte(termeRecherche);
        return this.donneesExcel.filter(r =>
            r.BRAS === this.brasSelectionne &&
            (!this.villeSelectionnee || r.Ville === this.villeSelectionnee) &&
            (!typeRecherche || r.TypeRecherche === typeRecherche) &&
            this.normaliserTexte(r.Adresse).includes(valeurNormalisee)
        );
    }

    obtenirBrasUniques() {
        return [...new Set(this.donneesExcel.map(l => l.BRAS))].filter(b => b).sort();
    }

    obtenirVillesPourBras(bras) {
        return [...new Set(this.donneesExcel.filter(r => r.BRAS === bras).map(r => r.Ville))].filter(v => v).sort();
    }

    normaliserTexte(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    aDesDonnees() {
        return this.donneesExcel.length > 0;
    }

    effacerDonnees() {
        this.donneesExcel = [];
        this.brasSelectionne = '';
        this.villeSelectionnee = '';
        localStorage.clear();
    }

    ajouterAdresse(adresse) {
        this.donneesExcel.push({
            BRAS: String(adresse.BRAS || '').trim().toLowerCase(),
            Ville: String(adresse.Ville || '').trim().toLowerCase(),
            Adresse: String(adresse.Adresse || '').trim().toLowerCase(),
            Numero: String(adresse.Numero || '').trim(),
            TypeRecherche: String(adresse.TypeRecherche || '').trim()
        });
        this.sauvegarderDansStockage();
    }

    modifierAdresse(index, adresse) {
        if (index >= 0 && index < this.donneesExcel.length) {
            this.donneesExcel[index] = {
                BRAS: String(adresse.BRAS || '').trim().toLowerCase(),
                Ville: String(adresse.Ville || '').trim().toLowerCase(),
                Adresse: String(adresse.Adresse || '').trim().toLowerCase(),
                Numero: String(adresse.Numero || '').trim(),
                TypeRecherche: String(adresse.TypeRecherche || '').trim()
            };
            this.sauvegarderDansStockage();
        }
    }

    supprimerAdresse(index) {
        if (index >= 0 && index < this.donneesExcel.length) {
            this.donneesExcel.splice(index, 1);
            this.sauvegarderDansStockage();
        }
    }

    exporterVersExcel(nomFichier = 'tournees_export.xlsx') {
        if (this.donneesExcel.length === 0) {
            alert('Aucune donnée à exporter.');
            return;
        }

        const donneesExport = this.donneesExcel.map(ligne => ({
            BRAS: ligne.BRAS,
            Ville: ligne.Ville,
            Adresse: ligne.Adresse,
            'Numéro de tournée': ligne.Numero,
            'Type Recherche': ligne.TypeRecherche
        }));

        const feuille = XLSX.utils.json_to_sheet(donneesExport);
        const classeur = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(classeur, feuille, 'Tournées');
        XLSX.writeFile(classeur, nomFichier);
    }

    obtenirAdresseParIndex(index) {
        if (index >= 0 && index < this.donneesExcel.length) {
            return { ...this.donneesExcel[index], index: index };
        }
        return null;
    }
}

// =====================================
// GESTIONNAIRE DE RECONNAISSANCE VOCALE
// =====================================
class GestionnaireReconnaissanceVocale {
    constructor(gestionnaireDonnees) {
        this.gestionnaireDonnees = gestionnaireDonnees;
        this.dernierReconnu = '';
        this.reconnaissanceVocale = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.instance = this.reconnaissanceVocale ? new this.reconnaissanceVocale() : null;

        if (this.instance) {
            this.instance.lang = 'fr-FR';
            this.instance.interimResults = false;
            this.initialiserEcouteurs();
        }
    }

    initialiserEcouteurs() {
        this.instance.onresult = (evenement) => {
            const transcription = (evenement.results && evenement.results[0] && evenement.results[0][0] && evenement.results[0][0].transcript) ?
                evenement.results[0][0].transcript.toLowerCase() : '';
            this.dernierReconnu = transcription ? transcription.split(' ').pop() : '';
            this.afficherConfirmationRecherche();
        };

        this.instance.onerror = (evenement) => {
            console.error('Erreur reconnaissance vocale', evenement);
            this.mettreAJourStatut('Erreur reconnaissance');
            alert('Erreur reconnaissance vocale : ' + (evenement.error || 'inconnue'));
        };

        this.instance.onnomatch = () => {
            this.mettreAJourStatut('Aucun résultat');
        };

        this.instance.onend = () => {
            this.retirerClasseEcoute();
            this.mettreAJourStatut('Prêt.');
        };
    }

    demarrerReconnaissance() {
        if (!this.gestionnaireDonnees.brasSelectionne) {
            alert('Sélectionnez d\'abord un BRAS');
            return;
        }

        this.jouerBip();
        this.ajouterClasseEcoute();
        this.mettreAJourStatut('J\'écoute...');

        try {
            this.instance.start();
        } catch (erreur) {
            console.error('Erreur démarrage reconnaissance vocale:', erreur);
            alert('Impossible de démarrer la reconnaissance vocale. Vérifiez les permissions du micro et le contexte (HTTPS).');
            this.mettreAJourStatut('Erreur micro');
        }
    }

    confirmerRechercheVocale() {
        const resultats = this.gestionnaireDonnees.rechercherAdresses(this.dernierReconnu);

        if (resultats.length > 0) {
            this.afficherResultatsRecherche(resultats);
        } else {
            alert('Aucun résultat pour : ' + this.dernierReconnu);
        }

        this.cacherPopupConfirmation();
    }

    reessayerReconnaissance() {
        this.cacherPopupConfirmation();
        this.demarrerReconnaissance();
    }

    annulerReconnaissance() {
        this.cacherPopupConfirmation();
        this.mettreAJourStatut('Annulé.');
    }

    afficherConfirmationRecherche() {
        const popup = document.getElementById('voicePopupOverlay');
        const texteConfirmation = document.getElementById('voiceConfirmText');
        if (popup && texteConfirmation) {
            texteConfirmation.textContent = `Chercher "${this.dernierReconnu}" ?`;
            popup.classList.remove('hidden');
        }
    }

    cacherPopupConfirmation() {
        const popup = document.getElementById('voicePopupOverlay');
        if (popup) {
            popup.classList.add('hidden');
        }
    }

    afficherResultatsRecherche(resultats) {
        let html = '<table class="popup-table"><tbody>';
        resultats.forEach(r => {
            html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
        });
        html += '</tbody></table>';

        const contenuPopup = document.getElementById('popupContent');
        const titrePopup = document.getElementById('popupTitle');
        const popup = document.getElementById('popupOverlay');

        if (contenuPopup && titrePopup && popup) {
            contenuPopup.innerHTML = html;
            titrePopup.textContent = 'Résultats';
            popup.classList.remove('hidden');
        }
    }

    mettreAJourStatut(texte) {
        const elementStatut = document.getElementById('statusText');
        if (elementStatut) {
            elementStatut.textContent = texte;
        }
    }

    ajouterClasseEcoute() {
        const boutonVocal = document.getElementById('voiceBtn');
        if (boutonVocal) {
            boutonVocal.classList.add('listening');
        }
    }

    retirerClasseEcoute() {
        const boutonVocal = document.getElementById('voiceBtn');
        if (boutonVocal) {
            boutonVocal.classList.remove('listening');
        }
    }

    jouerBip() {
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
        } catch (e) {}
    }

    estDisponible() {
        return this.instance !== null;
    }
}

// =====================================
// GESTIONNAIRE DE CAMÉRA ET OCR
// =====================================
let fluxCamera = null;

class GestionnaireCamera {
    constructor(gestionnaireDonnees) {
        this.gestionnaireDonnees = gestionnaireDonnees;
        this.videoElement = document.getElementById('cameraFeed');
        this.canvasElement = document.getElementById('captureCanvas');
        this.statusElement = document.getElementById('cameraStatus');
        this.popup = document.getElementById('cameraPopupOverlay');
        this.scanConfig = { haut: 0.25, gauche: 0.05, largeur: 0.9, hauteur: 0.5 };
        
        this._initialiserEcouteurs();
    }

    _initialiserEcouteurs() {
        const cameraBtn = document.getElementById('cameraBtn');
        const closeBtn = document.getElementById('cameraPopupClose');
        const captureBtn = document.getElementById('captureBtn');

        if (cameraBtn && this.popup) {
            cameraBtn.addEventListener('click', () => {
                this.popup.classList.remove('hidden');
                this.demarrerCamera();
                this._mettreAJourRegionNumerisation();
            });
        }

        if (closeBtn && this.popup) {
            closeBtn.addEventListener('click', () => {
                this.popup.classList.add('hidden');
                this.arreterCamera();
            });
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this._capturerEtTraiter());
        }

        window.addEventListener('resize', () => this._mettreAJourRegionNumerisation());
    }

    async demarrerCamera() {
        if (fluxCamera) {
            fluxCamera.getTracks().forEach(track => track.stop());
        }
        this._mettreAJourStatut('Démarrage de la caméra...');
        
        try {
            const contraintes = { video: { facingMode: 'environment' } };
            fluxCamera = await navigator.mediaDevices.getUserMedia(contraintes);
            this.videoElement.srcObject = fluxCamera;
            this.videoElement.onloadedmetadata = () => {
                this._mettreAJourStatut('Prêt à capturer.');
            };
        } catch (erreur) {
            console.error('Erreur caméra:', erreur);
            this._mettreAJourStatut('Erreur caméra. Vérifiez les permissions.');
            try {
                const contraintesCameraParDefaut = { video: true };
                fluxCamera = await navigator.mediaDevices.getUserMedia(contraintesCameraParDefaut);
                this.videoElement.srcObject = fluxCamera;
                this.videoElement.onloadedmetadata = () => {
                    this._mettreAJourStatut('Prêt à capturer.');
                };
            } catch (e) {
                console.error('Erreur caméra (fallback):', e);
                this._mettreAJourStatut('Impossible d\'accéder à la caméra.');
            }
        }
    }

    arreterCamera() {
        if (fluxCamera) {
            fluxCamera.getTracks().forEach(track => track.stop());
            fluxCamera = null;
            this.videoElement.srcObject = null;
        }
    }

    _mettreAJourRegionNumerisation() {
        const regionNumerisation = document.getElementById('scanRegion');
        if (!regionNumerisation || !this.videoElement) return;

        regionNumerisation.style.top = (this.scanConfig.haut * 100) + '%';
        regionNumerisation.style.left = (this.scanConfig.gauche * 100) + '%';
        regionNumerisation.style.width = (this.scanConfig.largeur * 100) + '%';
        regionNumerisation.style.height = (this.scanConfig.hauteur * 100) + '%';
    }

    async _capturerEtTraiter() {
        if (!fluxCamera) {
            this._mettreAJourStatut('Aucun flux caméra actif.');
            return;
        }

        const contexte = this.canvasElement.getContext('2d');
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        contexte.drawImage(this.videoElement, 0, 0, this.videoElement.videoWidth, this.videoElement.videoHeight);

        this._mettreAJourStatut('Analyse de l\'image...');

        try {
            const rectangle = {
                top: this.videoElement.videoHeight * this.scanConfig.haut,
                left: this.videoElement.videoWidth * this.scanConfig.gauche,
                width: this.videoElement.videoWidth * this.scanConfig.largeur,
                height: this.videoElement.videoHeight * this.scanConfig.hauteur
            };

            const resultat = await Tesseract.recognize(
                this.canvasElement,
                'fra',
                {
                    logger: m => {
                        console.log(m);
                        if (this.statusElement && m.status === 'recognizing text') {
                            this._mettreAJourStatut(`Analyse... ${Math.round(m.progress * 100)}%`);
                        }
                    },
                    rectangle: rectangle
                }
            );

            const texteReconnu = resultat.data.text;
            console.log('Texte reconnu:', texteReconnu);

            const adresseAnalysée = this._analyserAdresseDepuisTexte(texteReconnu);
            console.log('Adresse analysée:', adresseAnalysée);

            this._rechercherDepuisOCR(adresseAnalysée);

        } catch (erreur) {
            console.error('Erreur OCR:', erreur);
            this._mettreAJourStatut('Erreur lors de l\'analyse.');
        }
    }

    _analyserAdresseDepuisTexte(texte) {
        const lignes = texte.split('\n').map(ligne => ligne.trim()).filter(ligne => ligne);
        let ville = '';
        let rue = '';

        const regexCodePostal = /\b(\d{5})\b/;
        const regexRue = /\b(rue|boulevard|bd|avenue|av|place|pl|chemin|impasse|allee|route|rt|voie|square|sq|cours|imp|passage|pass|quai|pont|carrefour|car|résidence|res|lotissement|lot|zone|zn|parc|prk)\b/i;

        for (const ligne of lignes) {
            const correspondance = ligne.match(regexCodePostal);
            if (correspondance) {
                const apresCode = ligne.substring(correspondance.index + correspondance[0].length).replace(/[^a-zA-Z\s-]/g, '').trim();
                const mots = apresCode.split(/\s+/).filter(m => m.length > 1);
                ville = mots.slice(0, 3).join(' ');
                if (ville) break;
            }
        }

        for (const ligne of lignes) {
            if (regexRue.test(ligne)) {
                let nettoye = ligne.replace(/^\d+\s*/, '');
                nettoye = nettoye.replace(regexRue, '').replace(/[,.-]/g, '').trim();
                const mots = nettoye.split(/\s+/).filter(m => m.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(m));
                rue = mots.join(' ');
                if (rue) break;
            }
        }

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

        const motsRue = rue.split(/\s+/).filter(m => m.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(m));
        const dernierMotRue = motsRue.length > 0 ? motsRue[motsRue.length - 1] : '';

        return { ville: ville, rue: rue, dernierMotRue: dernierMotRue };
    }

    _rechercherDepuisOCR(adresseAnalysée) {
        const termeRecherche = adresseAnalysée.dernierMotRue || adresseAnalysée.rue || adresseAnalysée.ville;
        
        if (!termeRecherche) {
            alert('Aucun terme de recherche valide n\'a pu être extrait de l\'image.');
            return;
        }

        const resultatsFiltres = this.gestionnaireDonnees.rechercherAdresses(termeRecherche);

        if (resultatsFiltres.length > 0) {
            let html = '<table class="popup-table"><tbody>';
            resultatsFiltres.forEach(r => {
                html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
            });
            document.getElementById('popupContent').innerHTML = html + '</tbody></table>';
            document.getElementById('popupTitle').textContent = 'Résultats de la recherche image';
            document.getElementById('popupOverlay').classList.remove('hidden');
        } else {
            alert('Aucun résultat pour : ' + termeRecherche);
        }

        this.popup.classList.add('hidden');
        this.arreterCamera();
    }

    _mettreAJourStatut(texte) {
        if (this.statusElement) {
            this.statusElement.textContent = texte;
        }
    }
}

// =====================================
// UTILITAIRES
// =====================================
function vibrerAuClic() {
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// =====================================
// GESTIONNAIRE D'INTERFACE UTILISATEUR
// =====================================
class GestionnaireInterface {
    constructor(gestionnaireDonnees, gestionnaireReconnaissance, gestionnaireCamera) {
        this.gestionnaireDonnees = gestionnaireDonnees;
        this.gestionnaireReconnaissance = gestionnaireReconnaissance;
        this.gestionnaireCamera = gestionnaireCamera;
    }

    initialiserApplication() {
        this.gestionnaireDonnees.chargerDepuisStockage();
        this.rafraichirInterface();
        this.verifierAvertissementDonnees();
        this.positionnerZoneVocale();
        window.addEventListener('resize', () => this.positionnerZoneVocale());
        this.initialiserToggles();
        this.initialiserRecherche();
        this.initialiserReconnaissanceVocale();
        this.initialiserEcouteursGlobaux();
        this.initialiserGestionAdresses();
    }

    initialiserToggles() {
        const toggleCamera = document.getElementById('cameraToggle');
        const boutonCamera = document.getElementById('cameraBtn');

        if (toggleCamera && boutonCamera) {
            const cameraActivee = localStorage.getItem('cameraEnabled') === 'true';
            toggleCamera.checked = cameraActivee;
            boutonCamera.classList.toggle('hidden', !cameraActivee);

            toggleCamera.addEventListener('change', () => {
                const estCoche = toggleCamera.checked;
                boutonCamera.classList.toggle('hidden', !estCoche);
                localStorage.setItem('cameraEnabled', estCoche);
            });
        }

        const toggleTheme = document.getElementById('themeToggle');
        if (toggleTheme) {
            const themeSombre = localStorage.getItem('themeSombre') !== 'false';
            toggleTheme.checked = themeSombre;
            document.documentElement.classList.toggle('light-theme', !themeSombre);

            toggleTheme.addEventListener('change', () => {
                const estSombre = toggleTheme.checked;
                document.documentElement.classList.toggle('light-theme', !estSombre);
                localStorage.setItem('themeSombre', estSombre);
            });
        }
    }

    initialiserRecherche() {
        const champRecherche = document.getElementById('liveSearchInput');
        const conteneurRecherche = document.getElementById('liveSearchContainer');

        champRecherche.addEventListener('focus', () => {
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

        champRecherche.addEventListener('blur', () => {
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

        document.getElementById('liveSearchInput').addEventListener('input', (e) => {
            this.gererRechercheTempsReel(e.target.value);
        });

        document.getElementById('clearSearchBtn').onclick = () => {
            this.effacerRecherche();
        };
    }

    gererRechercheTempsReel(valeurRecherche) {
        const valeurNormalisee = this.gestionnaireDonnees.normaliserTexte(valeurRecherche.trim());
        const divResultats = document.getElementById('liveSearchResults');
        document.getElementById('clearSearchBtn').style.display = valeurNormalisee ? 'flex' : 'none';

        if (valeurNormalisee.length < 2 || !this.gestionnaireDonnees.brasSelectionne) {
            divResultats.innerHTML = '';
            divResultats.style.display = 'none';
            return;
        }

        let resultatsFiltres = this.gestionnaireDonnees.rechercherAdresses(valeurNormalisee, '1');
        let estAlternatif = false;

        if (resultatsFiltres.length === 0) {
            resultatsFiltres = this.gestionnaireDonnees.rechercherAdresses('', '2');
            estAlternatif = true;
        }

        if (resultatsFiltres.length > 0) {
            divResultats.style.display = 'block';
            let html = '<table class="popup-table"><tbody>';
            if (estAlternatif) {
                html = '<p style="color: #ff6b6b; font-weight: bold; text-align: center; margin-bottom: 5px;">Aucun résultat trouvé. Résultats alternatifs :</p>' + html;
            }
            resultatsFiltres.forEach(r => {
                html += `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`;
            });
            divResultats.innerHTML = html + '</tbody></table>';
        } else {
            divResultats.style.display = 'none';
        }
    }

    effacerRecherche() {
        document.getElementById('liveSearchInput').value = '';
        document.getElementById('liveSearchResults').style.display = 'none';
        document.getElementById('clearSearchBtn').style.display = 'none';
    }

    initialiserReconnaissanceVocale() {
        const boutonVocal = document.getElementById('voiceBtn');
        const texteStatut = document.getElementById('statusText');

        if (!this.gestionnaireReconnaissance.estDisponible()) {
            if (boutonVocal) {
                boutonVocal.disabled = true;
                boutonVocal.setAttribute('aria-disabled', 'true');
            }
            if (texteStatut) texteStatut.textContent = 'Commande vocale non disponible';
        } else {
            if (texteStatut && texteStatut.textContent.trim() === '') texteStatut.textContent = 'Prêt.';
        }

        const popupVocale = document.getElementById('voicePopupOverlay');
        if (popupVocale) { popupVocale.classList.add('hidden'); }
    }

    initialiserEcouteursGlobaux() {
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', vibrerAuClic);
        });

        const importLabel = document.querySelector('label[for="excelFile"]');
        if (importLabel) {
            importLabel.addEventListener('click', vibrerAuClic);
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
        });
    }

    verifierAvertissementDonnees() {
        const avertissement = document.getElementById('noFileWarning');
        if (avertissement) avertissement.style.display = (this.gestionnaireDonnees.aDesDonnees()) ? 'none' : 'block';

        const titreBras = document.querySelector('#userPanel h2:first-of-type');
        const conteneurBras = document.getElementById('brasBtnContainer');
        const conteneurRecherche = document.getElementById('liveSearchContainer');
        const zoneVocale = document.querySelector('.voice-zone');
        const titreVille = document.getElementById('titleVille');
        const aDonnees = this.gestionnaireDonnees.aDesDonnees();
        const aSelectionne = this.gestionnaireDonnees.brasSelectionne !== '';

        if (titreBras) titreBras.style.display = aDonnees ? 'block' : 'none';
        if (conteneurBras) conteneurBras.style.display = aDonnees ? 'flex' : 'none';
        if (conteneurRecherche) conteneurRecherche.style.display = (aDonnees && aSelectionne) ? 'block' : 'none';
        if (zoneVocale) zoneVocale.style.display = (aDonnees && aSelectionne) ? 'flex' : 'none';
        if (titreVille) {
            if (aSelectionne) {
                titreVille.classList.remove('hidden');
            } else {
                titreVille.classList.add('hidden');
            }
        }
    }

    rafraichirInterface() {
        const cardsContent = document.getElementById('addressesCardsContent');
        if (cardsContent) {
            cardsContent.innerHTML = '';
            
            const brasGroupes = {};
            this.gestionnaireDonnees.donneesExcel.forEach((ligne, index) => {
                const bras = ligne.BRAS;
                if (!brasGroupes[bras]) {
                    brasGroupes[bras] = [];
                }
                brasGroupes[bras].push({ ...ligne, index });
            });
            
            const brasTries = Object.keys(brasGroupes).sort();
            
            brasTries.forEach(bras => {
                const brasDetails = document.createElement('details');
                brasDetails.className = 'bras-details';
                
                const brasSummary = document.createElement('summary');
                brasSummary.className = 'bras-summary';
                brasSummary.textContent = bras.toUpperCase();
                brasDetails.appendChild(brasSummary);
                
                const cardsGrid = document.createElement('div');
                cardsGrid.className = 'address-cards-grid';
                
                brasGroupes[bras].forEach((item) => {
                    const card = document.createElement('div');
                    card.className = 'address-card';
                    card.innerHTML = `
                        <div class="card-field">
                            <i class="fas fa-city"></i>
                            <span>${item.Ville}</span>
                        </div>
                        <div class="card-field">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${item.Adresse}</span>
                        </div>
                        <div class="card-field">
                            <i class="fas fa-hashtag"></i>
                            <span>${item.Numero}</span>
                        </div>
                        <div class="card-actions">
                            <button class="action-btn edit-btn" onclick="gestionnaireInterface.modifierAdresse(${item.index})" title="Modifier">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="gestionnaireInterface.supprimerAdresse(${item.index})" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    cardsGrid.appendChild(card);
                });
                
                brasDetails.appendChild(cardsGrid);
                cardsContent.appendChild(brasDetails);
            });
            
            if (brasTries.length === 0) {
                cardsContent.innerHTML = '<p class="no-data-msg">Aucune adresse importée</p>';
            }
        }

        const affichageNomFichier = document.getElementById('fileNameDisplay');
        if (affichageNomFichier) {
            affichageNomFichier.textContent = this.gestionnaireDonnees.nomFichier || '';
        }

        const brasUniques = this.gestionnaireDonnees.obtenirBrasUniques();
        const conteneur = document.getElementById('brasBtnContainer');
        if (conteneur) {
            conteneur.innerHTML = '';
            brasUniques.forEach((bras, index) => {
                const bouton = document.createElement('button');
                bouton.className = 'city-btn city-appear';
                bouton.style.animationDelay = (index * 0.1) + 's';
                bouton.textContent = bras;
                bouton.onclick = () => {
                    this.selectionnerBras(bras, bouton);
                    vibrerAuClic();
                };
                conteneur.appendChild(bouton);
            });
        }
    }

    selectionnerBras(bras, bouton) {
        this.gestionnaireDonnees.brasSelectionne = bras;
        this.gestionnaireDonnees.villeSelectionnee = '';

        document.querySelectorAll('#brasBtnContainer .city-btn').forEach(b => b.classList.remove('active'));
        bouton.classList.add('active');
        document.getElementById('liveSearchInput').value = '';
        document.getElementById('liveSearchResults').style.display = 'none';
        document.getElementById('clearSearchBtn').style.display = 'none';

        document.getElementById('titleVille').classList.remove('hidden');
        const villes = this.gestionnaireDonnees.obtenirVillesPourBras(bras);
        const conteneurVille = document.getElementById('cityBtnContainer');

        const boutonVocal = document.getElementById('voiceBtn');
        let boutonVocalEtaitDansConteneur = false;
        if (boutonVocal && conteneurVille.contains(boutonVocal)) {
            conteneurVille.removeChild(boutonVocal);
            boutonVocalEtaitDansConteneur = true;
        }

        conteneurVille.innerHTML = '';
        villes.forEach((ville, index) => {
            const boutonVille = document.createElement('button');
            boutonVille.className = 'city-btn city-appear';
            boutonVille.style.animationDelay = (index * 0.03) + 's';
            boutonVille.textContent = ville;
            boutonVille.onclick = () => {
                if (this.gestionnaireDonnees.villeSelectionnee === ville) {
                    this.gestionnaireDonnees.villeSelectionnee = '';
                    document.querySelectorAll('#cityBtnContainer .city-btn').forEach(b => b.classList.remove('active'));
                } else {
                    this.gestionnaireDonnees.villeSelectionnee = ville;
                    document.querySelectorAll('#cityBtnContainer .city-btn').forEach(b => b.classList.remove('active'));
                    boutonVille.classList.add('active');
                }
                vibrerAuClic();
            };
            conteneurVille.appendChild(boutonVille);
        });

        if (boutonVocalEtaitDansConteneur) {
            boutonVocal.className = 'city-btn city-appear';
            conteneurVille.appendChild(boutonVocal);
        }

        this.verifierAvertissementDonnees();
    }

    positionnerZoneVocale() {
        const zoneVocale = document.querySelector('.voice-zone');
        const piedPage = document.querySelector('.app-footer');
        if (!zoneVocale || !piedPage) return;

        const hauteurPiedPage = piedPage.offsetHeight;

        zoneVocale.style.position = 'fixed';
        zoneVocale.style.bottom = hauteurPiedPage + 'px';
        zoneVocale.style.left = '50%';
        zoneVocale.style.transform = 'translateX(-50%)';
        zoneVocale.style.zIndex = '10';
    }

    initialiserGestionAdresses() {
        const addAddressBtn = document.getElementById('addAddressBtn');
        const saveAddressBtn = document.getElementById('saveAddressBtn');
        const addressPopupClose = document.getElementById('addressPopupClose');
        const addressPopupOverlay = document.getElementById('addressPopupOverlay');

        if (addAddressBtn) {
            addAddressBtn.onclick = () => {
                document.getElementById('addressBras').value = '';
                document.getElementById('addressVille').value = '';
                document.getElementById('addressRue').value = '';
                document.getElementById('addressNumero').value = '';
                document.getElementById('addressType').value = '1';
                
                document.getElementById('addressPopupTitle').textContent = 'Ajouter une adresse';
                
                const inputFields = ['addressBras', 'addressVille', 'addressRue', 'addressNumero'];
                inputFields.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.oninput = (e) => {
                            e.target.value = e.target.value.toUpperCase();
                        };
                    }
                });
                
                addressPopupOverlay.classList.remove('hidden');
            };
        }

        if (saveAddressBtn) {
            saveAddressBtn.onclick = () => {
                const bras = document.getElementById('addressBras').value.trim().toUpperCase();
                const ville = document.getElementById('addressVille').value.trim().toUpperCase();
                const rue = document.getElementById('addressRue').value.trim().toUpperCase();
                const numero = document.getElementById('addressNumero').value.trim().toUpperCase();
                const typeRecherche = document.getElementById('addressType').value;
                
                if (!bras || !rue) {
                    alert('Veuillez remplir au moins le BRAS et l\'adresse.');
                    return;
                }
                
                const nouvelleAdresse = {
                    BRAS: bras,
                    Ville: ville,
                    Adresse: rue,
                    Numero: numero,
                    TypeRecherche: typeRecherche
                };
                
                this.gestionnaireDonnees.ajouterAdresse(nouvelleAdresse);
                addressPopupOverlay.classList.add('hidden');
                this.rafraichirInterface();
                alert('Adresse ajoutée avec succès !');
            };
        }

        if (addressPopupClose) {
            addressPopupClose.onclick = () => {
                addressPopupOverlay.classList.add('hidden');
            };
        }

        if (addressPopupOverlay) {
            addressPopupOverlay.addEventListener('click', (e) => {
                if (e.target === addressPopupOverlay) {
                    addressPopupOverlay.classList.add('hidden');
                }
            });
        }
    }

    basculerMode(bouton) {
        const panneauAdmin = document.getElementById('adminPanel');
        const panneauUtilisateur = document.getElementById('userPanel');

        const panneauAdminCache = panneauAdmin.classList.contains('hidden');
        if (panneauAdminCache) {
            panneauAdmin.classList.remove('hidden');
            panneauAdmin.style.display = 'block';
            panneauUtilisateur.classList.add('hidden');
            panneauUtilisateur.style.display = 'none';
            bouton.textContent = 'Accueil';
        } else {
            panneauAdmin.classList.add('hidden');
            panneauAdmin.style.display = 'none';
            panneauUtilisateur.classList.remove('hidden');
            panneauUtilisateur.style.display = 'block';
            if (!this.gestionnaireDonnees.brasSelectionne) {
                document.getElementById('titleVille').classList.add('hidden');
            } else {
                document.getElementById('titleVille').classList.remove('hidden');
            }
            if (this.gestionnaireDonnees.brasSelectionne) {
                const boutonVocal = document.getElementById('voiceBtn');
                const zoneVocale = document.querySelector('.voice-zone');
                if (boutonVocal && zoneVocale && !zoneVocale.contains(boutonVocal)) {
                    boutonVocal.className = 'voice-btn';
                    zoneVocale.appendChild(boutonVocal);
                    zoneVocale.style.display = 'flex';
                    this.positionnerZoneVocale();
                }
            }
            bouton.textContent = 'Paramètres';
        }
    }
}

// =====================================
// VARIABLES GLOBALES
// =====================================
let gestionnaireDonnees;
let gestionnaireReconnaissance;
let gestionnaireInterface;
let gestionnaireCamera;

// =====================================
// INITIALISATION
// =====================================
window.addEventListener('DOMContentLoaded', () => {
    gestionnaireDonnees = new GestionnaireDonnees();
    gestionnaireReconnaissance = new GestionnaireReconnaissanceVocale(gestionnaireDonnees);
    gestionnaireCamera = new GestionnaireCamera(gestionnaireDonnees);
    gestionnaireInterface = new GestionnaireInterface(gestionnaireDonnees, gestionnaireReconnaissance, gestionnaireCamera);

    gestionnaireInterface.initialiserApplication();

    // Import Excel
    document.getElementById('excelFile').addEventListener('change', gererImportExcel);

    // Gestion des modales et panneaux
    document.getElementById('confirmBtn').onclick = () => gestionnaireReconnaissance.confirmerRechercheVocale();
    document.getElementById('retryBtn').onclick = () => gestionnaireReconnaissance.reessayerReconnaissance();
    document.getElementById('cancelBtn').onclick = () => gestionnaireReconnaissance.annulerReconnaissance();
    document.getElementById('popupClose').onclick = () => {
        document.getElementById('popupOverlay').classList.add('hidden');
    };

    // Bouton mode (utilisateur/admin)
    document.getElementById('modeToggle').onclick = function() {
        gestionnaireInterface.basculerMode(this);
    };

    // Bouton effacer stockage
    document.getElementById('clearStorageBtn').onclick = () => {
        if (confirm('Voulez-vous vraiment effacer toutes les données chargées ?')) {
            gestionnaireDonnees.effacerDonnees();
            location.reload();
        }
    };

    // Bouton vocal
    if (gestionnaireReconnaissance.estDisponible()) {
        document.getElementById('voiceBtn').onclick = () => gestionnaireReconnaissance.demarrerReconnaissance();
    }

    // Export Excel
    document.getElementById('exportExcelBtn').onclick = () => {
        gestionnaireDonnees.exporterVersExcel();
    };
});

function gererImportExcel(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;

    gestionnaireDonnees.importerDepuisExcel(fichier)
        .then(() => {
            gestionnaireInterface.rafraichirInterface();
            gestionnaireInterface.verifierAvertissementDonnees();
            alert('Données importées avec succès !');
        })
        .catch(erreur => {
            console.error('Erreur lors de l\'import:', erreur);
            alert('Erreur lors de l\'importation du fichier.');
        });
}
