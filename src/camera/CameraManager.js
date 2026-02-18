/**
 * =====================================
 * GESTIONNAIRE DE CAMÉRA ET OCR
 * =====================================
 * Classe responsable de la gestion de la caméra et de la reconnaissance optique de caractères
 */

import { analyzeAddressFromText, createAddressTable, showAlert, APP_CONSTANTS } from '../utils/Utilities.js';

export default class CameraManager {
    constructor(dataManager) {
        /**
         * Instance du gestionnaire de données
         * @type {DataManager}
         */
        this.dataManager = dataManager;

        /**
         * Flux de la caméra actif
         * @type {MediaStream|null}
         */
        this.cameraStream = null;

        /**
         * Élément vidéo pour le flux caméra
         * @type {HTMLVideoElement|null}
         */
        this.videoElement = document.getElementById('cameraFeed');

        /**
         * Canvas pour la capture d'image
         * @type {HTMLCanvasElement|null}
         */
        this.canvasElement = document.getElementById('captureCanvas');

        /**
         * Élément de statut de la caméra
         * @type {HTMLElement|null}
         */
        this.statusElement = document.getElementById('cameraStatus');

        /**
         * Popup caméra
         * @type {HTMLElement|null}
         */
        this.popup = document.getElementById('cameraPopupOverlay');

        /**
         * Configuration de scan
         * @type {Object}
         */
        this.scanConfig = APP_CONSTANTS.OCR.SCAN_CONFIG;

        this._initializeEventListeners();
    }

    /**
     * Initialise les écouteurs d'événements pour la caméra
     * @private
     */
    _initializeEventListeners() {
        const cameraBtn = document.getElementById('cameraBtn');
        const closeBtn = document.getElementById('cameraPopupClose');
        const captureBtn = document.getElementById('captureBtn');

        if (cameraBtn && this.popup) {
            cameraBtn.addEventListener('click', () => {
                this.popup.classList.remove('hidden');
                this.startCamera();
                this._updateScanRegion();
            });
        }

        if (closeBtn && this.popup) {
            closeBtn.addEventListener('click', () => {
                this.popup.classList.add('hidden');
                this.stopCamera();
            });
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this._captureAndProcess());
        }

        // Mettre à jour la région de scan lors du redimensionnement
        window.addEventListener('resize', () => this._updateScanRegion());
    }

    /**
     * Démarre la caméra et initialise le flux vidéo
     */
    async startCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        
        this._updateStatus('Démarrage de la caméra...');
        
        try {
            const constraints = {
                video: {
                    facingMode: 'environment' // Prioriser la caméra arrière
                }
            };
            
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.cameraStream;
            
            this.videoElement.onloadedmetadata = () => {
                this._updateStatus('Prêt à capturer.');
            };
        } catch (error) {
            console.error('Erreur caméra:', error);
            this._updateStatus('Erreur caméra. Vérifiez les permissions.');
            
            // Si la caméra arrière échoue, essayer la caméra par défaut
            try {
                const defaultConstraints = { video: true };
                this.cameraStream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
                this.videoElement.srcObject = this.cameraStream;
                
                this.videoElement.onloadedmetadata = () => {
                    this._updateStatus('Prêt à capturer.');
                };
            } catch (e) {
                console.error('Erreur caméra (fallback):', e);
                this._updateStatus('Impossible d\'accéder à la caméra.');
            }
        }
    }

    /**
     * Arrête la caméra et nettoie le flux
     */
    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
            this.videoElement.srcObject = null;
        }
    }

    /**
     * Met à jour la région de scan sur la vidéo
     * @private
     */
    _updateScanRegion() {
        const scanRegion = document.getElementById('scanRegion');
        if (!scanRegion || !this.videoElement) return;

        scanRegion.style.top = (this.scanConfig.haut * 100) + '%';
        scanRegion.style.left = (this.scanConfig.gauche * 100) + '%';
        scanRegion.style.width = (this.scanConfig.largeur * 100) + '%';
        scanRegion.style.height = (this.scanConfig.hauteur * 100) + '%';
    }

    /**
     * Capture l'image et traite avec OCR
     * @private
     */
    async _captureAndProcess() {
        if (!this.cameraStream) {
            this._updateStatus('Aucun flux caméra actif.');
            return;
        }

        // Capture de l'image vers le canvas
        const context = this.canvasElement.getContext('2d');
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        context.drawImage(this.videoElement, 0, 0, this.videoElement.videoWidth, this.videoElement.videoHeight);

        // OCR avec Tesseract
        this._updateStatus('Analyse de l\'image...');

        try {
            const rectangle = {
                top: this.videoElement.videoHeight * this.scanConfig.haut,
                left: this.videoElement.videoWidth * this.scanConfig.gauche,
                width: this.videoElement.videoWidth * this.scanConfig.largeur,
                height: this.videoElement.videoHeight * this.scanConfig.hauteur
            };

            const result = await Tesseract.recognize(
                this.canvasElement,
                APP_CONSTANTS.OCR.LANGUAGE,
                {
                    logger: m => {
                        console.log(m);
                        if (this.statusElement && m.status === 'recognizing text') {
                            this._updateStatus(`Analyse... ${Math.round(m.progress * 100)}%`);
                        }
                    },
                    rectangle: rectangle
                }
            );

            const recognizedText = result.data.text;
            console.log('Texte reconnu:', recognizedText);

            const analyzedAddress = analyzeAddressFromText(recognizedText);
            console.log('Adresse analysée:', analyzedAddress);

            this._searchFromOCR(analyzedAddress);

        } catch (error) {
            console.error('Erreur OCR:', error);
            this._updateStatus('Erreur lors de l\'analyse.');
        }
    }

    /**
     * Effectue une recherche basée sur l'adresse analysée depuis l'OCR
     * @param {Object} analyzedAddress - L'objet contenant l'adresse analysée
     * @private
     */
    _searchFromOCR(analyzedAddress) {
        const searchTerm = analyzedAddress.lastStreetWord || analyzedAddress.street || analyzedAddress.city;
        
        if (!searchTerm) {
            showAlert('Aucun terme de recherche valide n\'a pu être extrait de l\'image.');
            return;
        }

        const filteredResults = this.dataManager.searchAddresses(searchTerm);

        if (filteredResults.length > 0) {
            const html = createAddressTable(filteredResults);
            document.getElementById('popupContent').innerHTML = html;
            document.getElementById('popupTitle').textContent = 'Résultats de la recherche image';
            document.getElementById('popupOverlay').classList.remove('hidden');
        } else {
            showAlert('Aucun résultat pour : ' + searchTerm);
        }

        this.popup.classList.add('hidden');
        this.stopCamera();
    }

    /**
     * Met à jour le texte de statut
     * @param {string} text - Le nouveau texte de statut
     * @private
     */
    _updateStatus(text) {
        if (this.statusElement) {
            this.statusElement.textContent = text;
        }
    }
}
