// Budgets mensuels par catégorie avec alertes.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { monthOf, today } from "./format";
import { getAllCategories } from "./categorize";

type Budget = Record<string, number>; // catégorie -> montant mensuel (en euros, positif = limite de dépenses)

type BudgetState = {
  budgets: Budget;
  setBudget: (category: string, amount: number | null) => void;
  getBudget: (category: string) => number | null;
  clearBudget: (category: string) => void;
  /** Renvoie les catégories qui dépassent leur budget pour un mois donné. */
  getOverBudget: (entries: { category: string; amount: number; date: string }[], month: string) => Array<{ category: string; budget: number; spent: number; overspend: number }>;
  /** Renvoie les catégories proches de leur budget (> 80%). */
  getNearBudget: (entries: { category: string; amount: number; date: string }[], month: string) => Array<{ category: string; budget: number; spent: number; percent: number }>;
};

const initial: Omit<BudgetState, "setBudget" | "getBudget" | "clearBudget" | "getOverBudget" | "getNearBudget"> = {
  budgets: {},
};

export const useBudget = create<BudgetState>()(
  persist(
    (set, get) => ({
      ...initial,
      setBudget: (category, amount) =>
        set((state) => {
          const budgets = { ...state.budgets };
          if (amount === null || amount <= 0) {
            delete budgets[category];
          } else {
            budgets[category] = Math.round(amount * 100) / 100;
          }
          return { budgets };
        }),
      getBudget: (category) => get().budgets[category] ?? null,
      clearBudget: (category) =>
        set((state) => {
          const budgets = { ...state.budgets };
          delete budgets[category];
          return { budgets };
        }),
      getOverBudget: (entries, month) => {
        const budgets = get().budgets;
        const spendingByCat: Record<string, number> = {};
        for (const entry of entries) {
          if (entry.amount < 0 && entry.date.startsWith(month)) {
            spendingByCat[entry.category] = (spendingByCat[entry.category] ?? 0) - entry.amount;
          }
        }
        const result: Array<{ category: string; budget: number; spent: number; overspend: number }> = [];
        for (const [category, budget] of Object.entries(budgets)) {
          const spent = spendingByCat[category] ?? 0;
          if (spent > budget) {
            result.push({ category, budget, spent, overspend: spent - budget });
          }
        }
        return result.sort((a, b) => b.overspend - a.overspend);
      },
      getNearBudget: (entries, month) => {
        const budgets = get().budgets;
        const spendingByCat: Record<string, number> = {};
        for (const entry of entries) {
          if (entry.amount < 0 && entry.date.startsWith(month)) {
            spendingByCat[entry.category] = (spendingByCat[entry.category] ?? 0) - entry.amount;
          }
        }
        const result: Array<{ category: string; budget: number; spent: number; percent: number }> = [];
        for (const [category, budget] of Object.entries(budgets)) {
          const spent = spendingByCat[category] ?? 0;
          if (spent > budget * 0.8 && spent <= budget) {
            result.push({ category, budget, spent, percent: spent / budget });
          }
        }
        return result.sort((a, b) => b.percent - a.percent);
      },
    }),
    { name: "appli-budgets" },
  ),
);

/** Liste des catégories pour le sélecteur de budget. */
export function getBudgetCategories(): { value: string; label: string }[] {
  return getAllCategories().map((c) => ({ value: c, label: c }));
}