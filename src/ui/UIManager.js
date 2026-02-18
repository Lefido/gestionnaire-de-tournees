/**
 * =====================================
 * GESTIONNAIRE D'INTERFACE UTILISATEUR
 * =====================================
 * Classe responsable de la gestion de l'interface utilisateur
 */

import { vibrateOnClick, showAlert, showConfirm, preventPWAInstall, APP_CONSTANTS, STORAGE_KEYS } from '../utils/Utilities.js';

export default class UIManager {
    constructor(dataManager, voiceManager, cameraManager) {
        this.dataManager = dataManager;
        this.voiceManager = voiceManager;
        this.cameraManager = cameraManager;
        this.editingAddressIndex = -1; // -1 pour l'ajout, >= 0 pour la modification
    }

    initializeApp() {
        this.dataManager.loadFromStorage();
        this.refreshUI();
        this._checkDataWarning();
        this._positionVoiceZone();
        window.addEventListener('resize', () => this._positionVoiceZone());
        this._initializeToggles();
        this._initializeSearch();
        this._initializeVoiceRecognition();
        this._initializeGlobalListeners();
        this._initializeAddressManagement();
    }

    _initializeToggles() {
        const cameraToggle = document.getElementById('cameraToggle');
        const cameraButton = document.getElementById('cameraBtn');
        if (cameraToggle && cameraButton) {
            const cameraEnabled = localStorage.getItem(STORAGE_KEYS.CAMERA) === 'true';
            cameraToggle.checked = cameraEnabled;
            cameraButton.classList.toggle('hidden', !cameraEnabled);
            cameraToggle.addEventListener('change', () => {
                const isChecked = cameraToggle.checked;
                cameraButton.classList.toggle('hidden', !isChecked);
                localStorage.setItem(STORAGE_KEYS.CAMERA, isChecked);
            });
        }

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const darkTheme = localStorage.getItem(STORAGE_KEYS.THEME) !== 'false';
            themeToggle.checked = darkTheme;
            document.documentElement.classList.toggle('light-theme', !darkTheme);
            themeToggle.addEventListener('change', () => {
                const isDark = themeToggle.checked;
                document.documentElement.classList.toggle('light-theme', !isDark);
                localStorage.setItem(STORAGE_KEYS.THEME, isDark);
            });
        }
    }

    _initializeSearch() {
        const searchInput = document.getElementById('liveSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this._handleRealTimeSearch(e.target.value));
        }
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.onclick = () => this._clearSearch();
        }
    }

    _handleRealTimeSearch(searchValue) {
        const normalizedValue = searchValue.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const resultsDiv = document.getElementById('liveSearchResults');
        const clearBtn = document.getElementById('clearSearchBtn');
        if(clearBtn) clearBtn.style.display = normalizedValue ? 'flex' : 'none';

        if (normalizedValue.length < APP_CONSTANTS.MIN_SEARCH_LENGTH || !this.dataManager.selectedArm) {
            if (resultsDiv) {
                resultsDiv.innerHTML = '';
                resultsDiv.style.display = 'none';
            }
            return;
        }

        let filteredResults = this.dataManager.searchAddresses(normalizedValue, '1');
        let isAlternative = false;
        if (filteredResults.length === 0) {
            filteredResults = this.dataManager.searchAddresses(normalizedValue, '2');
            isAlternative = true;
        }

        if (resultsDiv) {
            if (filteredResults.length > 0) {
                resultsDiv.style.display = 'block';
                let html = '<table class="popup-table"><tbody>';
                if (isAlternative) {
                    html = '<p style="color: #ff6b6b; font-weight: bold; text-align: center; margin-bottom: 5px;">Aucun résultat trouvé. Résultats alternatifs :</p>' + html;
                }
                html += filteredResults.map(r => `<tr><td>${r.Ville}</td><td>${r.Adresse}</td><td>${r.Numero}</td></tr>`).join('');
                resultsDiv.innerHTML = html + '</tbody></table>';
            } else {
                resultsDiv.style.display = 'none';
            }
        }
    }

    _clearSearch() {
        const searchInput = document.getElementById('liveSearchInput');
        if (searchInput) searchInput.value = '';
        const resultsDiv = document.getElementById('liveSearchResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    _initializeVoiceRecognition() {
        const voiceButton = document.getElementById('voiceBtn');
        const statusText = document.getElementById('statusText');
        if (!this.voiceManager.isAvailable()) {
            if (voiceButton) voiceButton.disabled = true;
            if (statusText) statusText.textContent = 'Commande vocale non disponible';
        } else {
            if (statusText) statusText.textContent = 'Prêt.';
        }
    }

    _initializeGlobalListeners() {
        document.querySelectorAll('button, label[for="excelFile"]').forEach(elem => {
            elem.addEventListener('click', vibrateOnClick);
        });
        window.addEventListener('beforeinstallprompt', preventPWAInstall);
    }
    
    _checkDataWarning() {
        const hasData = this.dataManager.hasData();
        const hasSelectedArm = !!this.dataManager.selectedArm;
        document.getElementById('noFileWarning').style.display = hasData ? 'none' : 'block';
        document.querySelector('#userPanel h2:first-of-type').style.display = hasData ? 'block' : 'none';
        document.getElementById('brasBtnContainer').style.display = hasData ? 'flex' : 'none';
        document.getElementById('liveSearchContainer').style.display = hasData && hasSelectedArm ? 'block' : 'none';
        document.querySelector('.voice-zone').style.display = hasData && hasSelectedArm ? 'flex' : 'none';
        document.getElementById('titleVille').classList.toggle('hidden', !hasSelectedArm);
    }

    refreshUI() {
        const tableBody = document.getElementById('adminTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            this.dataManager.excelData.forEach((row, index) => {
                const isEditing = this.editingAddressIndex === index;
                const tableRow = document.createElement('tr');
                tableRow.id = `row-${index}`;
                if (isEditing) {
                    tableRow.classList.add('editing');
                }
                
                tableRow.innerHTML = `
                    <td contenteditable="${isEditing}">${row.BRAS}</td>
                    <td contenteditable="${isEditing}">${row.Ville}</td>
                    <td contenteditable="${isEditing}">${row.Adresse}</td>
                    <td contenteditable="${isEditing}">${row.Numero}</td>
                    <td class="action-buttons">
                        <button class="edit-btn" title="${isEditing ? 'Sauvegarder' : 'Modifier'}">
                            <i class="fas ${isEditing ? 'fa-save' : 'fa-edit'}"></i>
                        </button>
                        <button class="delete-btn" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                // Correction : Utilisation de addEventListener
                tableRow.querySelector('.edit-btn').addEventListener('click', () => this.toggleEditState(index));
                tableRow.querySelector('.delete-btn').addEventListener('click', () => this.deleteAddress(index));

                tableBody.appendChild(tableRow);
            });
        }

        const fileNameDisplay = document.getElementById('fileNameDisplay');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = this.dataManager.fileName || '';
        }

        const uniqueArms = this.dataManager.getUniqueArms();
        const container = document.getElementById('brasBtnContainer');
        if (container) {
            container.innerHTML = '';
            uniqueArms.forEach((arm, index) => {
                const button = document.createElement('button');
                button.className = 'city-btn city-appear';
                button.style.animationDelay = `${index * APP_CONSTANTS.ANIMATION_DELAY.CITY_BUTTON}s`;
                button.textContent = arm;
                button.onclick = () => {
                    this.selectArm(arm, button);
                    vibrateOnClick();
                };
                container.appendChild(button);
            });
        }
    }

    selectArm(arm, button) {
        this.dataManager.setSelectedArm(arm);
        document.querySelectorAll('#brasBtnContainer .city-btn.active').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        this._clearSearch();
        document.getElementById('titleVille').classList.remove('hidden');

        const cities = this.dataManager.getCitiesForArm(arm);
        const cityContainer = document.getElementById('cityBtnContainer');
        if (cityContainer) {
            cityContainer.innerHTML = '';
            cities.forEach((city, index) => {
                const cityButton = document.createElement('button');
                cityButton.className = 'city-btn city-appear';
                cityButton.style.animationDelay = `${index * APP_CONSTANTS.ANIMATION_DELAY.CITY_BUTTON_INDEX}s`;
                cityButton.textContent = city;
                cityButton.onclick = () => {
                    const isActive = cityButton.classList.contains('active');
                    document.querySelectorAll('#cityBtnContainer .city-btn.active').forEach(b => b.classList.remove('active'));
                    this.dataManager.setSelectedCity(isActive ? '' : city);
                    if (!isActive) cityButton.classList.add('active');
                    vibrateOnClick();
                };
                cityContainer.appendChild(cityButton);
            });
        }
        this._checkDataWarning();
    }

    _positionVoiceZone() {
        const voiceZone = document.querySelector('.voice-zone');
        const footer = document.querySelector('.app-footer');
        if (voiceZone && footer) {
            voiceZone.style.position = 'fixed';
            voiceZone.style.bottom = `${footer.offsetHeight}px`;
            voiceZone.style.left = '50%';
            voiceZone.style.transform = 'translateX(-50%)';
            voiceZone.style.zIndex = '10';
        }
    }
    
    _initializeAddressManagement() {
        const addressPopupOverlay = document.getElementById('addressPopupOverlay');
        const saveAddressBtn = document.getElementById('saveAddressBtn');

        document.getElementById('addAddressBtn').onclick = () => {
            this.editingAddressIndex = -1; // Mode ajout
            document.getElementById('addressPopupTitle').textContent = 'Ajouter une adresse';
            ['addressBras', 'addressVille', 'addressRue', 'addressNumero'].forEach(id => {
                document.getElementById(id).value = '';
                document.getElementById(id).oninput = e => e.target.value = e.target.value.toUpperCase();
            });
            document.getElementById('addressType').value = '1';
            addressPopupOverlay.classList.remove('hidden');
        };

        saveAddressBtn.onclick = () => {
            const address = {
                BRAS: document.getElementById('addressBras').value.trim().toUpperCase(),
                Ville: document.getElementById('addressVille').value.trim().toUpperCase(),
                Adresse: document.getElementById('addressRue').value.trim().toUpperCase(),
                Numero: document.getElementById('addressNumero').value.trim().toUpperCase(),
                TypeRecherche: document.getElementById('addressType').value
            };

            if (!address.BRAS || !address.Adresse) {
                showAlert('Veuillez remplir au moins le BRAS et l\'adresse.');
                return;
            }

            if (this.editingAddressIndex === -1) {
                this.dataManager.addAddress(address);
                showAlert('Adresse ajoutée avec succès !');
            } else {
                this.dataManager.modifyAddress(this.editingAddressIndex, address);
                showAlert('Adresse modifiée avec succès !');
            }
            
            addressPopupOverlay.classList.add('hidden');
            this.refreshUI();
        };

        document.getElementById('addressPopupClose').onclick = () => addressPopupOverlay.classList.add('hidden');
        addressPopupOverlay.addEventListener('click', e => {
            if (e.target === addressPopupOverlay) addressPopupOverlay.classList.add('hidden');
        });
    }

    toggleEditState(index) {
        if (this.editingAddressIndex === index) {
            const rowElement = document.getElementById(`row-${index}`);
            if (rowElement) {
                const cells = rowElement.querySelectorAll('td');
                const updatedAddress = {
                    BRAS: cells[0].textContent.trim().toUpperCase(),
                    Ville: cells[1].textContent.trim().toUpperCase(),
                    Adresse: cells[2].textContent.trim().toUpperCase(),
                    Numero: cells[3].textContent.trim().toUpperCase(),
                    TypeRecherche: this.dataManager.getAddressByIndex(index).TypeRecherche
                };
                
                this.dataManager.modifyAddress(index, updatedAddress);
                showAlert('Adresse mise à jour !');
            }
            this.editingAddressIndex = -1; 
        } else {
            if (this.editingAddressIndex !== -1) {
                this.toggleEditState(this.editingAddressIndex); 
            }
            this.editingAddressIndex = index;
        }
        this.refreshUI();
    }

    async deleteAddress(index) {
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cette adresse ?');
        if (confirmed) {
            this.dataManager.deleteAddress(index);
            showAlert('Adresse supprimée.');
            this.refreshUI();
        }
    }

    toggleMode(button) {
        const adminPanel = document.getElementById('adminPanel');
        const userPanel = document.getElementById('userPanel');
        const isAdminHidden = adminPanel.classList.toggle('hidden');
        userPanel.classList.toggle('hidden', !isAdminHidden);
        
        adminPanel.style.display = isAdminHidden ? 'none' : 'block';
        userPanel.style.display = isAdminHidden ? 'block' : 'none';
        button.textContent = isAdminHidden ? 'Paramètres' : 'Accueil';
        
        if (!isAdminHidden) {
           this._checkDataWarning();
        }
    }
}
