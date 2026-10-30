// Store pour le partage de dépenses de voyage : participants, dépenses, soldes, remboursements.
// Gardé dans localStorage, persistant entre rechargements.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number; // en centimes (entier)
  paidBy: string; // participant id
  splitAmong: string[]; // participant ids, empty = tous
};

type TripState = {
  participants: Participant[];
  expenses: Expense[];
  addParticipant: (name: string) => Participant | null;
  updateParticipant: (id: string, name: string) => boolean;
  removeParticipant: (id: string) => boolean;
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  removeExpense: (id: string) => void;
  clearAll: () => void;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Normalise un nom pour la comparaison (strip, casefold, NFC). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

/** Vérifie si un nom existe déjà (insensible à la casse, accents, espaces). */
function nameExists(participants: Participant[], name: string, excludeId?: string): boolean {
  const normalized = normalizeName(name);
  return participants.some((p) => p.id !== excludeId && normalizeName(p.name) === normalized);
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],
      addParticipant: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        if (nameExists(get().participants, trimmed)) return null;
        const participant: Participant = { id: newId(), name: trimmed };
        set({ participants: [...get().participants, participant] });
        return participant;
      },
      updateParticipant: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        if (nameExists(get().participants, trimmed, id)) return false;
        set({ participants: get().participants.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) });
        return true;
      },
      removeParticipant: (id: string) => {
        // Vérifier si le participant est utilisé dans une dépense
        const used = get().expenses.some(
          (e) => e.paidBy === id || e.splitAmong.includes(id)
        );
        if (used) return false;
        set({ participants: get().participants.filter((p) => p.id !== id) });
        return true;
      },
      addExpense: (expense) => {
        const newExpense: Expense = { ...expense, id: newId() };
        set({ expenses: [...get().expenses, newExpense] });
        return newExpense;
      },
      updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
      },
      removeExpense: (id: string) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
      },
      clearAll: () => {
        set({ participants: [], expenses: [] });
      },
    }),
    { name: "trip-expenses" }
  )
);