// Store pour l'application de partage de dépenses de voyage
// Participants, dépenses, calculs de soldes et remboursements

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  /** Montant en centimes (entier) */
  amountCents: number;
  /** ID du participant qui a payé */
  paidBy: string;
  /** IDs des participants concernés (tous si vide) */
  forWhom: string[];
  /** Catégorie de la dépense */
  category: string;
  /** Date ISO "2026-10-28" */
  date: string;
};

type TripState = {
  participants: Participant[];
  expenses: Expense[];
  addParticipant: (name: string) => Participant | null;
  removeParticipant: (id: string) => boolean;
  updateParticipant: (id: string, name: string) => boolean;
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  removeExpense: (id: string) => void;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  clearAll: () => void;
};

let participantCounter = 0;
const newParticipantId = () => `p-${Date.now().toString(36)}-${(participantCounter++).toString(36)}`;

let expenseCounter = 0;
const newExpenseId = () => `e-${Date.now().toString(36)}-${(expenseCounter++).toString(36)}`;

const normalizeName = (name: string) => name.trim();

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      participants: [],
      expenses: [],

      addParticipant: (name: string) => {
        const normalized = normalizeName(name);
        if (!normalized) return null;

        const { participants } = get();
        // Vérifier unicité (insensible à la casse et espaces)
        const exists = participants.some(
          (p) => p.name.toLowerCase() === normalized.toLowerCase()
        );
        if (exists) return null;

        const participant: Participant = {
          id: newParticipantId(),
          name: normalized,
        };
        set({ participants: [...participants, participant] });
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
        const normalized = normalizeName(name);
        if (!normalized) return false;

        const { participants } = get();
        const exists = participants.some(
          (p) => p.id !== id && p.name.toLowerCase() === normalized.toLowerCase()
        );
        if (exists) return false;

        set({
          participants: participants.map((p) =>
            p.id === id ? { ...p, name: normalized } : p
          ),
        });
        return true;
      },

      addExpense: (expense) => {
        const newExpense: Expense = {
          ...expense,
          id: newExpenseId(),
        };
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

      clearAll: () => {
        set({ participants: [], expenses: [] });
      },
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

// --- Calculs ---

/** Convertit centimes → euros pour l'affichage */
export const centsToEuros = (cents: number) => cents / 100;

/** Convertit euros → centimes pour le stockage */
export const eurosToCents = (euros: number) => Math.round(euros * 100);

/** Formate un montant en centimes pour l'affichage (ex: "12,50 €") */
export const formatCents = (cents: number) => {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const centsPart = abs % 100;
  return `${sign}${euros.toLocaleString("fr-FR")},${centsPart.toString().padStart(2, "0")} €`;
};

/** Calcule le solde de chaque participant en centimes
 * Solde = ce qu'il a payé - sa part des dépenses
 * La somme des soldes doit faire 0
 */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Map<string, number> {
  const balances = new Map<string, number>();
  
  // Initialiser à 0
  for (const p of participants) {
    balances.set(p.id, 0);
  }

  for (const expense of expenses) {
    const { amountCents, paidBy, forWhom } = expense;
    const concerned = forWhom.length > 0 ? forWhom : participants.map((p) => p.id);
    const shareCount = concerned.length;
    
    if (shareCount === 0) continue;

    // Part par personne (division euclidienne pour les centimes)
    const share = Math.floor(amountCents / shareCount);
    const remainder = amountCents % shareCount;

    // Le payeur a payé la totalité
    const currentPaidBy = balances.get(paidBy) ?? 0;
    balances.set(paidBy, currentPaidBy + amountCents);

    // Chaque personne concernée doit sa part
    for (let i = 0; i < concerned.length; i++) {
      const participantId = concerned[i];
      const current = balances.get(participantId) ?? 0;
      // Les premiers participants prennent le reste (1 centime de plus)
      const extra = i < remainder ? 1 : 0;
      balances.set(participantId, current - share - extra);
    }
  }

  return balances;
}

/** Calcule les remboursements optimaux (minimum de virements)
 * Retourne une liste de { from, to, amountCents }
 */
export function computeSettlements(
  participants: Participant[],
  balances: Map<string, number>
): Array<{ from: string; to: string; amountCents: number }> {
  const settlements: Array<{ from: string; to: string; amountCents: number }> = [];

  // Créer des listes de créanciers (solde > 0) et débiteurs (solde < 0)
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const [id, balance] of balances) {
    if (balance > 0) creditors.push({ id, amount: balance });
    else if (balance < 0) debtors.push({ id, amount: -balance });
  }

  // Trier pour stabilité (optionnel mais prévisible)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let i = 0; // index créancier
  let j = 0; // index débiteur

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(creditor.amount, debtor.amount);
    
    if (amount > 0) {
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amountCents: amount,
      });

      creditors[i] = { ...creditor, amount: creditor.amount - amount };
      debtors[j] = { ...debtor, amount: debtor.amount - amount };
    }

    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return settlements;
}

/** Vérifie que la somme des soldes fait 0 */
export function verifyBalancesSumZero(balances: Map<string, number>): boolean {
  let sum = 0;
  for (const balance of balances.values()) {
    sum += balance;
  }
  return sum === 0;
}

/** Obtient le nom d'un participant par son ID */
export function getParticipantName(
  participants: Participant[],
  id: string
): string {
  return participants.find((p) => p.id === id)?.name ?? "Inconnu";
}