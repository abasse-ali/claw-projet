// Stockage du voyage : participants et dépenses, gardés sur le téléphone (localStorage).
// Les montants sont en centimes (entiers) pour éviter les erreurs de flottants.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  /** Montant en centimes (entier). */
  amount: number;
  /** ID du participant qui a payé. */
  paidBy: string;
  /** IDs des participants concernés (tous si vide). */
  forWhom: string[];
  /** Date ISO « 2026-10-28 ». */
  date: string;
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

/** Nom sous lequel l'appli garde ses données sur le téléphone. */
const STORE_KEY = "trip-expenses";

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Normalise un prénom pour la comparaison (unicité insensible à la casse, aux espaces et aux formes Unicode). */
function normalizeName(name: string): string {
  return name.trim().normalize("NFC").toLowerCase();
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],
      addParticipant: (name) => {
        const normalized = normalizeName(name);
        // Vérifier l'unicité (insensible à la casse et aux espaces)
        const exists = get().participants.some((p) => normalizeName(p.name) === normalized);
        if (exists) return null;
        const participant = { id: newId(), name: name.trim() };
        set({ participants: [...get().participants, participant] });
        return participant;
      },
      updateParticipant: (id, name) => {
        const normalized = normalizeName(name);
        // Vérifier l'unicité (sauf pour le participant actuel)
        const exists = get().participants.some(
          (p) => p.id !== id && normalizeName(p.name) === normalized
        );
        if (exists) return false;
        set({
          participants: get().participants.map((p) =>
            p.id === id ? { ...p, name: name.trim() } : p
          ),
        });
        return true;
      },
      removeParticipant: (id) => {
        // Ne pas supprimer si le participant apparaît dans une dépense
        const used = get().expenses.some(
          (e) => e.paidBy === id || e.forWhom.includes(id)
        );
        if (used) return false;
        set({ participants: get().participants.filter((p) => p.id !== id) });
        return true;
      },
      addExpense: (expense) => {
        const newExpense = { ...expense, id: newId() };
        set({ expenses: [...get().expenses, newExpense] });
        // Validation en debug
        if (import.meta.env.DEV) {
          const balances = computeBalances(get().participants, [...get().expenses, newExpense]);
          if (!validateBalances(balances)) console.error("Balances validation failed after addExpense");
        }
        return newExpense;
      },
      updateExpense: (id, fields) => {
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        });
        // Validation en debug
        if (import.meta.env.DEV) {
          const newExpenses = get().expenses.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          );
          const balances = computeBalances(get().participants, newExpenses);
          if (!validateBalances(balances)) console.error("Balances validation failed after updateExpense");
        }
      },
      removeExpense: (id) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
        // Validation en debug
        if (import.meta.env.DEV) {
          const newExpenses = get().expenses.filter((e) => e.id !== id);
          const balances = computeBalances(get().participants, newExpenses);
          if (!validateBalances(balances)) console.error("Balances validation failed after removeExpense");
        }
      },
      clearAll: () => {
        set({ participants: [], expenses: [] });
      },
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({ participants: state.participants, expenses: state.expenses }),
    }
  )
);

// --- Calculs ---

/** Solde de chaque participant en centimes (positif = a payé plus que sa part, négatif = doit). */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Map<string, number> {
  const balances = new Map<string, number>();
  // Initialiser à 0
  for (const p of participants) balances.set(p.id, 0);

  for (const expense of expenses) {
    const { amount, paidBy, forWhom } = expense;
    const concerned = forWhom.length > 0 ? forWhom : participants.map((p) => p.id);
    const shareCount = concerned.length;
    if (shareCount === 0) continue;

    // Part par personne (division euclidienne, reste distribué)
    const share = Math.floor(amount / shareCount);
    const remainder = amount % shareCount;

    // Celui qui a payé récupère le montant total
    balances.set(paidBy, (balances.get(paidBy) || 0) + amount);

    // Chaque personne concernée paie sa part
    for (let i = 0; i < shareCount; i++) {
      const participantId = concerned[i];
      const participantShare = share + (i < remainder ? 1 : 0);
      balances.set(participantId, (balances.get(participantId) || 0) - participantShare);
    }
  }

  return balances;
}

/** Remboursements pour équilibrer tout (algorithme glouton pour minimiser les virements). */
export type Settlement = {
  from: string; // ID du participant qui paie
  to: string; // ID du participant qui reçoit
  amount: number; // en centimes
};

export function computeSettlements(
  participants: Participant[],
  balances: Map<string, number>
): Settlement[] {
  // Créer des listes de créanciers (balance > 0) et débiteurs (balance < 0)
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const p of participants) {
    const balance = balances.get(p.id) || 0;
    if (balance > 0) creditors.push({ id: p.id, amount: balance });
    else if (balance < 0) debtors.push({ id: p.id, amount: -balance });
  }

  // Trier par montant décroissant pour minimiser le nombre de virements
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0; // index créancier
  let j = 0; // index débiteur

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const transfer = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: transfer,
    });

    creditors[i] = { ...creditor, amount: creditor.amount - transfer };
    debtors[j] = { ...debtor, amount: debtor.amount - transfer };

    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return settlements;
}

/** Vérifie que la somme des soldes fait 0. */
export function validateBalances(balances: Map<string, number>): boolean {
  let sum = 0;
  for (const amount of balances.values()) sum += amount;
  return sum === 0;
}