/**
 * Suivi Dépenses - Application de gestion de dépenses personnelles
 * Fonctionnalités: ajout, suppression, filtre par catégorie, total mensuel, persistance localStorage
 */

// ============================================================================
// Constantes et configuration
// ============================================================================

const STORAGE_KEY = 'depenses-app-expenses';
const CATEGORIES = ['Courses', 'Transport', 'Logement', 'Loisirs', 'Autre'];
const DATE_FORMAT = { day: '2-digit', month: '2-digit', year: 'numeric' };

// ============================================================================
// Utilitaires de formatage
// ============================================================================

/**
 * Formate un nombre en euros au format français (ex: 12,50 €)
 * @param {number} amount - Montant en euros
 * @returns {string} Montant formaté
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Formate une date au format français (ex: 29/10/2026)
 * @param {string} dateString - Date au format ISO (YYYY-MM-DD)
 * @returns {string} Date formatée
 */
function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', DATE_FORMAT);
}

/**
 * Parse un montant au format français vers un nombre
 * @param {string} value - Valeur au format français (ex: "12,50")
 * @returns {number} Montant en nombre
 */
function parseAmount(value) {
  if (!value) return 0;
  // Remplace la virgule par un point pour le parsing
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// Gestion du stockage (localStorage)
// ============================================================================

/**
 * Récupère toutes les dépenses depuis localStorage
 * @returns {Array} Liste des dépenses
 */
function getExpenses() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Erreur lecture localStorage:', e);
    return [];
  }
}

/**
 * Sauvegarde les dépenses dans localStorage
 * @param {Array} expenses - Liste des dépenses
 */
function saveExpenses(expenses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (e) {
    console.error('Erreur écriture localStorage:', e);
  }
}

/**
 * Génère un ID unique pour une dépense
 * @returns {string} ID unique
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================================================
// Logique métier
// ============================================================================

/**
 * Filtre les dépenses par catégorie
 * @param {Array} expenses - Liste des dépenses
 * @param {string} category - Catégorie à filtrer (vide = toutes)
 * @returns {Array} Dépenses filtrées
 */
function filterExpensesByCategory(expenses, category) {
  if (!category) return expenses;
  return expenses.filter(expense => expense.category === category);
}

/**
 * Calcule le total des dépenses du mois en cours
 * @param {Array} expenses - Liste des dépenses
 * @returns {number} Total du mois en cours
 */
function calculateMonthlyTotal(expenses) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date + 'T00:00:00');
      return expenseDate.getFullYear() === currentYear &&
             expenseDate.getMonth() === currentMonth;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);
}

/**
 * Trie les dépenses par date (plus récentes en premier)
 * @param {Array} expenses - Liste des dépenses
 * @returns {Array} Dépenses triées
 */
function sortExpensesByDateDesc(expenses) {
  return [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ============================================================================
// Rendu de l'interface
// ============================================================================

/**
 * Met à jour l'affichage du total mensuel
 * @param {number} total - Total à afficher
 */
function updateMonthlyTotal(total) {
  const element = document.getElementById('monthly-total');
  if (element) {
    element.textContent = formatCurrency(total);
  }
}

/**
 * Crée l'élément HTML pour une dépense (sans innerHTML pour la sécurité)
 * @param {Object} expense - Objet dépense
 * @returns {HTMLLIElement} Élément de liste
 */
function createExpenseElement(expense) {
  const li = document.createElement('li');
  li.className = 'expense-item';
  li.dataset.id = expense.id;
  li.dataset.category = expense.category;

  // Container info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'expense-info';

  // Label
  const labelDiv = document.createElement('div');
  labelDiv.className = 'expense-label';
  labelDiv.textContent = expense.label;

  // Meta (catégorie + date)
  const metaDiv = document.createElement('div');
  metaDiv.className = 'expense-meta';

  const categorySpan = document.createElement('span');
  categorySpan.className = 'expense-category';
  categorySpan.dataset.category = expense.category;
  categorySpan.textContent = expense.category;

  const dateSpan = document.createElement('span');
  dateSpan.className = 'expense-date';
  dateSpan.textContent = formatDate(expense.date);

  metaDiv.appendChild(categorySpan);
  metaDiv.appendChild(dateSpan);

  infoDiv.appendChild(labelDiv);
  infoDiv.appendChild(metaDiv);

  // Montant
  const amountDiv = document.createElement('div');
  amountDiv.className = 'expense-amount';
  amountDiv.textContent = formatCurrency(expense.amount);

  // Bouton suppression
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-icon expense-delete';
  deleteBtn.setAttribute('aria-label', `Supprimer ${expense.label}`);
  deleteBtn.dataset.id = expense.id;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '3 6 5 6 21 6');
  svg.appendChild(polyline);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2');
  svg.appendChild(path);

  deleteBtn.appendChild(svg);

  // Assemblage
  li.appendChild(infoDiv);
  li.appendChild(amountDiv);
  li.appendChild(deleteBtn);

  return li;
}

/**
 * Échappe le HTML pour éviter les injections XSS
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Affiche la liste des dépenses filtrées
 * @param {Array} expenses - Liste des dépenses à afficher
 */
function renderExpensesList(expenses) {
  const list = document.getElementById('expenses-list');
  const emptyMessage = document.getElementById('empty-message');

  if (!list) return;

  list.innerHTML = '';

  if (expenses.length === 0) {
    if (emptyMessage) emptyMessage.classList.remove('hidden');
    return;
  }

  if (emptyMessage) emptyMessage.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  expenses.forEach(expense => {
    fragment.appendChild(createExpenseElement(expense));
  });
  list.appendChild(fragment);
}

/**
 * Met à jour l'interface complète
 * @param {string} currentFilter - Filtre de catégorie actif
 */
function updateUI(currentFilter) {
  const expenses = getExpenses();
  const filtered = filterExpensesByCategory(expenses, currentFilter);
  const sorted = sortExpensesByDateDesc(filtered);
  const monthlyTotal = calculateMonthlyTotal(expenses);

  renderExpensesList(sorted);
  updateMonthlyTotal(monthlyTotal);
}

// ============================================================================
// Gestion du formulaire
// ============================================================================

/**
 * Valide le formulaire d'ajout de dépense
 * @param {HTMLFormElement} form - Formulaire à valider
 * @returns {boolean} True si valide
 */
function validateForm(form) {
  const label = form.elements.label.value.trim();
  const amount = parseAmount(form.elements.amount.value);
  const date = form.elements.date.value;
  const category = form.elements.category.value;

  let isValid = true;

  // Libellé
  const labelInput = form.elements.label;
  if (!label) {
    labelInput.setCustomValidity('Le libellé est obligatoire');
    labelInput.classList.add('invalid');
    isValid = false;
  } else {
    labelInput.setCustomValidity('');
    labelInput.classList.remove('invalid');
  }

  // Montant
  const amountInput = form.elements.amount;
  if (!amount || amount <= 0) {
    amountInput.setCustomValidity('Le montant doit être supérieur à 0');
    amountInput.classList.add('invalid');
    isValid = false;
  } else {
    amountInput.setCustomValidity('');
    amountInput.classList.remove('invalid');
  }

  // Date
  const dateInput = form.elements.date;
  if (!date) {
    dateInput.setCustomValidity('La date est obligatoire');
    dateInput.classList.add('invalid');
    isValid = false;
  } else {
    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      dateInput.setCustomValidity('La date ne peut pas être dans le futur');
      dateInput.classList.add('invalid');
      isValid = false;
    } else {
      dateInput.setCustomValidity('');
      dateInput.classList.remove('invalid');
    }
  }

  // Catégorie
  const categoryInput = form.elements.category;
  if (!category) {
    categoryInput.setCustomValidity('Veuillez choisir une catégorie');
    categoryInput.classList.add('invalid');
    isValid = false;
  } else {
    categoryInput.setCustomValidity('');
    categoryInput.classList.remove('invalid');
  }

  return isValid;
}

/**
 * Ajoute les écouteurs pour la validation à la volée (sur blur)
 * @param {HTMLFormElement} form - Formulaire
 */
function setupFormValidation(form) {
  const inputs = form.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('blur', () => {
      if (!input.checkValidity()) {
        input.classList.add('invalid');
      } else {
        input.classList.remove('invalid');
      }
    });
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid') && input.checkValidity()) {
        input.classList.remove('invalid');
      }
    });
  });
}

/**
 * Réinitialise le formulaire
 * @param {HTMLFormElement} form - Formulaire à réinitialiser
 */
function resetForm(form) {
  form.reset();
  // Remettre la date d'aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  form.elements.date.value = today;
}

// ============================================================================
// Gestion de la suppression
// ============================================================================

let expenseToDelete = null;

const deleteDialog = document.getElementById('delete-dialog');
const deleteConfirmBtn = document.getElementById('delete-confirm');
const deleteCancelBtn = document.getElementById('delete-cancel');
const deleteMessage = document.getElementById('delete-dialog-message');

/**
 * Ouvre la boîte de dialogue de confirmation
 * @param {Object} expense - Dépense à supprimer
 */
function openDeleteDialog(expense) {
  expenseToDelete = expense;
  if (deleteMessage) {
    deleteMessage.textContent = `Voulez-vous supprimer "${expense.label}" (${formatCurrency(expense.amount)}) ?`;
  }
  if (deleteDialog) {
    deleteDialog.showModal();
  }
}

/**
 * Ferme la boîte de dialogue de confirmation
 */
function closeDeleteDialog() {
  expenseToDelete = null;
  if (deleteDialog) {
    deleteDialog.close();
  }
}

/**
 * Confirme la suppression de la dépense
 */
function confirmDelete() {
  if (!expenseToDelete) return;

  const expenses = getExpenses();
  const filtered = expenses.filter(e => e.id !== expenseToDelete.id);
  saveExpenses(filtered);

  closeDeleteDialog();
  updateUI(getCurrentFilter());
}

/**
 * Récupère le filtre actuel
 * @returns {string} Catégorie filtrée
 */
function getCurrentFilter() {
  const filterSelect = document.getElementById('category-filter');
  return filterSelect ? filterSelect.value : '';
}

// ============================================================================
// Initialisation et événements
// ============================================================================

/**
 * Initialise l'application
 */
function initApp() {
  // Définir la date d'aujourd'hui par défaut
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('expense-date');
  if (dateInput) {
    dateInput.value = today;
    dateInput.max = today;
  }

  // Événement soumission formulaire
  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
    setupFormValidation(form);
  }

  // Événement changement filtre
  const filterSelect = document.getElementById('category-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', handleFilterChange);
  }

  // Événement suppression (délégation)
  const list = document.getElementById('expenses-list');
  if (list) {
    list.addEventListener('click', handleListClick);
  }

  // Événements boîte de dialogue suppression
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', confirmDelete);
  }
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', closeDeleteDialog);
  }
  if (deleteDialog) {
    deleteDialog.addEventListener('click', (e) => {
      if (e.target === deleteDialog) closeDeleteDialog();
    });
  }

  // Fermer dialog avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deleteDialog?.open) {
      closeDeleteDialog();
    }
  });

  // Rendu initial
  updateUI('');
}

/**
 * Gère la soumission du formulaire
 * @param {Event} e - Événement submit
 */
function handleFormSubmit(e) {
  e.preventDefault();

  const form = e.target;

  if (!validateForm(form)) {
    form.reportValidity();
    return;
  }

  const expense = {
    id: generateId(),
    label: form.elements.label.value.trim(),
    amount: parseAmount(form.elements.amount.value),
    date: form.elements.date.value,
    category: form.elements.category.value,
    createdAt: new Date().toISOString()
  };

  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);

  resetForm(form);
  updateUI(getCurrentFilter());
}

/**
 * Gère le changement de filtre
 * @param {Event} e - Événement change
 */
function handleFilterChange(e) {
  updateUI(e.target.value);
}

/**
 * Gère les clics sur la liste (délégation pour suppression)
 * @param {Event} e - Événement click
 */
function handleListClick(e) {
  const deleteBtn = e.target.closest('.expense-delete');
  if (!deleteBtn) return;

  const expenseId = deleteBtn.dataset.id;
  if (!expenseId) return;

  const expenses = getExpenses();
  const expense = expenses.find(e => e.id === expenseId);
  if (expense) {
    openDeleteDialog(expense);
  }
}

// ============================================================================
// API publique pour les tests
// ============================================================================

/**
 * API exposée pour les tests unitaires
 */
const ExpenseTracker = {
  // Utilitaires
  formatCurrency,
  formatDate,
  parseAmount,

  // Stockage
  getExpenses,
  saveExpenses,
  generateId,

  // Logique métier
  filterExpensesByCategory,
  calculateMonthlyTotal,
  sortExpensesByDateDesc,

  // UI
  updateMonthlyTotal,
  renderExpensesList,
  updateUI,
  validateForm,
  resetForm,

  // Dialog
  openDeleteDialog,
  closeDeleteDialog,
  confirmDelete,
  getCurrentFilter,

  // Initialisation
  initApp
};

// Exposer globalement pour les tests
window.ExpenseTracker = ExpenseTracker;

// Démarrer l'application au chargement
document.addEventListener('DOMContentLoaded', initApp);