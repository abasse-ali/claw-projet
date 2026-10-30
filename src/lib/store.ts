// Store Zustand pour l'application de partage de dépenses
// Persistance dans localStorage

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Participant, Expense, Balance, Transfer } from './calculations';
import { calculateBalances, calculateTransfers, generateId } from './calculations';

export interface TripState {
  participants: Participant[];
  expenses: Expense[];
  // Actions
  addParticipant: (name: string) => { success: boolean; error?: string };
  removeParticipant: (id: string) => { success: boolean; error?: string };
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  removeExpense: (id: string) => void;
  updateExpense: (id: string, fields: Partial<Omit<Expense, 'id'>>) => void;
  // Calculs dérivés
  getBalances: () => Balance[];
  getTransfers: () => Transfer[];
  // Helpers
  getParticipant: (id: string) => Participant | undefined;
  getExpense: (id: string) => Expense | undefined;
  canRemoveParticipant: (id: string) => boolean;
  clearAll: () => void;
}

const STORE_KEY = 'trip-expenses';

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],

      addParticipant: (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return { success: false, error: 'Le prénom ne peut pas être vide' };
        }

        const participants = get().participants;
        // Vérifier doublon (insensible à la casse et espaces)
        const isDuplicate = participants.some(
          p => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
          return { success: false, error: 'Ce prénom existe déjà' };
        }

        const newParticipant: Participant = {
          id: generateId(),
          name: trimmedName,
        };

        set({ participants: [...participants, newParticipant] });
        return { success: true };
      },

      removeParticipant: (id: string) => {
        const { participants, expenses } = get();
        const participant = participants.find(p => p.id === id);
        if (!participant) {
          return { success: false, error: 'Participant non trouvé' };
        }

        // Vérifier si le participant apparaît dans une dépense
        const isUsedInExpense = expenses.some(
          e => e.paidBy === id || e.forWhom.includes(id)
        );
        if (isUsedInExpense) {
          return { success: false, error: 'Ce participant a des dépenses, impossible de le supprimer' };
        }

        set({ participants: participants.filter(p => p.id !== id) });
        return { success: true };
      },

      addExpense: (expenseData) => {
        const newExpense: Expense = {
          ...expenseData,
          id: generateId(),
        };
        set({ expenses: [...get().expenses, newExpense] });
        return newExpense;
      },

      removeExpense: (id: string) => {
        set({ expenses: get().expenses.filter(e => e.id !== id) });
      },

      updateExpense: (id: string, fields: Partial<Omit<Expense, 'id'>>) => {
        set({
          expenses: get().expenses.map(e =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
      },

      getBalances: () => {
        const { participants, expenses } = get();
        return calculateBalances(participants, expenses);
      },

      getTransfers: () => {
        const balances = get().getBalances();
        return calculateTransfers(balances);
      },

      getParticipant: (id: string) => {
        return get().participants.find(p => p.id === id);
      },

      getExpense: (id: string) => {
        return get().expenses.find(e => e.id === id);
      },

      canRemoveParticipant: (id: string) => {
        const { expenses } = get();
        return !expenses.some(e => e.paidBy === id || e.forWhom.includes(id));
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