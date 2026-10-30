// Les données de l'appli, gardées sur le téléphone (localStorage) : les opérations, le mois
// affiché. Au premier lancement, ce que l'utilisateur a donné (`seed`) est posé au mois en
// courant, jamais recopié sur les mois d'avant.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { monthOf, today } from "./format";

export type Participant = {
  id: string;
  name: string;
};

export type Entry = {
  id: string;
  label: string;
  /** Positif : une rentrée ; négatif : une dépense. */
  amount: number;
  category: string;
  /** « 2026-10-28 ». */
  date: string;
  /** Qui a payé (participant ou "tout_le_monde") */
  payer: string | Participant;
  /** Pour qui (tout le monde ou liste de participants) */
  forWhom: string | Participant[];
};

export type NewEntry = Omit<Entry, "id" | "date"> & { date?: string };

type EntriesState = {
  entries: Entry[];
  /** Le mois affiché, « 2026-10 ». */
  month: string;
  /** L'opération ajoutée en dernier (elle entre en glissant dans les listes). */
  fresh: string | null;
  /** Les participants inscrits dans le voyage. */
  participants: Participant[];
  add: (entry: NewEntry) => Entry;
  update: (id: string, fields: Partial<NewEntry>) => void;
  /** Retire l'opération et rend de quoi l'annuler. */
  remove: (id: string) => (() => void) | null;
  /** Efface tout et rend de quoi l'annuler. */
  clear: () => () => void;
  setMonth: (month: string) => void;
  /** Ajoute un participant (refus si doublon). */
  addParticipant: (name: string) => boolean;
  /** Supprime un participant (refuse s'il apparaît dans une dépense). */
  removeParticipant: (id: string) => boolean;
  /** Renomme un participant. */
  renameParticipant: (id: string, newName: string) => boolean;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Nettoie et normalise une entrée brute en Entry complète. */
const clean = (entry: NewEntry, id = newId()): Entry => {
  // Déterminer le payeur : string (depuis CSV ou "tout_le_monde") ou Participant object
  let payer: string | Participant;
  if (typeof entry.payer === "string") {
    payer = entry.payer;
  } else if (entry.payer && typeof entry.payer === "object" && "id" in entry.payer) {
    payer = entry.payer;
  } else {
    payer = "tout_le_monde";
  }

  // Déterminer pourWhom : string ("tout_le_monde"), Participant, ou Participant[]
  let forWhom: string | Participant[] = "tout_le_monde";
  if (Array.isArray(entry.forWhom)) {
    forWhom = entry.forWhom.map((p: any) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "id" in p) return p;
      return `${Date.now()}`;
    });
  } else if (entry.forWhom && typeof entry.forWhom === "object" && "id" in entry.forWhom) {
    forWhom = [entry.forWhom];
  } else if (!entry.forWhom || entry.forWhom === "") {
    forWhom = "tout_le_monde";
  }

  return {
    id,
    label: String(entry.label || "").trim() || "Sans nom",
    amount: Number.isFinite(entry.amount) ? Math.round(entry.amount * 100) / 100 : 0,
    category: String(entry.category || "").trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") ? (entry.date as string) : today(),
    payer,
    forWhom,
  };
};

/** Nom sous lequel l'appli garde ses données sur le téléphone. */
export const STORE_KEY = "appli";

export const useEntries = create<EntriesState>()(
  persist(
    (set, get) => ({
      entries: [],
      month: monthOf(today()),
      fresh: null,
      participants: [],
      add: (fields) => {
        const entry = clean(fields);
        // Vérifier que le payeur existe dans les participants s'il est précis (pas "tout_le_monde")
        // After clean(), payer is either "tout_le_monde" (string) or a Participant object.
        // Use a safe check: if payer is not the string "tout_le_monde", try to access its id
        if (entry.payer !== "tout_le_monde") {
          // Safe access: check that payer has an id property before using it
          const payerId = (entry.payer as { id?: string }).id;
          if (payerId !== undefined) {
            const exists = get().participants.some((p) => p.id === payerId);
            if (!exists) {
              // Auto-add the payer if not in participants
              set({ participants: [...get().participants, { id: payerId, name: payerId }] });
            }
          }
        }
        set({ entries: [...get().entries, entry], fresh: entry.id });
        return entry;
      },
      update: (id, fields) => {
        set({
          entries: get().entries.map((entry) =>
            entry.id === id ? clean({ ...entry, ...fields }, id) : entry
          ),
        });
      },
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
      addParticipant: (name: string) => {
        // Vérifier les doublons (après strip, casefold, normalize)
        const trimmed = name.trim();
        const exists = get().participants.some(
          (p) => String(p.name).trim() === trimmed || String(p.name).toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return false;

        const newId = `${Date.now().toString(36)}-${(Math.random() * 100000).toString(36)}`;
        set({ participants: [...get().participants, { id: newId, name: trimmed }] });
        return true;
      },
      removeParticipant: (id: string) => {
        // Vérifier que le participant n'apparait pas dans une dépense
        const hasEntry = get().entries.some((entry) => {
          const payerIsThis = typeof entry.payer === "string" ? entry.payer === id : entry.payer.id === id;
          const forWhomContains = Array.isArray(entry.forWhom)
            ? entry.forWhom.some((p: any) => typeof p === "string" ? p === id : p.id === id)
            : false;
          return payerIsThis || forWhomContains;
        });

        if (hasEntry) return false;

        set({ participants: get().participants.filter((p) => p.id !== id) });
        return true;
      },
      renameParticipant: (id: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return false;

        // Vérifier le doublon
        const exists = get().participants.some(
          (p) => String(p.id) !== id && String(p.name).trim() === trimmed
        );
        if (exists) return false;

        set({
          participants: get().participants.map((p) =>
            p.id === id ? { ...p, name: trimmed } : p
          ),
        });
        return true;
      },
    }),
    { name: STORE_KEY, partialize: (state) => ({ entries: state.entries }) }
  ),
);

/** Pose les données de départ au premier lancement seulement : les chiffres que
 * l'utilisateur a donnés, au mois en courant. Effacées plus tard, elles ne reviennent pas.
 */
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
