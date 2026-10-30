// Store pour le suivi d'habitudes
// Chaque habitude a un nom unique et un ensemble de dates cochées (format "YYYY-MM-DD")

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { today } from "../kit/format";

export type Habit = {
  id: string;
  name: string;
  /** Dates cochées au format "YYYY-MM-DD" */
  checkedDates: string[];
  createdAt: string;
};

type HabitsState = {
  habits: Habit[];
  add: (name: string) => Habit | null;
  remove: (id: string) => () => void;
  toggleDate: (id: string, date: string) => void;
  getHabit: (id: string) => Habit | undefined;
};

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const STORE_KEY = "habits-app";

export const useHabits = create<HabitsState>()(
  persist(
    (set, get) => ({
      habits: [],
      add: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        // Vérifier unicité (insensible à la casse et aux espaces)
        const exists = get().habits.some(
          (h) => h.name.toLowerCase().trim() === trimmed.toLowerCase()
        );
        if (exists) return null;
        const habit: Habit = {
          id: newId(),
          name: trimmed,
          checkedDates: [],
          createdAt: today(),
        };
        set({ habits: [...get().habits, habit] });
        return habit;
      },
      remove: (id: string) => {
        const before = get().habits;
        const habit = before.find((h) => h.id === id);
        if (!habit) return () => {};
        set({ habits: before.filter((h) => h.id !== id) });
        return () => set({ habits: before });
      },
      toggleDate: (id: string, date: string) => {
        set({
          habits: get().habits.map((h) => {
            if (h.id !== id) return h;
            const has = h.checkedDates.includes(date);
            return {
              ...h,
              checkedDates: has
                ? h.checkedDates.filter((d) => d !== date)
                : [...h.checkedDates, date],
            };
          }),
        });
      },
      getHabit: (id: string) => get().habits.find((h) => h.id === id),
    }),
    { name: STORE_KEY },
  ),
);

// --- Logique métier pure (testable) ---

/** Retourne les 7 derniers jours incluant aujourd'hui, du plus ancien au plus récent */
export function getLast7Days(refDate: string = today()): string[] {
  const [year, month, day] = refDate.split("-").map(Number);
  const base = new Date(year, month - 1, day);
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${dayStr}`);
  }
  return days;
}

/** Label court pour un jour : "lun. 26" */
export function shortDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  // weekday already includes the dot in French (e.g., "lun.", "mar.")
  return `${weekday} ${day}`;
}

/** Calcule la série en cours : jours cochés consécutifs jusqu'à aujourd'hui (ou jusqu'à hier si aujourd'hui non coché) */
export function currentStreak(checkedDates: string[], refDate: string = today()): number {
  const checked = new Set(checkedDates);
  const days = getLast7Days(refDate);
  let streak = 0;
  // On commence par aujourd'hui (dernier élément) et on remonte
  // Si aujourd'hui n'est pas coché, on commence par hier (avant-dernier élément)
  const startIndex = checked.has(days[days.length - 1]) ? days.length - 1 : days.length - 2;
  for (let i = startIndex; i >= 0; i--) {
    if (checked.has(days[i])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Calcule la meilleure série (max jours cochés consécutifs dans l'historique) */
export function bestStreak(checkedDates: string[]): number {
  if (checkedDates.length === 0) return 0;
  const checked = new Set(checkedDates);
  // On regarde sur une fenêtre glissante de 365 jours pour la meilleure série
  // Mais pour l'app, on peut calculer sur tout l'historique
  const sorted = [...checkedDates].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

/** Taux de réussite sur les 7 derniers jours (pourcentage arrondi à l'unité) */
export function successRate(checkedDates: string[], refDate: string = today()): number {
  const days = getLast7Days(refDate);
  const checked = new Set(checkedDates);
  let count = 0;
  for (const d of days) {
    if (checked.has(d)) count++;
  }
  return Math.round((count / 7) * 100);
}

/** Vérifie si une date est cochée */
export function isChecked(checkedDates: string[], date: string): boolean {
  return checkedDates.includes(date);
}