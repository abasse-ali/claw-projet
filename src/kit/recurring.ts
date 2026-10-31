// Dépenses obligatoires mensuelles et revenus réguliers (salaire, CAF, etc.).
// Gardés sur le téléphone (localStorage) pour aider au budget prévisionnel.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncRecurringToEntries } from "./store";
import { monthOf, today } from "./format";

export type RecurringExpense = {
  id: string;
  label: string;
  category: string;
  /** Montant positif en euros. */
  amount: number;
};

export type RecurringIncome = {
  id: string;
  label: string;
  /** Montant positif en euros. */
  amount: number;
};

type RecurringState = {
  expenses: RecurringExpense[];
  incomes: RecurringIncome[];
  /** Dernier mois synchronisé (format "YYYY-MM"). */
  lastSyncedMonth: string | null;
  // Dépenses
  addExpense: (expense: Omit<RecurringExpense, "id">) => void;
  updateExpense: (id: string, fields: Partial<Omit<RecurringExpense, "id">>) => void;
  removeExpense: (id: string) => void;
  // Revenus
  addIncome: (income: Omit<RecurringIncome, "id">) => void;
  updateIncome: (id: string, fields: Partial<Omit<RecurringIncome, "id">>) => void;
  removeIncome: (id: string) => void;
  // Sync
  setLastSyncedMonth: (month: string) => void;
  // Totaux
  getTotalExpenses: () => number;
  getTotalIncomes: () => number;
};

let recurringCounter = 0;
const newRecurringId = () => `rec-${Date.now().toString(36)}-${(recurringCounter++).toString(36)}`;

const initial: Pick<RecurringState, "expenses" | "incomes" | "lastSyncedMonth"> = {
  expenses: [],
  incomes: [],
  lastSyncedMonth: null,
};

function syncForCurrentMonth(expenses: RecurringExpense[], incomes: RecurringIncome[], month: string) {
  syncRecurringToEntries(month, expenses, incomes);
}

export const useRecurring = create<RecurringState>()(
  persist(
    (set, get) => ({
      ...initial,
      // Dépenses obligatoires
      addExpense: (expense) =>
        set((state: RecurringState) => ({
          expenses: [...state.expenses, { ...expense, id: newRecurringId() }],
        })),
      updateExpense: (id, fields) =>
        set((state: RecurringState) => ({
          expenses: state.expenses.map((e: RecurringExpense) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        })),
      removeExpense: (id) =>
        set((state: RecurringState) => ({
          expenses: state.expenses.filter((e: RecurringExpense) => e.id !== id),
        })),
      // Revenus réguliers
      addIncome: (income) =>
        set((state: RecurringState) => ({
          incomes: [...state.incomes, { ...income, id: newRecurringId() }],
        })),
      updateIncome: (id, fields) =>
        set((state: RecurringState) => ({
          incomes: state.incomes.map((i: RecurringIncome) =>
            i.id === id ? { ...i, ...fields } : i
          ),
        })),
      removeIncome: (id) =>
        set((state: RecurringState) => ({
          incomes: state.incomes.filter((i: RecurringIncome) => i.id !== id),
        })),
      // Sync tracking
      setLastSyncedMonth: (month) => set({ lastSyncedMonth: month }),
      // Totaux
      getTotalExpenses: () => {
        const { expenses } = get();
        return expenses.reduce((sum, e) => sum + e.amount, 0);
      },
      getTotalIncomes: () => {
        const { incomes } = get();
        return incomes.reduce((sum, i) => sum + i.amount, 0);
      },
    }),
    { 
      name: "appli-recurring",
      onRehydrateStorage: () => (state: RecurringState | undefined) => {
        // Synchroniser au rechargement de la page seulement si le mois a changé
        if (state) {
          const currentMonth = monthOf(today());
          if (state.lastSyncedMonth !== currentMonth) {
            syncForCurrentMonth(state.expenses, state.incomes, currentMonth);
            // Mettre à jour le mois synchronisé sans déclencher de re-render
            useRecurring.setState({ lastSyncedMonth: currentMonth });
          }
        }
      }
    }
  )
);

// Wrapper pour déclencher la synchronisation après chaque mutation
export function addExpenseAndSync(expense: Omit<RecurringExpense, "id">): void {
  useRecurring.getState().addExpense(expense);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

export function updateExpenseAndSync(id: string, fields: Partial<Omit<RecurringExpense, "id">>): void {
  useRecurring.getState().updateExpense(id, fields);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

export function removeExpenseAndSync(id: string): void {
  useRecurring.getState().removeExpense(id);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

export function addIncomeAndSync(income: Omit<RecurringIncome, "id">): void {
  useRecurring.getState().addIncome(income);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

export function updateIncomeAndSync(id: string, fields: Partial<Omit<RecurringIncome, "id">>): void {
  useRecurring.getState().updateIncome(id, fields);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

export function removeIncomeAndSync(id: string): void {
  useRecurring.getState().removeIncome(id);
  const { expenses, incomes } = useRecurring.getState();
  const currentMonth = monthOf(today());
  syncForCurrentMonth(expenses, incomes, currentMonth);
  useRecurring.getState().setLastSyncedMonth(currentMonth);
}

/** Liste des catégories pour les dépenses obligatoires (réutilise les catégories existantes). */
export function getRecurringExpenseCategories(): { value: string; label: string }[] {
  // Import dynamique pour éviter les cycles
  const { getAllCategories } = require("./categorize");
  return getAllCategories().map((c: string) => ({ value: c, label: c }));
}

/** Labels suggérés pour les revenus réguliers. */
export const INCOME_LABELS = [
  "Salaire",
  "CAF",
  "Allocations familiales",
  "RSA",
  "AAH",
  "Pension",
  "Retraite",
  "Chômage",
  "Prime",
  "Indemnités",
  "Virements réguliers",
  "Espèces",
  "Autre revenu",
];

/** Labels suggérés pour les dépenses obligatoires. */
export const EXPENSE_LABELS = [
  "Loyer",
  "Crédit immobilier",
  "Électricité",
  "Gaz",
  "Eau",
  "Internet / Box",
  "Téléphone",
  "Assurance habitation",
  "Assurance auto",
  "Mutuelle / Santé",
  "Transports (abonnement)",
  "Crédit conso",
  "Épargne programmée",
  "Impôts",
  "Autre dépense fixe",
];