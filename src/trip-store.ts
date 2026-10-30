// Store pour l'application de partage de dépenses de voyage
// Données persistées dans localStorage : participants, dépenses, voyage actif

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { money, parseAmount } from "./kit/format";

export type Participant = {
  id: string;
  name: string; // Prénom tel que saisi (avec majuscules, accents conservés)
  normalizedName: string; // Pour la comparaison (lowercase, trim, NFC)
};

export type Expense = {
  id: string;
  label: string;
  amountCents: number; // Montant en centimes (entier)
  payerId: string; // ID du participant qui a payé
  participantIds: string[]; // IDs des participants concernés (tous par défaut)
  date: string; // "2026-10-28"
};

export type Trip = {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  createdAt: string;
};

type TripState = {
  trips: Trip[];
  activeTripId: string | null;
  // Actions
  createTrip: (name: string) => Trip;
  setActiveTrip: (tripId: string | null) => void;
  getActiveTrip: () => Trip | null;
  // Participants
  addParticipant: (tripId: string, name: string) => Participant | { error: string };
  removeParticipant: (tripId: string, participantId: string) => { error?: string };
  // Dépenses
  addExpense: (tripId: string, expense: Omit<Expense, "id">) => Expense;
  removeExpense: (tripId: string, expenseId: string) => void;
  // Calculs
  getBalances: (tripId: string) => Map<string, number>; // participantId -> solde en centimes
  getReimbursements: (tripId: string) => Reimbursement[];
  // Export/Import
  exportTrip: (tripId: string) => string;
  importTrip: (json: string) => { error?: string; trip?: Trip };
};

export type Reimbursement = {
  from: string; // participantId qui doit payer
  to: string; // participantId qui reçoit
  amountCents: number;
  fromName: string;
  toName: string;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

function cleanName(name: string): string {
  return name.trim() || "Sans nom";
}

const STORE_KEY = "trip-expenses";

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: [],
      activeTripId: null,

      createTrip: (name: string) => {
        const trip: Trip = {
          id: newId(),
          name: cleanName(name),
          participants: [],
          expenses: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          trips: [...state.trips, trip],
          activeTripId: trip.id,
        }));
        return trip;
      },

      setActiveTrip: (tripId: string | null) => {
        set({ activeTripId: tripId });
      },

      getActiveTrip: () => {
        const { trips, activeTripId } = get();
        return trips.find((t) => t.id === activeTripId) ?? null;
      },

      addParticipant: (tripId: string, name: string) => {
        const clean = cleanName(name);
        const normalized = normalizeName(clean);
        const trip = get().trips.find((t) => t.id === tripId);
        if (!trip) return { error: "Voyage introuvable" };

        // Vérifier l'unicité (insensible à la casse, accents, espaces)
        const exists = trip.participants.some((p) => p.normalizedName === normalized);
        if (exists) {
          return { error: "Ce participant existe déjà" };
        }

        const participant: Participant = {
          id: newId(),
          name: clean,
          normalizedName: normalized,
        };

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === tripId ? { ...t, participants: [...t.participants, participant] } : t
          ),
        }));

        return participant;
      },

      removeParticipant: (tripId: string, participantId: string) => {
        const trip = get().trips.find((t) => t.id === tripId);
        if (!trip) return { error: "Voyage introuvable" };

        // Vérifier si le participant apparaît dans une dépense
        const usedInExpense = trip.expenses.some(
          (e) => e.payerId === participantId || e.participantIds.includes(participantId)
        );
        if (usedInExpense) {
          return { error: "Ce participant a des dépenses, impossible de le supprimer" };
        }

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === tripId
              ? { ...t, participants: t.participants.filter((p) => p.id !== participantId) }
              : t
          ),
        }));

        return {};
      },

      addExpense: (tripId: string, expenseData: Omit<Expense, "id">) => {
        const expense: Expense = {
          ...expenseData,
          id: newId(),
          amountCents: Math.round(expenseData.amountCents), // Assurer l'entier
        };

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t
          ),
        }));

        return expense;
      },

      removeExpense: (tripId: string, expenseId: string) => {
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === tripId
              ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }
              : t
          ),
        }));
      },

      getBalances: (tripId: string) => {
        const trip = get().trips.find((t) => t.id === tripId);
        if (!trip) return new Map();

        const balances = new Map<string, number>();
        // Initialiser à 0 pour tous les participants
        for (const p of trip.participants) {
          balances.set(p.id, 0);
        }

        // Pour chaque dépense
        for (const expense of trip.expenses) {
          const participantsCount = expense.participantIds.length;
          if (participantsCount === 0) continue;

          const shareCents = Math.floor(expense.amountCents / participantsCount);
          const remainder = expense.amountCents % participantsCount;

          // Le payeur a payé pour tout le monde
          const currentPayer = balances.get(expense.payerId) ?? 0;
          balances.set(expense.payerId, currentPayer + expense.amountCents);

          // Chaque participant doit sa part
          for (let i = 0; i < expense.participantIds.length; i++) {
            const pid = expense.participantIds[i];
            // Le premier(s) participant(s) reçoivent 1 centime de plus pour arrondir
            const extra = i < remainder ? 1 : 0;
            const current = balances.get(pid) ?? 0;
            balances.set(pid, current - shareCents - extra);
          }
        }

        return balances;
      },

      getReimbursements: (tripId: string) => {
        const trip = get().trips.find((t) => t.id === tripId);
        if (!trip) return [];

        const balances = get().getBalances(tripId);
        const participants = trip.participants;

        // Créer deux listes : créanciers (solde > 0) et débiteurs (solde < 0)
        const creditors: { id: string; name: string; amount: number }[] = [];
        const debtors: { id: string; name: string; amount: number }[] = [];

        for (const p of participants) {
          const balance = balances.get(p.id) ?? 0;
          if (balance > 0) {
            creditors.push({ id: p.id, name: p.name, amount: balance });
          } else if (balance < 0) {
            debtors.push({ id: p.id, name: p.name, amount: -balance }); // Montant positif dû
          }
        }

        // Trier pour minimiser les virements : plus gros créanciers/débiteurs d'abord
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const reimbursements: Reimbursement[] = [];
        let ci = 0;
        let di = 0;

        while (ci < creditors.length && di < debtors.length) {
          const creditor = creditors[ci];
          const debtor = debtors[di];

          const transfer = Math.min(creditor.amount, debtor.amount);

          reimbursements.push({
            from: debtor.id,
            to: creditor.id,
            amountCents: transfer,
            fromName: debtor.name,
            toName: creditor.name,
          });

          creditors[ci].amount -= transfer;
          debtors[di].amount -= transfer;

          if (creditors[ci].amount === 0) ci++;
          if (debtors[di].amount === 0) di++;
        }

        return reimbursements;
      },

      exportTrip: (tripId: string) => {
        const trip = get().trips.find((t) => t.id === tripId);
        if (!trip) return "";
        return JSON.stringify(trip, null, 2);
      },

      importTrip: (json: string) => {
        try {
          const trip = JSON.parse(json) as Trip;
          // Validation basique
          if (!trip.id || !trip.name || !Array.isArray(trip.participants) || !Array.isArray(trip.expenses)) {
            return { error: "Format invalide" };
          }
          // Nouveau ID pour éviter les conflits
          const newTrip: Trip = {
            ...trip,
            id: newId(),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({
            trips: [...state.trips, newTrip],
            activeTripId: newTrip.id,
          }));
          return { trip: newTrip };
        } catch {
          return { error: "JSON invalide" };
        }
      },
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({ trips: state.trips, activeTripId: state.activeTripId }),
    }
  )
);

// Helpers pour l'affichage
export function formatCents(cents: number): string {
  return money(cents / 100);
}

export function parseAmountCents(input: string): number {
  const euros = parseAmount(input);
  if (!Number.isFinite(euros)) return NaN;
  return Math.round(euros * 100);
}