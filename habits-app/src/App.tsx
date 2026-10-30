// L'appli de suivi d'habitudes pour téléphone

import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import {
  AppShell,
  AppBar,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Hero,
  IconButton,
  Screen,
  Settings,
  Setting,
  TextField,
  Tile,
  Tiles,
  toast,
  openEntrySheet,
} from "./kit";
import { useHabits, getLast7Days, shortDayLabel, currentStreak, bestStreak, successRate, isChecked, type Habit } from "./stores/habits";

const TABS = [{ id: "habits", label: "Habitudes", icon: Plus }];

export default function App() {
  const habits = useHabits((state) => state.habits);
  const addHabit = useHabits((state) => state.add);
  const removeHabit = useHabits((state) => state.remove);
  const toggleDate = useHabits((state) => state.toggleDate);
  const [showAdd, setShowAdd] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [refDate, setRefDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Mettre à jour refDate à minuit
  useEffect(() => {
    const updateRefDate = () => {
      const newDate = new Date().toISOString().split("T")[0];
      setRefDate(newDate);
    };
    updateRefDate();
    const now = new Date();
    const msUntilMidnight = 24 * 60 * 60 * 1000 - (now.getHours() * 60 * 60 * 1000 + now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds());
    const timeout = setTimeout(() => {
      updateRefDate();
      // Puis toutes les 24h
      const interval = setInterval(updateRefDate, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msUntilMidnight);
    return () => clearTimeout(timeout);
  }, []);

  const last7Days = useMemo(() => getLast7Days(refDate), [refDate]);

  const handleAddHabit = () => {
    const habit = addHabit(newHabitName);
    if (habit) {
      setNewHabitName("");
      setShowAdd(false);
      toast("Habitude ajoutée");
    } else if (newHabitName.trim()) {
      toast("Ce nom existe déjà", { tone: "error" });
    }
  };

  const handleRemoveHabit = (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmRemove = () => {
    if (!confirmDelete) return;
    const undo = removeHabit(confirmDelete.id);
    toast(`${confirmDelete.name} supprimée`, { action: { label: "Annuler", run: undo } });
    setConfirmDelete(null);
  };

  return (
    <>
      <AppShell
        bar={
          <AppBar
            title="Habitudes"
            start={<IconButton icon={Plus} label="Ajouter" onClick={() => setShowAdd(true)} />}
          />
        }
        tabs={TABS}
      >
        <Screen id="habits" label="Habitudes">
          {habits.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-muted mb-4">Aucune habitude pour l'instant</p>
              <Button icon={Plus} onClick={() => setShowAdd(true)}>
                Ajouter la première
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  days={last7Days}
                  refDate={refDate}
                  onToggle={toggleDate}
                  onRemove={handleRemoveHabit}
                />
              ))}
            </div>
          )}
        </Screen>
      </AppShell>

      {/* Sheet pour ajouter une habitude - version native du kit */}
      <NativeSheet open={showAdd} onClose={() => setShowAdd(false)} title="Nouvelle habitude">
        <div className="space-y-4">
          <TextField
            label="Nom de l'habitude"
            value={newHabitName}
            onChange={setNewHabitName}
            placeholder="Ex: Boire 2L d'eau"
          />
          <ButtonRow>
            <Button variant="plain" onClick={() => setShowAdd(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddHabit}>Créer</Button>
          </ButtonRow>
        </div>
      </NativeSheet>

      {/* Modal de confirmation suppression */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Supprimer cette habitude ?"
        text={`L'habitude « ${confirmDelete?.name} » et son historique seront supprimées.`}
        confirmLabel="Supprimer"
        onConfirm={confirmRemove}
      />
    </>
  );
}

// Composant pour une carte d'habitude
function HabitCard({
  habit,
  days,
  refDate,
  onToggle,
  onRemove,
}: {
  habit: Habit;
  days: string[];
  refDate: string;
  onToggle: (id: string, date: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const streak = currentStreak(habit.checkedDates, refDate);
  const best = bestStreak(habit.checkedDates);
  const rate = successRate(habit.checkedDates, refDate);
  const today = days[days.length - 1];
  const isTodayChecked = isChecked(habit.checkedDates, today);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-ink truncate">{habit.name}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-sm">
            <span className="flex items-center gap-1 text-accent">
              <span className="relative">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <span className="font-mono tabular-nums">{streak}</span>
              <span className="text-muted">jour{streak > 1 ? "s" : ""}</span>
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="font-mono tabular-nums">{best}</span>
              <span>meilleur</span>
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="font-mono tabular-nums">{rate}%</span>
              <span>réussite</span>
            </span>
          </div>
        </div>
        <Button small variant="plain" icon={Trash2} onClick={() => onRemove(habit.id, habit.name)} aria-label="Supprimer">Supprimer</Button>
      </div>

      {/* Grille des 7 jours */}
      <div className="grid grid-cols-7 gap-2" role="list" aria-label="7 derniers jours">
        {days.map((date, index) => {
          const checked = isChecked(habit.checkedDates, date);
          const isToday = date === today;
          const isFuture = index === days.length - 1 && !isTodayChecked && date > refDate;
          
          return (
            <button
              key={date}
              onClick={() => !isFuture && onToggle(habit.id, date)}
              disabled={isFuture}
              className={`
                aspect-square rounded-xl border-2 transition-all duration-150
                flex flex-col items-center justify-center min-h-[56px]
                ${checked
                  ? "bg-accent border-accent text-white"
                  : "bg-surface border-line text-ink"
                }
                ${isToday && !checked ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}
                ${isFuture ? "opacity-40" : "active:scale-[0.95]"}
                disabled:cursor-not-allowed
              `}
              role="listitem"
              aria-label={`${shortDayLabel(date)} : ${checked ? "fait" : "à faire"}`}
              aria-pressed={checked}
            >
              <span className="text-xs font-medium capitalize">{shortDayLabel(date).split(".")[0]}</span>
              <span className="text-lg font-mono tabular-nums">{shortDayLabel(date).split(".")[1].trim()}</span>
              {checked && (
                <svg className="w-5 h-5 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Sheet component (pas dans le kit, on le crée) - version native avec <dialog> pour éviter le problème de backdrop
function NativeSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  
  const handleClose = (event: React.MouseEvent) => {
    if (event.target === ref.current) {
      onClose();
    }
  };

  if (!open) return null;
  
  return (
    <dialog className="sheet" aria-labelledby={id} ref={ref} onClick={handleClose}>
      <div className="sheet__body">
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title" id={id}>{title}</h2>
          <IconButton icon={X} label="Fermer" onClick={onClose} />
        </div>
        {children}
      </div>
    </dialog>
  );
}

