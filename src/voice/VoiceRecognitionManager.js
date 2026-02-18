/**
 * =====================================
 * GESTIONNAIRE DE RECONNAISSANCE VOCALE
 * =====================================
 * Classe responsable de la gestion de la reconnaissance vocale
 */

import { playBeep, createAddressTable, showAlert } from '../utils/Utilities.js';

export default class VoiceRecognitionManager {
    constructor(dataManager) {
        /**
         * Instance du gestionnaire de données
         * @type {DataManager}
         */
        this.dataManager = dataManager;

        /**
         * Dernier texte reconnu par la reconnaissance vocale
         * @type {string}
         */
        this.lastRecognized = '';

        /**
         * Objet de reconnaissance vocale
         * @type {SpeechRecognition|null}
         */
        this.speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        /**
         * Instance de reconnaissance vocale configurée
         * @type {SpeechRecognition|null}
         */
        this.recognition = this.speechRecognition ? new this.speechRecognition() : null;

        if (this.recognition) {
            this.recognition.lang = 'fr-FR';
            this.recognition.interimResults = false;
            this._initializeListeners();
        }
    }

    /**
     * Initialise les écouteurs d'événements pour la reconnaissance vocale
     * @private
     */
    _initializeListeners() {
        this.recognition.onresult = (event) => {
            const transcription = (event.results && 
                event.results[0] && 
                event.results[0][0] && 
                event.results[0][0].transcript) ?
                event.results[0][0].transcript.toLowerCase() : '';
            
            this.lastRecognized = transcription ? transcription.split(' ').pop() : '';
            this._showSearchConfirmation();
        };

        this.recognition.onerror = (event) => {
            console.error('Erreur reconnaissance vocale', event);
            this._updateStatus('Erreur reconnaissance');
            showAlert('Erreur reconnaissance vocale : ' + (event.error || 'inconnue'));
        };

        this.recognition.onnomatch = () => {
            this._updateStatus('Aucun résultat');
        };

        this.recognition.onend = () => {
            this._removeListeningClass();
            this._updateStatus('Prêt.');
        };
    }

    /**
     * Démarre la reconnaissance vocale
     */
    startRecognition() {
        if (!this.dataManager.selectedArm) {
            showAlert('Sélectionnez d\'abord un BRAS');
            return;
        }

        playBeep();
        this._addListeningClass();
        this._updateStatus('J\'écoute...');

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Erreur démarrage reconnaissance vocale:', error);
            showAlert('Impossible de démarrer la reconnaissance vocale. Vérifiez les permissions du micro et le contexte (HTTPS).');
            this._updateStatus('Erreur micro');
        }
    }

    /**
     * Confirme et effectue la recherche vocale
     */
    confirmVoiceSearch() {
        const results = this.dataManager.searchAddresses(this.lastRecognized);

        if (results.length > 0) {
            this._showSearchResults(results);
        } else {
            showAlert('Aucun résultat pour : ' + this.lastRecognized);
        }

        this._hideConfirmationPopup();
    }

    /**
     * Réessaie la reconnaissance vocale
     */
    retryRecognition() {
        this._hideConfirmationPopup();
        this.startRecognition();
    }

    /**
     * Annule la reconnaissance vocale
     */
    cancelRecognition() {
        this._hideConfirmationPopup();
        this._updateStatus('Annulé.');
    }

    /**
     * Affiche la popup de confirmation de recherche
     * @private
     */
    _showSearchConfirmation() {
        const popup = document.getElementById('voicePopupOverlay');
        const confirmText = document.getElementById('voiceConfirmText');
        if (popup && confirmText) {
            confirmText.textContent = `Chercher "${this.lastRecognized}" ?`;
            popup.classList.remove('hidden');
        }
    }

    /**
     * Cache la popup de confirmation
     * @private
     */
    _hideConfirmationPopup() {
        const popup = document.getElementById('voicePopupOverlay');
        if (popup) {
            popup.classList.add('hidden');
        }
    }

    /**
     * Affiche les résultats de recherche dans une popup
     * @param {Array<Object>} results - Les résultats à afficher
     * @private
     */
    _showSearchResults(results) {
        const html = createAddressTable(results);

        const popupContent = document.getElementById('popupContent');
        const popupTitle = document.getElementById('popupTitle');
        const popup = document.getElementById('popupOverlay');

        if (popupContent && popupTitle && popup) {
            popupContent.innerHTML = html;
            popupTitle.textContent = 'Résultats';
            popup.classList.remove('hidden');
        }
    }

    /**
     * Met à jour le texte de statut
     * @param {string} text - Le nouveau texte de statut
     * @private
     */
    _updateStatus(text) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = text;
        }
    }

    /**
     * Ajoute la classe d'écoute au bouton vocal
     * @private
     */
    _addListeningClass() {
        const voiceButton = document.getElementById('voiceBtn');
        if (voiceButton) {
            voiceButton.classList.add('listening');
        }
    }

    /**
     * Retire la classe d'écoute du bouton vocal
     * @private
     */
    _removeListeningClass() {
        const voiceButton = document.getElementById('voiceBtn');
        if (voiceButton) {
            voiceButton.classList.remove('listening');
        }
    }

    /**
     * Vérifie si la reconnaissance vocale est disponible
     * @returns {boolean} True si disponible
     */
    isAvailable() {
        return this.recognition !== null;
    }
}
