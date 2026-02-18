/**
 * =====================================
 * UTILITAIRES ET CONSTANTES
 * =====================================
 * Fonctions utilitaires et constantes partagées par l'application
 */

/**
 * Clés localStorage utilisées par l'application
 * @readonly
 * @enum {string}
 */
export const STORAGE_KEYS = {
    DATA: 'tourneeData',
    FILENAME: 'tourneeNomFichier',
    THEME: 'themeSombre',
    CAMERA: 'cameraEnabled'
};

/**
 * Constantes de l'application
 * @readonly
 */
export const APP_CONSTANTS = {
    DEFAULT_THEME: true,
    MIN_SEARCH_LENGTH: 2,
    VIBRATION_DURATION: 50,
    ANIMATION_DELAY: {
        CITY_BUTTON: 0.1,
        CITY_BUTTON_INDEX: 0.03
    },
    OCR: {
        LANGUAGE: 'fra',
        SCAN_CONFIG: { haut: 0.25, gauche: 0.05, largeur: 0.9, hauteur: 0.5 }
    }
};

/**
 * Normalise une chaîne de caractères en supprimant les accents
 * @param {string} str - La chaîne à normaliser
 * @returns {string} La chaîne normalisée en minuscules sans accents
 */
export function normalizeText(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Fait vibrer l'appareil lors d'un clic (si supporté)
 */
export function vibrateOnClick() {
    if (navigator.vibrate) {
        navigator.vibrate(APP_CONSTANTS.VIBRATION_DURATION);
    }
}

/**
 * Joue un bip sonore pour indiquer une action
 * @param {number} frequency - Fréquence du bip en Hz (défaut: 800)
 * @param {number} duration - Durée en secondes (défaut: 0.1)
 */
export function playBeep(frequency = 800, duration = 0.1) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.start();
        
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.warn('Impossible de jouer le bip:', e);
    }
}

/**
 * Formate une adresse pour l'affichage
 * @param {Object} address - L'adresse à formater
 * @returns {string} HTML formaté pour l'affichage
 */
export function formatAddressRow(address) {
    return `<tr>
        <td>${address.Ville || ''}</td>
        <td>${address.Adresse || ''}</td>
        <td>${address.Numero || ''}</td>
    </tr>`;
}

/**
 * Crée un tableau HTML à partir d'une liste d'adresses
 * @param {Array<Object>} addresses - Liste des adresses
 * @returns {string} Tableau HTML
 */
export function createAddressTable(addresses) {
    if (!addresses || addresses.length === 0) return '';
    
    let html = '<table class="popup-table"><tbody>';
    addresses.forEach(addr => {
        html += formatAddressRow(addr);
    });
    html += '</tbody></table>';
    
    return html;
}

/**
 * Affiche une alerte simple
 * @param {string} message - Message à afficher
 */
export function showAlert(message) {
    if (typeof alert !== 'undefined') {
        alert(message);
    }
}

/**
 * Affiche une confirmation
 * @param {string} message - Message de confirmation
 * @returns {boolean} Résultat de la confirmation
 */
export function showConfirm(message) {
    if (typeof confirm !== 'undefined') {
        return confirm(message);
    }
    return false;
}

/**
 * Empêche l'installation automatique du PWA
 * @param {Event} e - Événement beforeinstallprompt
 */
export function preventPWAInstall(e) {
    e.preventDefault();
}

/**
 * Vérifie si un élément est visible
 * @param {HTMLElement} element - Élément à vérifier
 * @returns {boolean} True si visible
 */
export function isElementVisible(element) {
    if (!element) return false;
    return !element.classList.contains('hidden') && element.style.display !== 'none';
}

/**
 * Change le texte d'un élément
 * @param {string} elementId - ID de l'élément
 * @param {string} text - Nouveau texte
 */
export function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Toggle une classe sur un élément
 * @param {string} elementId - ID de l'élément
 * @param {string} className - Classe à toggle
 * @param {boolean} force - Forcer un état spécifique
 */
export function toggleClass(elementId, className, force) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle(className, force);
    }
}

/**
 * Cache un élément
 * @param {string} elementId - ID de l'élément
 */
export function hideElement(elementId) {
    toggleClass(elementId, 'hidden', true);
}

/**
 * Affiche un élément
 * @param {string} elementId - ID de l'élément
 */
export function showElement(elementId) {
    toggleClass(elementId, 'hidden', false);
}

/**
 * Analyse le texte extrait d'une image pour extraire l'adresse
 * @param {string} text - Le texte reconnu par l'OCR
 * @returns {Object} Objet contenant la ville, la rue et le dernier mot de la rue
 */
export function analyzeAddressFromText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    let city = '';
    let street = '';

    // Regex pour les codes postaux (5 chiffres)
    const postalCodeRegex = /\b(\d{5})\b/;
    // Regex pour les types de rues
    const streetTypeRegex = /\b(rue|boulevard|bd|avenue|av|place|pl|chemin|impasse|allee|route|rt|voie|square|sq|cours|imp|passage|pass|quai|pont|carrefour|car|résidence|res|lotissement|lot|zone|zn|parc|prk)\b/i;

    // Extraction de la ville
    for (const line of lines) {
        const match = line.match(postalCodeRegex);
        if (match) {
            const afterPostalCode = line.substring(match.index + match[0].length)
                .replace(/[^a-zA-Z\s-]/g, '')
                .trim();
            const words = afterPostalCode.split(/\s+/).filter(w => w.length > 1);
            city = words.slice(0, 3).join(' ');
            if (city) break;
        }
    }

    // Extraction de la rue
    for (const line of lines) {
        if (streetTypeRegex.test(line)) {
            let cleaned = line.replace(/^\d+\s*/, '');
            cleaned = cleaned.replace(streetTypeRegex, '').replace(/[,.-]/g, '').trim();
            const words = cleaned.split(/\s+/)
                .filter(w => w.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(w));
            street = words.join(' ');
            if (street) break;
        }
    }

    // Si pas de rue trouvée, chercher une ligne avec chiffres et lettres
    if (!street) {
        for (const line of lines) {
            if (/\d/.test(line) && /[a-zA-Z]/.test(line) && !postalCodeRegex.test(line)) {
                let cleaned = line.replace(/^\d+\s*/, '').replace(/[,.-]/g, '').trim();
                const words = cleaned.split(/\s+/).filter(w => w.length > 2);
                street = words.join(' ');
                if (street) break;
            }
        }
    }

    // Extraire le dernier mot significatif de la rue
    const streetWords = street.split(/\s+/)
        .filter(w => w.length > 2 && !/\b(le|la|les|du|de|des|et|à|a|sur|chez|pour|avec)\b/i.test(w));
    const lastStreetWord = streetWords.length > 0 ? streetWords[streetWords.length - 1] : '';

    return {
        city: city,
        street: street,
        lastStreetWord: lastStreetWord
    };
}
