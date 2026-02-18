/**
 * =====================================
 * GESTIONNAIRE DE DONNÉES
 * =====================================
 * Classe responsable de la gestion des données Excel importées
 */

import { STORAGE_KEYS, normalizeText } from '../utils/Utilities.js';

export default class DataManager {
    constructor() {
        /**
         * Données Excel chargées depuis le fichier importé
         * @type {Array<Object>}
         */
        this.excelData = [];

        /**
         * Bras de distribution actuellement sélectionné
         * @type {string}
         */
        this.selectedArm = '';

        /**
         * Ville actuellement sélectionnée
         * @type {string}
         */
        this.selectedCity = '';

        /**
         * Nom du fichier Excel importé
         * @type {string}
         */
        this.fileName = '';
    }

    /**
     * Charge les données depuis le localStorage
     */
    loadFromStorage() {
        const savedData = localStorage.getItem(STORAGE_KEYS.DATA);
        if (savedData) {
            this.excelData = JSON.parse(savedData);
        }
        
        // Charger le nom du fichier
        const savedFileName = localStorage.getItem(STORAGE_KEYS.FILENAME);
        if (savedFileName) {
            this.fileName = savedFileName;
        }
    }

    /**
     * Sauvegarde les données dans le localStorage
     */
    saveToStorage() {
        localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(this.excelData));
    }

    /**
     * Importe les données depuis un fichier Excel
     * @param {File} file - Le fichier Excel à importer
     * @returns {Promise<void>}
     */
    async importFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.SheetNames[0];
                    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

                    // Transformation des données Excel en format interne
                    this.excelData = rawData.map(row => ({
                        BRAS: String(row.BRAS || '').trim().toLowerCase(),
                        Ville: String(row.Ville || '').trim().toLowerCase(),
                        Adresse: String(row.Adresse || '').trim().toLowerCase(),
                        Numero: String(row['Numéro de tournée'] || row['Numéro'] || '').trim(),
                        TypeRecherche: String(row['Type Recherche'] || '').trim()
                    }));

                    // Sauvegarder le nom du fichier
                    this.fileName = file.name;
                    localStorage.setItem(STORAGE_KEYS.FILENAME, this.fileName);

                    this.saveToStorage();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Recherche des adresses selon les critères spécifiés
     * @param {string} searchTerm - Le terme à rechercher
     * @param {string} searchType - Le type de recherche (1 ou 2)
     * @returns {Array<Object>} Les résultats de recherche
     */
    searchAddresses(searchTerm, searchType = null) {
        const normalizedValue = normalizeText(searchTerm);

        return this.excelData.filter(r =>
            r.BRAS === this.selectedArm &&
            (!this.selectedCity || r.Ville === this.selectedCity) &&
            (!searchType || r.TypeRecherche === searchType) &&
            normalizeText(r.Adresse).includes(normalizedValue)
        );
    }

    /**
     * Obtient la liste des bras uniques triés
     * @returns {Array<string>} Liste des bras
     */
    getUniqueArms() {
        return [...new Set(this.excelData.map(item => item.BRAS))].filter(arm => arm).sort();
    }

    /**
     * Obtient la liste des villes pour un bras donné
     * @param {string} arm - Le bras pour lequel obtenir les villes
     * @returns {Array<string>} Liste des villes
     */
    getCitiesForArm(arm) {
        return [...new Set(this.excelData.filter(r => r.BRAS === arm).map(r => r.Ville))].filter(city => city).sort();
    }

    /**
     * Vérifie si des données sont disponibles
     * @returns {boolean} True si des données sont chargées
     */
    hasData() {
        return this.excelData.length > 0;
    }

    /**
     * Efface toutes les données
     */
    clearData() {
        this.excelData = [];
        this.selectedArm = '';
        this.selectedCity = '';
        localStorage.clear();
    }

    /**
     * Ajoute une nouvelle adresse
     * @param {Object} address - L'adresse à ajouter
     */
    addAddress(address) {
        this.excelData.push({
            BRAS: String(address.BRAS || '').trim().toLowerCase(),
            Ville: String(address.Ville || '').trim().toLowerCase(),
            Adresse: String(address.Adresse || '').trim().toLowerCase(),
            Numero: String(address.Numero || '').trim(),
            TypeRecherche: String(address.TypeRecherche || '').trim()
        });
        this.saveToStorage();
    }

    /**
     * Modifie une adresse existante
     * @param {number} index - L'index de l'adresse à modifier
     * @param {Object} address - Les nouvelles données de l'adresse
     */
    modifyAddress(index, address) {
        if (index >= 0 && index < this.excelData.length) {
            this.excelData[index] = {
                BRAS: String(address.BRAS || '').trim().toLowerCase(),
                Ville: String(address.Ville || '').trim().toLowerCase(),
                Adresse: String(address.Adresse || '').trim().toLowerCase(),
                Numero: String(address.Numero || '').trim(),
                TypeRecherche: String(address.TypeRecherche || '').trim()
            };
            this.saveToStorage();
        }
    }

    /**
     * Supprime une adresse
     * @param {number} index - L'index de l'adresse à supprimer
     */
    deleteAddress(index) {
        if (index >= 0 && index < this.excelData.length) {
            this.excelData.splice(index, 1);
            this.saveToStorage();
        }
    }

    /**
     * Exporte les données vers un fichier Excel
     * @param {string} fileName - Le nom du fichier d'export (optionnel)
     */
    exportToExcel(fileName = 'tournees_export.xlsx') {
        if (this.excelData.length === 0) {
            alert('Aucune donnée à exporter.');
            return;
        }

        // Préparer les données pour l'export en remettant les majuscules
        const exportData = this.excelData.map(row => ({
            BRAS: row.BRAS,
            Ville: row.Ville,
            Adresse: row.Adresse,
            'Numéro de tournée': row.Numero,
            'Type Recherche': row.TypeRecherche
        }));

        // Créer une nouvelle feuille de calcul
        const sheet = XLSX.utils.json_to_sheet(exportData);

        // Créer un nouveau classeur
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Tournées');

        // Générer et télécharger le fichier
        XLSX.writeFile(workbook, fileName);
    }

    /**
     * Obtient une adresse par son index
     * @param {number} index - L'index de l'adresse
     * @returns {Object|null} L'adresse correspondante ou null
     */
    getAddressByIndex(index) {
        if (index >= 0 && index < this.excelData.length) {
            return { ...this.excelData[index], index: index };
        }
        return null;
    }

    /**
     * Définit le bras sélectionné
     * @param {string} arm - Le bras à sélectionner
     */
    setSelectedArm(arm) {
        this.selectedArm = arm;
        this.selectedCity = '';
    }

    /**
     * Définit la ville sélectionnée
     * @param {string} city - La ville à sélectionner
     */
    setSelectedCity(city) {
        this.selectedCity = city;
    }
}
