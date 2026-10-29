// Store Zustand pour l'état du voyage avec persistance localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Participant,
  type Expense,
  type TripState,
  addParticipant as addParticipantFn,
  removeParticipant as removeParticipantFn,
  addExpense as addExpenseFn,
  removeExpense as removeExpenseFn,
  computeBalances,
  computeTransfers,
} from "./trip";

export type TripStore = TripState & {
  addParticipant: (name: string) => void;
  removeParticipant: (id: string) => boolean; // returns true if removed, false if blocked
  addExpense: (label: string, amount: number, paidBy: string, splitBetween: string[]) => void;
  removeExpense: (id: string) => void;
  getBalances: () => ReturnType<typeof computeBalances>;
  getTransfers: () => ReturnType<typeof computeTransfers>;
};

const STORAGE_KEY = "trip-expenses";

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],
      
      addParticipant: (name: string) => {
        set(state => addParticipantFn(state, name));
      },
      
      removeParticipant: (id: string) => {
        const state = get();
        const usedInExpense = state.expenses.some(
          e => e.paidBy === id || e.splitBetween.includes(id)
        );
        if (usedInExpense) return false;
        set(state => removeParticipantFn(state, id));
        return true;
      },
      
      addExpense: (label: string, amount: number, paidBy: string, splitBetween: string[]) => {
        set(state => addExpenseFn(state, label, amount, paidBy, splitBetween));
      },
      
      removeExpense: (id: string) => {
        set(state => removeExpenseFn(state, id));
      },
      
      getBalances: () => {
        return computeBalances(get());
      },
      
      getTransfers: () => {
        return computeTransfers(computeBalances(get()));
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