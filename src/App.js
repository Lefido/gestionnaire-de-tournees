/**
 * =====================================
 * APPLICATION PRINCIPALE
 * =====================================
 * Point d'entrée principal de l'application Gestionnaire-Tournées
 */

// Import des modules
import DataManager from './data/DataManager.js';
import VoiceRecognitionManager from './voice/VoiceRecognitionManager.js';
import CameraManager from './camera/CameraManager.js';
import UIManager from './ui/UIManager.js';

/**
 * Classe principale de l'application
 */
export default class App {
    constructor() {
        /**
         * Gestionnaire de données
         * @type {DataManager}
         */
        this.dataManager = null;

        /**
         * Gestionnaire de reconnaissance vocale
         * @type {VoiceRecognitionManager}
         */
        this.voiceManager = null;

        /**
         * Gestionnaire de caméra
         * @type {CameraManager}
         */
        this.cameraManager = null;

        /**
         * Gestionnaire d'interface utilisateur
         * @type {UIManager}
         */
        this.uiManager = null;
    }

    /**
     * Initialise l'application
     */
    initialize() {
        console.log('Initialisation de l\'application Gestionnaire-Tournées...');

        // Créer les instances des gestionnaires
        this.dataManager = new DataManager();
        this.voiceManager = new VoiceRecognitionManager(this.dataManager);
        this.cameraManager = new CameraManager(this.dataManager);
        this.uiManager = new UIManager(this.dataManager, this.voiceManager, this.cameraManager);

        // Configurer les gestionnaires d'événements globaux
        this._setupEventListeners();

        // Initialiser l'interface utilisateur
        this.uiManager.initializeApp();

        console.log('Application initialisée avec succès.');
    }

    /**
     * Configure les écouteurs d'événements globaux
     * @private
     */
    _setupEventListeners() {
        // Import Excel
        const excelFileInput = document.getElementById('excelFile');
        if (excelFileInput) {
            excelFileInput.addEventListener('change', (e) => this._handleExcelImport(e));
        }

        // Gestion des modales et panneaux
        const confirmBtn = document.getElementById('confirmBtn');
        const retryBtn = document.getElementById('retryBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const popupClose = document.getElementById('popupClose');
        const modeToggle = document.getElementById('modeToggle');
        const clearStorageBtn = document.getElementById('clearStorageBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        const exportExcelBtn = document.getElementById('exportExcelBtn');

        if (confirmBtn) {
            confirmBtn.onclick = () => this.voiceManager.confirmVoiceSearch();
        }
        if (retryBtn) {
            retryBtn.onclick = () => this.voiceManager.retryRecognition();
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => this.voiceManager.cancelRecognition();
        }
        if (popupClose) {
            popupClose.onclick = () => {
                const popup = document.getElementById('popupOverlay');
                if (popup) popup.classList.add('hidden');
            };
        }
        if (modeToggle) {
            modeToggle.onclick = () => this.uiManager.toggleMode(modeToggle);
        }
        if (clearStorageBtn) {
            clearStorageBtn.onclick = () => {
                if (confirm('Voulez-vous vraiment effacer toutes les données chargées ?')) {
                    this.dataManager.clearData();
                    location.reload();
                }
            };
        }
        if (voiceBtn && this.voiceManager.isAvailable()) {
            voiceBtn.onclick = () => this.voiceManager.startRecognition();
        }
        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => this.dataManager.exportToExcel();
        }
    }

    /**
     * Gère l'importation du fichier Excel
     * @param {Event} e - Événement de changement du fichier
     * @private
     */
    async _handleExcelImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await this.dataManager.importFromExcel(file);
            this.uiManager.refreshUI();
            this.uiManager._checkDataWarning();
            alert('Données importées avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            alert('Erreur lors de l\'importation du fichier.');
        }
    }
}

// Instance globale de l'application
let app;

/**
 * Point d'entrée - s'exécute au chargement du DOM
 */
window.addEventListener('DOMContentLoaded', () => {
    app = new App();
    app.initialize();
});

// Export pour accès global (si nécessaire)
window.App = App;
