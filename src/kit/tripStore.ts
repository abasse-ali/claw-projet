// Les données du voyage : participants et dépenses, gardées sur le téléphone (localStorage).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number; // en centimes
  paidBy: string; // participant id
  forWhom: string[]; // participant ids, empty = everyone
};

type TripState = {
  participants: Participant[];
  expenses: Expense[];
  addParticipant: (name: string) => Participant | null;
  removeParticipant: (id: string) => boolean;
  updateParticipant: (id: string, name: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  removeExpense: (id: string) => void;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  clear: () => () => void;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Nom sous lequel l'appli garde ses données sur le téléphone. */
export const TRIP_STORE_KEY = "trip-expenses";

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],
      addParticipant: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        // Vérifier unicité (insensible à la casse et accents)
        const normalized = trimmed.toLowerCase().normalize("NFC");
        const exists = get().participants.some(
          (p) => p.name.toLowerCase().normalize("NFC") === normalized
        );
        if (exists) return null;
        const participant: Participant = { id: newId(), name: trimmed };
        set({ participants: [...get().participants, participant] });
        return participant;
      },
      removeParticipant: (id: string) => {
        const { participants, expenses } = get();
        // Vérifier si le participant est utilisé dans une dépense
        const used = expenses.some(
          (e) => e.paidBy === id || e.forWhom.includes(id)
        );
        if (used) return false;
        set({ participants: participants.filter((p) => p.id !== id) });
        return true;
      },
      updateParticipant: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase().normalize("NFC");
        const exists = get().participants.some(
          (p) => p.id !== id && p.name.toLowerCase().normalize("NFC") === normalized
        );
        if (exists) return;
        set({
          participants: get().participants.map((p) =>
            p.id === id ? { ...p, name: trimmed } : p
          ),
        });
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
      clear: () => {
        const before = { participants: get().participants, expenses: get().expenses };
        set({ participants: [], expenses: [] });
        return () => set({ participants: before.participants, expenses: before.expenses });
      },
    }),
    { name: TRIP_STORE_KEY }
  )
);

/** Calcule le solde de chaque participant (ce qu'il a payé - sa part) en centimes.
 * La somme des soldes fait toujours 0. */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Map<string, number> {
  const balances = new Map<string, number>();
  participants.forEach((p) => balances.set(p.id, 0));

  for (const expense of expenses) {
    const { amount, paidBy, forWhom } = expense;
    const beneficiaries = forWhom.length > 0 ? forWhom : participants.map((p) => p.id);
    const share = Math.floor(amount / beneficiaries.length);
    const remainder = amount % beneficiaries.length;

    // Celui qui a payé reçoit le montant total
    balances.set(paidBy, (balances.get(paidBy) || 0) + amount);

    // Chaque bénéficiaire doit sa part
    beneficiaries.forEach((pid, index) => {
      const extra = index < remainder ? 1 : 0;
      const owed = share + extra;
      balances.set(pid, (balances.get(pid) || 0) - owed);
    });
  }

  return balances;
}

/** Calcule les remboursements minimaux pour équilibrer les soldes.
 * Retourne une liste de { from, to, amount } en centimes. */
export function computeSettlements(
  balances: Map<string, number>
): Array<{ from: string; to: string; amount: number }> {
  // Créer des listes de créanciers (solde > 0) et débiteurs (solde < 0)
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  balances.forEach((amount, id) => {
    if (amount > 0) creditors.push({ id, amount });
    else if (amount < 0) debtors.push({ id, amount: -amount });
  });

  // Trier pour un résultat déterministe
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Array<{ from: string; to: string; amount: number }> = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    settlements.push({ from: debtor.id, to: creditor.id, amount });

    creditors[ci] = { ...creditor, amount: creditor.amount - amount };
    debtors[di] = { ...debtor, amount: debtor.amount - amount };

    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }

  return settlements;
}

/** Formate un montant en centimes vers string "12,34 €" */
export function formatCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `${euros} €`;
}

/** Parse un montant string "12,34" ou "12.34" vers centimes */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}