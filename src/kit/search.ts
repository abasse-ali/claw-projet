// Recherche et filtres pour les opérations.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAllCategories } from "./categorize";

/** Normalise pour la recherche : minuscules, sans accents. */
export function normSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "et")
    .trim();
}

type FilterState = {
  /** Texte de recherche (normalisé). */
  query: string;
  /** Catégorie filtrée ("" = toutes). */
  category: string;
  /** Type : "in" = rentrées, "out" = dépenses, "" = tous. */
  kind: "in" | "out" | "";
  /** Mois filtré ("all" = tous, sinon "YYYY-MM"). */
  month: string | "all";
  setQuery: (query: string) => void;
  setCategory: (category: string) => void;
  setKind: (kind: "in" | "out" | "") => void;
  setMonth: (month: string | "all") => void;
  clear: () => void;
};

const initial: Omit<FilterState, "setQuery" | "setCategory" | "setKind" | "setMonth" | "clear"> = {
  query: "",
  category: "",
  kind: "",
  month: "",
};

export const useFilter = create<FilterState>()(
  persist(
    (set) => ({
      ...initial,
      setQuery: (query) => set({ query: normSearch(query) }),
      setCategory: (category) => set({ category }),
      setKind: (kind) => set({ kind }),
      setMonth: (month) => set({ month }),
      clear: () => set(initial),
    }),
    { name: "appli-filters" },
  ),
);

/** Filtre une liste d'entrées selon l'état du store. */
export function applyFilters<T extends { label: string; category: string; amount: number; date: string }>(
  entries: T[],
  state: Pick<FilterState, "query" | "category" | "kind" | "month">,
): T[] {
  return entries.filter((entry) => {
    if (state.category && entry.category !== state.category) return false;
    if (state.kind === "in" && entry.amount <= 0) return false;
    if (state.kind === "out" && entry.amount >= 0) return false;
    if (state.month && state.month !== "all" && !entry.date.startsWith(state.month)) return false;
    if (state.query) {
      const hay = normSearch(`${entry.label} ${entry.category}`);
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });
}

/** Liste des catégories disponibles pour les filtres. */
export function getFilterCategories(): { value: string; label: string }[] {
  const cats = getAllCategories();
  return [{ value: "", label: "Toutes" }, ...cats.map((c) => ({ value: c, label: c }))];
}

/** Liste des types pour les filtres. */
export const filterKinds: { value: "in" | "out" | ""; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "in", label: "Rentrées" },
  { value: "out", label: "Dépenses" },
];