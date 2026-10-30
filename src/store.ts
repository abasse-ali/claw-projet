// Store Zustand pour le voyage avec persistance localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Participant,
  type Expense,
  type TripData,
  type Balance,
  type Settlement,
  computeBalances,
  computeSettlements,
  validateBalancesSumZero,
  generateId,
  todayISO,
  canDeleteParticipant,
  createEmptyTrip,
  parseCents,
  formatCents,
} from "./trip";

type TripState = {
  participants: Participant[];
  expenses: Expense[];
  // Actions
  addParticipant: (firstName: string) => { success: boolean; error?: string };
  updateParticipant: (id: string, firstName: string) => { success: boolean; error?: string };
  deleteParticipant: (id: string) => { success: boolean; error?: string };
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  deleteExpense: (id: string) => void;
  // Computed
  getBalances: () => Balance[];
  getSettlements: () => Settlement[];
  // Reset
  resetTrip: () => void;
};

const STORAGE_KEY = "trip-share-data";

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],

      addParticipant: (firstName: string) => {
        const trimmed = firstName.trim();
        if (!trimmed) {
          return { success: false, error: "Le prénom ne peut pas être vide" };
        }

        const { participants } = get();
        // Vérifier unicité (insensible à la casse et aux espaces)
        const normalized = trimmed.toLowerCase().normalize("NFC");
        const exists = participants.some(
          (p) => p.firstName.toLowerCase().normalize("NFC") === normalized
        );

        if (exists) {
          return { success: false, error: "Ce prénom est déjà utilisé" };
        }

        const newParticipant: Participant = {
          id: generateId(),
          firstName: trimmed,
        };

        set({ participants: [...participants, newParticipant] });
        return { success: true };
      },

      updateParticipant: (id: string, firstName: string) => {
        const trimmed = firstName.trim();
        if (!trimmed) {
          return { success: false, error: "Le prénom ne peut pas être vide" };
        }

        const { participants } = get();
        const normalized = trimmed.toLowerCase().normalize("NFC");
        const exists = participants.some(
          (p) => p.id !== id && p.firstName.toLowerCase().normalize("NFC") === normalized
        );

        if (exists) {
          return { success: false, error: "Ce prénom est déjà utilisé" };
        }

        set({
          participants: participants.map((p) =>
            p.id === id ? { ...p, firstName: trimmed } : p
          ),
        });
        return { success: true };
      },

      deleteParticipant: (id: string) => {
        const { expenses } = get();
        if (!canDeleteParticipant(id, expenses)) {
          return {
            success: false,
            error: "Impossible de supprimer : ce participant a des dépenses",
          };
        }

        set({ participants: get().participants.filter((p) => p.id !== id) });
        return { success: true };
      },

      addExpense: (expenseData) => {
        const expense: Expense = {
          ...expenseData,
          id: generateId(),
        };
        set({ expenses: [...get().expenses, expense] });
        return expense;
      },

      updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
      },

      deleteExpense: (id: string) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
      },

      getBalances: () => {
        const { participants, expenses } = get();
        return computeBalances(participants, expenses);
      },

      getSettlements: () => {
        const balances = get().getBalances();
        // Validation en développement
        if (import.meta.env.DEV && !validateBalancesSumZero(balances)) {
          console.error("ERREUR: La somme des balances n'est pas nulle!", balances);
        }
        return computeSettlements(balances);
      },

      resetTrip: () => {
        set(createEmptyTrip());
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        participants: state.participants,
        expenses: state.expenses,
      }),
    }
  )
);

// Hooks dérivés pour faciliter l'utilisation dans les composants
export function useParticipants() {
  return useTripStore((state) => state.participants);
}

export function useExpenses() {
  return useTripStore((state) => state.expenses);
}

export function useBalances() {
  return useTripStore((state) => state.getBalances());
}

export function useSettlements() {
  return useTripStore((state) => state.getSettlements());
}

export function useAddParticipant() {
  return useTripStore((state) => state.addParticipant);
}

export function useUpdateParticipant() {
  return useTripStore((state) => state.updateParticipant);
}

export function useDeleteParticipant() {
  return useTripStore((state) => state.deleteParticipant);
}

export function useAddExpense() {
  return useTripStore((state) => state.addExpense);
}

export function useUpdateExpense() {
  return useTripStore((state) => state.updateExpense);
}

export function useDeleteExpense() {
  return useTripStore((state) => state.deleteExpense);
}

export function useResetTrip() {
  return useTripStore((state) => state.resetTrip);
}

// Re-export des utilitaires
export { parseCents, formatCents, todayISO, generateId, validateBalancesSumZero };
export type { Participant, Expense, Balance, Settlement };