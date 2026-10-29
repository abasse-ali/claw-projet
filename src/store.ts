// Store Zustand pour l'application de partage de dépenses de voyage

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { today } from "./kit/format";
import type { Participant, Expense, TravelState } from "./types";

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const STORE_KEY = "travel-expenses";

export const useTravelStore = create<TravelState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],

      addParticipant: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        
        // Vérifier l'unicité (insensible à la casse et accents)
        const normalized = trimmed.toLowerCase().normalize("NFC");
        const exists = get().participants.some(
          p => p.name.toLowerCase().normalize("NFC") === normalized
        );
        if (exists) return null;

        const participant: Participant = { id: newId(), name: trimmed };
        set({ participants: [...get().participants, participant] });
        return participant;
      },

      removeParticipant: (id: string) => {
        // Vérifier si le participant est utilisé dans une dépense
        const used = get().expenses.some(
          e => e.paidBy === id || e.sharedWith.includes(id)
        );
        if (used) return false;

        set({ participants: get().participants.filter(p => p.id !== id) });
        return true;
      },

      addExpense: (expense) => {
        const newExpense: Expense = { ...expense, id: newId() };
        set({ expenses: [...get().expenses, newExpense] });
        return newExpense;
      },

      updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => {
        set({
          expenses: get().expenses.map(e =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
      },

      removeExpense: (id: string) => {
        set({ expenses: get().expenses.filter(e => e.id !== id) });
      },

      clearAll: () => {
        set({ participants: [], expenses: [] });
      },
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        participants: state.participants,
        expenses: state.expenses,
      }),
    }
  )
);