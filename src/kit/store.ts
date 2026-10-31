// Les données de l'appli, gardées sur le téléphone (localStorage) : les opérations, le mois
// affiché. Au premier lancement, ce que l'utilisateur a donné (`seed`) est posé au mois en
// cours, jamais recopié sur les mois d'avant.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { monthOf, today } from "./format";

export type Entry = {
  id: string;
  label: string;
  /** Positif : une rentrée ; négatif : une dépense. */
  amount: number;
  category: string;
  /** « 2026-10-28 ». */
  date: string;
  /** Marque une opération générée automatiquement à partir d'une dépense obligatoire ou d'un revenu régulier. */
  recurring?: boolean;
};

export type NewEntry = Omit<Entry, "id" | "date"> & { date?: string };

type EntriesState = {
  entries: Entry[];
  /** Le mois affiché, « 2026-10 ». */
  month: string;
  /** L'opération ajoutée en dernier (elle entre en glissant dans les listes). */
  fresh: string | null;
  add: (entry: NewEntry) => Entry;
  update: (id: string, fields: Partial<NewEntry>) => void;
  /** Retire l'opération et rend de quoi l'annuler. */
  remove: (id: string) => (() => void) | null;
  /** Efface tout et rend de quoi l'annuler. */
  clear: () => () => void;
  setMonth: (month: string) => void;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
const clean = (entry: NewEntry, id = newId()): Entry => ({
  id,
  label: String(entry.label || "").trim() || "Sans nom",
  amount: Number.isFinite(entry.amount) ? Math.round(entry.amount * 100) / 100 : 0,
  category: String(entry.category || "").trim(),
  date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") ? (entry.date as string) : today(),
});

/** Nom sous lequel l'appli garde ses données sur le téléphone. */
export const STORE_KEY = "appli";

export const useEntries = create<EntriesState>()(
  persist(
    (set, get) => ({
      entries: [],
      month: monthOf(today()),
      fresh: null,
      add: (fields) => {
        const entry = clean(fields);
        set({ entries: [...get().entries, entry], fresh: entry.id });
        return entry;
      },
      update: (id, fields) =>
        set({ entries: get().entries.map((entry) => (entry.id === id ? clean({ ...entry, ...fields }, id) : entry)) }),
      remove: (id) => {
        const before = get().entries;
        const index = before.findIndex((entry) => entry.id === id);
        if (index < 0) return null;
        set({ entries: before.filter((entry) => entry.id !== id) });
        const gone = before[index];
        return () => {
          const now = get().entries;
          set({ entries: [...now.slice(0, index), gone, ...now.slice(index)], fresh: gone.id });
        };
      },
      clear: () => {
        const before = get().entries;
        set({ entries: [] });
        return () => set({ entries: before });
      },
      setMonth: (month) => set({ month }),
    }),
    { name: STORE_KEY, partialize: (state) => ({ entries: state.entries }) },
  ),
);

/** Pose les données de départ au premier lancement seulement : les chiffres que
 * l'utilisateur a donnés, au mois en cours. Effacées plus tard, elles ne reviennent pas. */
export function seedOnce(seed: NewEntry[]): void {
  const marker = `${STORE_KEY}:seeded`;
  try {
    if (localStorage.getItem(marker)) return;
    localStorage.setItem(marker, "1");
  } catch {
    // Rien n'est gardé sur ce téléphone (navigation privée) : les données de départ à chaque fois.
  }
  if (useEntries.getState().entries.length || !seed.length) return;
  const month = monthOf(today());
  useEntries.setState({ entries: seed.map((entry) => clean({ ...entry, date: entry.date || `${month}-01` })) });
}

/** Les opérations d'un mois. */
export const inMonth = (entries: Entry[], month: string) => entries.filter((entry) => entry.date.startsWith(month));

/** Rentrées, dépenses et solde d'une liste d'opérations. */
export function totals(entries: Entry[]) {
  const income = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  // Math.abs : jamais « -0,00 € » quand rien n'est dépensé.
  const spending = Math.abs(entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
  return { income, spending, balance: income - spending };
}

/** La plus récente d'abord. */
export const newestFirst = (entries: Entry[]) =>
  entries.map((entry, index) => [entry, index] as const)
    .sort((a, b) => b[0].date.localeCompare(a[0].date) || b[1] - a[1])
    .map(([entry]) => entry);

/** Génère une clé unique pour une opération récurrente (pour éviter les doublons). */
function recurringKey(type: "expense" | "income", label: string, month: string, amount: number): string {
  return `recurring|${type}|${label.trim().toLowerCase()}|${month}|${Math.round(amount * 100)}`;
}

/** Synchronise les dépenses obligatoires et revenus réguliers du mois courant vers les opérations.
 * Crée ou met à jour les entrées avec recurring=true pour le mois affiché. */
export function syncRecurringToEntries(month: string): void {
  // Import dynamique pour éviter les cycles
  const { useRecurring } = require("./recurring");
  const { useEntries } = require("./store");
  const { monthOf, today } = require("./format");

  const { expenses, incomes } = useRecurring.getState();
  const { entries, add, update } = useEntries.getState();

  // Construire un set des clés existantes pour ce mois
  const existingRecurringKeys = new Set<string>();
  const entriesByRecurringKey = new Map<string, Entry>();
  
  for (const entry of entries) {
    if (entry.recurring && entry.date.startsWith(month)) {
      // Extraire le type, label, montant depuis l'entrée
      // On ne peut pas récupérer le type original, on utilise une approximation
      const key = `${entry.label.trim().toLowerCase()}|${month}|${Math.round(Math.abs(entry.amount) * 100)}`;
      existingRecurringKeys.add(key);
      entriesByRecurringKey.set(key, entry);
    }
  }

  const monthStart = `${month}-01`;

  // Synchroniser les dépenses obligatoires (montants négatifs)
  for (const expense of expenses) {
    const key = `${expense.label.trim().toLowerCase()}|${month}|${Math.round(expense.amount * 100)}`;
    const existing = entriesByRecurringKey.get(key);
    
    if (existing) {
      // Mettre à jour si montant ou catégorie a changé
      if (existing.amount !== -expense.amount || existing.category !== expense.category || existing.label !== expense.label) {
        update(existing.id, { 
          amount: -expense.amount, 
          category: expense.category, 
          label: expense.label 
        });
      }
    } else {
      // Créer nouvelle entrée
      add({
        label: expense.label,
        amount: -expense.amount,
        category: expense.category,
        date: monthStart,
        recurring: true,
      });
    }
  }

  // Synchroniser les revenus réguliers (montants positifs)
  for (const income of incomes) {
    const key = `${income.label.trim().toLowerCase()}|${month}|${Math.round(income.amount * 100)}`;
    const existing = entriesByRecurringKey.get(key);
    
    if (existing) {
      // Mettre à jour si montant ou label a changé
      if (existing.amount !== income.amount || existing.label !== income.label) {
        update(existing.id, { 
          amount: income.amount, 
          label: income.label 
        });
      }
    } else {
      // Créer nouvelle entrée
      add({
        label: income.label,
        amount: income.amount,
        category: "Salaire", // Catégorie par défaut pour les revenus
        date: monthStart,
        recurring: true,
      });
    }
  }

  // Supprimer les entrées récurrentes qui ne correspondent plus à aucune dépense/revenu
  const currentKeys = new Set<string>();
  for (const expense of expenses) {
    currentKeys.add(`${expense.label.trim().toLowerCase()}|${month}|${Math.round(expense.amount * 100)}`);
  }
  for (const income of incomes) {
    currentKeys.add(`${income.label.trim().toLowerCase()}|${month}|${Math.round(income.amount * 100)}`);
  }

  for (const entry of entries) {
    if (entry.recurring && entry.date.startsWith(month)) {
      const key = `${entry.label.trim().toLowerCase()}|${month}|${Math.round(Math.abs(entry.amount) * 100)}`;
      if (!currentKeys.has(key)) {
        // Cette entrée récurrente n'a plus de correspondant, la supprimer
        // On utilise une méthode directe pour éviter de déclencher des effets de bord
        useEntries.setState({ 
          entries: entries.filter((e: Entry) => e.id !== entry.id) 
        });
      }
    }
  }
}
