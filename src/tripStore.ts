// Store Zustand pour les données du voyage (participants, dépenses)
// Persisté dans localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Participant, Expense, TripData, Balance, Settlement } from "./types";
import { 
  generateId, 
  today, 
  normalizeName, 
  isNameTaken, 
  parseAmountToCents,
  computeBalances,
  computeSettlements,
  validateBalances
} from "./calculations";

type TripState = {
  participants: Participant[];
  expenses: Expense[];
  
  // Actions participants
  addParticipant: (name: string) => Participant | null;
  updateParticipant: (id: string, name: string) => boolean;
  removeParticipant: (id: string) => { success: boolean; error?: string };
  
  // Actions dépenses
  addExpense: (expense: Omit<Expense, "id" | "date"> & { date?: string }) => Expense;
  updateExpense: (id: string, fields: Partial<Expense>) => void;
  removeExpense: (id: string) => () => void;
  
  // Données dérivées (calculées à la volée) - memoized
  _balances: Balance[] | null;
  _settlements: Settlement[] | null;
  _totalExpenses: number | null;
  _recomputeDerived: () => void;
  
  // Getters pour les données dérivées
  getBalances: () => Balance[];
  getSettlements: () => Settlement[];
  getTotalExpenses: () => number;
  getPaidByParticipant: (participantId: string) => number;
  getExpensesForParticipant: (participantId: string) => Expense[];
  
  // Validation
  validateData: () => boolean;
  
  // Reset
  clearAll: () => () => void;
};

const STORE_KEY = "trip-split";

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],
      _balances: null,
      _settlements: null,
      _totalExpenses: null,
      
      _recomputeDerived: () => {
        const { participants, expenses } = get();
        const balances = computeBalances({ participants, expenses });
        const settlements = computeSettlements(balances);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        set({ _balances: balances, _settlements: settlements, _totalExpenses: totalExpenses });
      },
      
      addParticipant: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        
        const currentParticipants = get().participants;
        if (isNameTaken(currentParticipants, trimmed)) return null;
        
        const participant: Participant = {
          id: generateId(),
          name: trimmed,
        };
        
        set({ participants: [...currentParticipants, participant] });
        get()._recomputeDerived();
        return participant;
      },
      
      updateParticipant: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        
        const currentParticipants = get().participants;
        if (isNameTaken(currentParticipants, trimmed, id)) return false;
        
        set({
          participants: currentParticipants.map((p) =>
            p.id === id ? { ...p, name: trimmed } : p
          ),
        });
        get()._recomputeDerived();
        return true;
      },
      
      removeParticipant: (id: string) => {
        const { participants, expenses } = get();
        
        // Vérifier si le participant apparaît dans une dépense
        const isUsed = expenses.some(
          (e) => e.paidBy === id || e.sharedWith.includes(id)
        );
        
        if (isUsed) {
          const participant = participants.find((p) => p.id === id);
          return { 
            success: false, 
            error: `${participant?.name || "Ce participant"} a des dépenses associées et ne peut pas être supprimé.` 
          };
        }
        
        set({ participants: participants.filter((p) => p.id !== id) });
        get()._recomputeDerived();
        return { success: true };
      },
      
      addExpense: (fields) => {
        const amountCents = parseAmountToCents(String(fields.amount));
        if (amountCents <= 0) throw new Error("Montant invalide");
        
        const expense: Expense = {
          id: generateId(),
          label: String(fields.label || "").trim() || "Sans nom",
          amount: amountCents,
          paidBy: fields.paidBy,
          sharedWith: fields.sharedWith || [],
          date: /^\d{4}-\d{2}-\d{2}$/.test(fields.date || "") ? fields.date! : today(),
        };
        
        set({ expenses: [...get().expenses, expense] });
        get()._recomputeDerived();
        return expense;
      },
      
      updateExpense: (id: string, fields: Partial<Expense>) => {
        set({
          expenses: get().expenses.map((expense) => {
            if (expense.id !== id) return expense;
            
            const amount = fields.amount !== undefined
              ? parseAmountToCents(String(fields.amount))
              : expense.amount;
            
            return {
              ...expense,
              label: fields.label !== undefined ? String(fields.label).trim() || "Sans nom" : expense.label,
              amount: amount > 0 ? amount : expense.amount,
              paidBy: fields.paidBy ?? expense.paidBy,
              sharedWith: fields.sharedWith ?? expense.sharedWith,
              date: fields.date && /^\d{4}-\d{2}-\d{2}$/.test(fields.date) ? fields.date : expense.date,
            };
          }),
        });
        get()._recomputeDerived();
      },
      
      removeExpense: (id: string) => {
        const before = get().expenses;
        const index = before.findIndex((e) => e.id === id);
        if (index < 0) return () => {};
        
        set({ expenses: before.filter((e) => e.id !== id) });
        get()._recomputeDerived();
        const removed = before[index];
        
        return () => {
          const now = get().expenses;
          set({ expenses: [...now.slice(0, index), removed, ...now.slice(index)] });
          get()._recomputeDerived();
        };
      },
      
      getBalances: () => {
        const balances = get()._balances;
        if (balances !== null) return balances;
        get()._recomputeDerived();
        return get()._balances!;
      },
      
      getSettlements: () => {
        const settlements = get()._settlements;
        if (settlements !== null) return settlements;
        get()._recomputeDerived();
        return get()._settlements!;
      },
      
      getTotalExpenses: () => {
        const total = get()._totalExpenses;
        if (total !== null) return total;
        get()._recomputeDerived();
        return get()._totalExpenses!;
      },
      
      getPaidByParticipant: (participantId: string) => {
        return get().expenses
          .filter((e) => e.paidBy === participantId)
          .reduce((sum, e) => sum + e.amount, 0);
      },
      
      getExpensesForParticipant: (participantId: string) => {
        return get().expenses.filter(
          (e) => e.paidBy === participantId || e.sharedWith.includes(participantId)
        );
      },
      
      validateData: () => {
        const balances = get().getBalances();
        return validateBalances(balances);
      },
      
      clearAll: () => {
        const before = { participants: get().participants, expenses: get().expenses };
        set({ participants: [], expenses: [], _balances: null, _settlements: null, _totalExpenses: null });
        return () => {
          set(before);
          get()._recomputeDerived();
        };
      },
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        participants: state.participants,
        expenses: state.expenses,
        // Ne pas persister les données dérivées - elles seront recalculées
      }),
    }
  )
);

// Hooks dérivés - utilisent les valeurs memoized du store
export const useParticipants = () => useTripStore((state) => state.participants);
export const useExpenses = () => useTripStore((state) => state.expenses);
export const useBalances = () => useTripStore((state) => state.getBalances());
export const useSettlements = () => useTripStore((state) => state.getSettlements());
export const useTotalExpenses = () => useTripStore((state) => state.getTotalExpenses());