// Apprentissage de la catégorisation : mémorise les corrections manuelles de l'utilisateur
// pour améliorer les suggestions futures.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normSearch } from "./search";

type LearnedRule = {
  /** Libellé normalisé (minuscules, sans accents). */
  label: string;
  /** Catégorie choisie par l'utilisateur. */
  category: string;
  /** Nombre de fois que cette correspondance a été confirmée. */
  count: number;
  /** Dernière mise à jour. */
  updated: number;
};

type CategorizeLearnState = {
  learned: LearnedRule[];
  /** Enregistre une correction manuelle : libellé -> catégorie. */
  learn: (label: string, category: string) => void;
  /** Trouve une catégorie apprise pour un libellé (correspondance exacte normalisée). */
  findLearned: (label: string) => string | null;
  /** Trouve des suggestions apprises pour un libellé (correspondance partielle). */
  suggestLearned: (label: string, limit?: number) => Array<{ category: string; count: number }>;
  /** Supprime une règle apprise. */
  forget: (label: string) => void;
  /** Efface tout l'apprentissage. */
  clear: () => void;
};

const initial: Omit<CategorizeLearnState, "learn" | "findLearned" | "suggestLearned" | "forget" | "clear"> = {
  learned: [],
};

export const useCategorizeLearn = create<CategorizeLearnState>()(
  persist(
    (set, get) => ({
      ...initial,
      learn: (label, category) => {
        const normalized = normSearch(label);
        if (!normalized) return;
        set((state) => {
          const existing = state.learned.find((r) => r.label === normalized);
          if (existing) {
            return {
              learned: state.learned.map((r) =>
                r.label === normalized ? { ...r, category, count: r.count + 1, updated: Date.now() } : r
              ),
            };
          }
          return {
            learned: [...state.learned, { label: normalized, category, count: 1, updated: Date.now() }],
          };
        });
      },
      findLearned: (label) => {
        const normalized = normSearch(label);
        if (!normalized) return null;
        const rule = get().learned.find((r) => r.label === normalized);
        return rule?.category ?? null;
      },
      suggestLearned: (label, limit = 3) => {
        const normalized = normSearch(label);
        if (!normalized) return [];
        const words = normalized.split(/\s+/).filter((w) => w.length > 2);
        if (!words.length) return [];

        const scores = new Map<string, number>();
        for (const rule of get().learned) {
          // Correspondance exacte
          if (rule.label === normalized) {
            scores.set(rule.category, (scores.get(rule.category) ?? 0) + rule.count * 10);
            continue;
          }
          // Correspondance partielle : au moins un mot en commun
          const ruleWords = rule.label.split(/\s+/);
          for (const word of words) {
            if (ruleWords.includes(word)) {
              scores.set(rule.category, (scores.get(rule.category) ?? 0) + rule.count);
              break;
            }
          }
        }
        return [...scores.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([category, count]) => ({ category, count }));
      },
      forget: (label) => {
        const normalized = normSearch(label);
        if (!normalized) return;
        set((state) => ({
          learned: state.learned.filter((r) => r.label !== normalized),
        }));
      },
      clear: () => set({ learned: [] }),
    }),
    { name: "appli-categorize-learn" },
  ),
);