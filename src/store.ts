// Stockage de l'appli de partage de dépenses (localStorage).
// Participants (prénom unique), dépenses (libellé, montant, payeur, bénéficiaires, parts égales).
// Persistance : participants + dépenses. Les soldes/remboursements sont calculés à la volée.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Participant = {
  id: string;
  firstName: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number; // en centimes (entier)
  paidBy: string; // participant id
  sharedWith: string[]; // participant ids, vide = tout le monde
};

type StoreState = {
  participants: Participant[];
  expenses: Expense[];
  addParticipant: (firstName: string) => Participant | null;
  removeParticipant: (id: string) => boolean;
  updateParticipant: (id: string, firstName: string) => boolean;
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  removeExpense: (id: string) => void;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  clearAll: () => void;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const normalizeName = (name: string) => name.trim().toLowerCase();

export const useTripStore = create<StoreState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],

      addParticipant: (firstName: string) => {
        const name = firstName.trim();
        if (!name) return null;
        const normalized = normalizeName(name);
        const exists = get().participants.some((p) => normalizeName(p.firstName) === normalized);
        if (exists) return null;
        const participant: Participant = { id: newId(), firstName: name };
        set({ participants: [...get().participants, participant] });
        return participant;
      },

      removeParticipant: (id: string) => {
        const state = get();
        const used = state.expenses.some(
          (e) => e.paidBy === id || e.sharedWith.includes(id)
        );
        if (used) return false;
        set({ participants: state.participants.filter((p) => p.id !== id) });
        return true;
      },

      updateParticipant: (id: string, firstName: string) => {
        const name = firstName.trim();
        if (!name) return false;
        const normalized = normalizeName(name);
        const state = get();
        const exists = state.participants.some(
          (p) => p.id !== id && normalizeName(p.firstName) === normalized
        );
        if (exists) return false;
        set({
          participants: state.participants.map((p) =>
            p.id === id ? { ...p, firstName: name } : p
          ),
        });
        return true;
      },

      addExpense: (expense) => {
        const newExpense: Expense = { ...expense, id: newId() };
        set({ expenses: [...get().expenses, newExpense] });
        return newExpense;
      },

      removeExpense: (id: string) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
      },

      updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
      },

      clearAll: () => set({ participants: [], expenses: [] }),
    }),
    {
      name: "trip-expenses",
      partialize: (state) => ({
        participants: state.participants,
        expenses: state.expenses,
      }),
    }
  )
);

// --- Calculs purs (pas de store) ---

export type Balance = {
  participantId: string;
  paid: number; // total payé en centimes
  share: number; // sa part en centimes
  balance: number; // payé - part (positif = on lui doit, négatif = il doit)
};

export type Settlement = {
  from: string; // participant id qui paie
  to: string; // participant id qui reçoit
  amount: number; // en centimes
};

/** Calcule les soldes de chaque participant. */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Balance[] {
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  for (const expense of expenses) {
    const beneficiaries = expense.sharedWith.length
      ? expense.sharedWith
      : participants.map((p) => p.id);
    const shareCount = beneficiaries.length;
    if (shareCount === 0) continue;

    const amount = expense.amount; // en centimes
    const baseShare = Math.floor(amount / shareCount);
    const remainder = amount % shareCount;

    // Payeur
    paidMap.set(expense.paidBy, (paidMap.get(expense.paidBy) || 0) + amount);

    // Répartition des parts
    beneficiaries.forEach((pid, index) => {
      const share = baseShare + (index < remainder ? 1 : 0);
      shareMap.set(pid, (shareMap.get(pid) || 0) + share);
    });
  }

  return participants.map((p) => {
    const paid = paidMap.get(p.id) || 0;
    const share = shareMap.get(p.id) || 0;
    return {
      participantId: p.id,
      paid,
      share,
      balance: paid - share,
    };
  });
}

/** Calcule les remboursements optimaux (algorithme glouton : minimiser le nombre de virements). */
export function computeSettlements(balances: Balance[]): Settlement[] {
  // Filtrer les soldes non nuls
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.participantId, amount: -b.balance })) // montant positif = ce qu'il doit
    .sort((a, b) => b.amount - a.amount); // plus gros débiteurs d'abord

  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.participantId, amount: b.balance })) // montant positif = ce qu'on lui doit
    .sort((a, b) => b.amount - a.amount); // plus gros créanciers d'abord

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount,
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return settlements;
}

/** Vérifie que la somme des soldes fait 0 (au centime près). */
export function validateBalances(balances: Balance[]): boolean {
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  return sum === 0;
}

/** Formate un montant en centimes vers euros pour l'affichage. */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** Parse un montant saisi (ex: "12,50" ou "12.50") en centimes. */
export function parseAmountToCents(input: string): number {
  const text = String(input ?? "").replace(/€|eur(os?)?/gi, "").trim();
  if (!text) return NaN;
  // Remplacer la virgule par un point pour le parsing
  const normalized = text.replace(",", ".");
  const value = parseFloat(normalized);
  if (!Number.isFinite(value)) return NaN;
  // Arrondir au centime près
  return Math.round(value * 100);
}