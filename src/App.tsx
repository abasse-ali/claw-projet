// L'appli de partage de dépenses de voyage

import { Users, Receipt, CreditCard, ArrowLeftRight, Plus, Trash2, X, UserPlus, UserMinus, Settings as SettingsIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  Chips,
  ConfirmModal,
  Empty,
  Hero,
  IconButton,
  List,
  Row,
  Screen,
  Settings,
  Setting,
  Tile,
  Tiles,
  TextField,
  money,
  openEntrySheet,
  toast,
} from "./kit";
import { useTripStore, computeBalances, computeSettlements, type Participant, type Expense, type Settlement } from "./trip-store";

// Onglets de l'appli
const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: CreditCard },
  { id: "remboursements", label: "Remb.", icon: ArrowLeftRight },
];

export default function App() {
  const participants = useTripStore((state) => state.participants);
  const expenses = useTripStore((state) => state.expenses);
  const addParticipant = useTripStore((state) => state.addParticipant);
  const updateParticipant = useTripStore((state) => state.updateParticipant);
  const removeParticipant = useTripStore((state) => state.removeParticipant);
  const addExpense = useTripStore((state) => state.addExpense);
  const updateExpense = useTripStore((state) => state.updateExpense);
  const removeExpense = useTripStore((state) => state.removeExpense);
  const clearAll = useTripStore((state) => state.clearAll);

  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(participants, balances), [participants, balances]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<string | null>(null);
  const [confirmRemoveExpense, setConfirmRemoveExpense] = useState<string | null>(null);

  // --- Participants Screen ---
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantError, setParticipantError] = useState("");
  const participantInputRef = useRef<HTMLInputElement>(null);

  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) {
      setParticipantError("Entrez un prénom");
      participantInputRef.current?.focus();
      return;
    }
    const result = addParticipant(name);
    if (!result) {
      setParticipantError("Ce prénom existe déjà");
      participantInputRef.current?.focus();
      return;
    }
    setNewParticipantName("");
    setParticipantError("");
    toast(`${name} ajouté`);
    participantInputRef.current?.focus();
  };

  const focusParticipantInput = () => {
    participantInputRef.current?.focus();
  };

  // L'action du bouton + sur l'écran participants : ajoute le participant si le champ est rempli,
  // sinon focus le champ
  const onAddParticipant = () => {
    if (newParticipantName.trim()) {
      handleAddParticipant();
    } else {
      focusParticipantInput();
    }
  };

  // L'action du bouton + sur l'écran dépenses : réinitialise le formulaire
  const onAddExpense = () => {
    resetExpenseForm();
  };

  const handleRemoveParticipant = (id: string) => {
    const success = removeParticipant(id);
    if (!success) {
      toast("Impossible : ce participant a des dépenses");
    } else {
      toast("Participant supprimé");
    }
    setConfirmRemoveParticipant(null);
  };

  // --- Expenses Screen ---
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState<string>("");
  const [expenseForWhom, setExpenseForWhom] = useState<string[]>([]);
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [expenseError, setExpenseError] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Réinitialiser le formulaire de dépense
  const resetExpenseForm = () => {
    setExpenseLabel("");
    setExpenseAmount("");
    setExpensePaidBy(participants[0]?.id || "");
    setExpenseForWhom([]);
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseError("");
    setEditingExpenseId(null);
  };

  const handleAddExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseAmount(expenseAmount);
    if (!amount || amount <= 0) {
      setExpenseError("Entrez un montant valide");
      return;
    }
    if (!expensePaidBy) {
      setExpenseError("Choisissez qui a payé");
      return;
    }
    const concerned = expenseForWhom.length > 0 ? expenseForWhom : participants.map(p => p.id);
    if (concerned.length === 0) {
      setExpenseError("Au moins un participant requis");
      return;
    }

    const expense = {
      label: expenseLabel.trim() || "Sans nom",
      amount: Math.round(amount * 100), // convertir en centimes
      paidBy: expensePaidBy,
      forWhom: concerned,
      date: expenseDate,
    };

    if (editingExpenseId) {
      updateExpense(editingExpenseId, expense);
      toast("Dépense modifiée");
    } else {
      addExpense(expense);
      toast("Dépense ajoutée");
    }
    resetExpenseForm();
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseLabel(expense.label);
    setExpenseAmount((expense.amount / 100).toFixed(2).replace(".", ","));
    setExpensePaidBy(expense.paidBy);
    setExpenseForWhom(expense.forWhom.length > 0 && expense.forWhom.length < participants.length
      ? expense.forWhom
      : []);
    setExpenseDate(expense.date);
    setEditingExpenseId(expense.id);
    setExpenseError("");
  };

  const handleRemoveExpense = (id: string) => {
    removeExpense(id);
    toast("Dépense supprimée");
    setConfirmRemoveExpense(null);
  };

  // Helpers pour l'affichage
  const getParticipantName = (id: string) => participants.find(p => p.id === id)?.name || "?";
  const formatCents = (cents: number) => money(cents / 100);
  const parseAmount = (input: string): number => {
    const text = String(input ?? "").replace(/€|eur(os?)?/gi, "");
    const digits = text.replace(/[^\d,.+-]/g, "");
    const last = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
    const decimals = last >= 0 && /^\d{1,2}$/.test(digits.slice(last + 1));
    const whole = (decimals ? digits.slice(0, last) : digits).replace(/[,.]/g, "");
    const value = Number(decimals ? `${whole}.${digits.slice(last + 1)}` : whole);
    return digits && Number.isFinite(value) ? value : NaN;
  };

  return (
    <>
      <AppShell
        bar={
          <header className="app-bar">
            <h1 className="app-bar__title">Voyage</h1>
            <span className="app-bar__spacer" />
            <IconButton icon={SettingsIcon} label="Réinitialiser" onClick={() => setConfirmClear(true)} />
          </header>
        }
        tabs={TABS}
        onAdd={() => {
          const activeTab = window.location.hash.slice(1) || "participants";
          if (activeTab === "depenses") {
            onAddExpense();
          } else if (activeTab === "participants") {
            onAddParticipant();
          }
        }}
        addLabel="Ajouter"
      >
        {/* ÉCRAN PARTICIPANTS */}
        <Screen id="participants" title="Participants" onAdd={onAddParticipant}>
          <Card title="Ajouter un participant" level={3}>
            <div className="field-row">
              <TextField
                label="Prénom"
                value={newParticipantName}
                onChange={(v) => { setNewParticipantName(v); setParticipantError(""); }}
                placeholder="Ex: Alice"
                error={participantError}
              />
              <Button icon={UserPlus} onClick={handleAddParticipant} disabled={!newParticipantName.trim()}>
                Ajouter
              </Button>
            </div>
          </Card>

          <Card title={`Participants (${participants.length})`} level={3}>
            {participants.length === 0 ? (
              <Empty icon={Users} text="Aucun participant pour l'instant" />
            ) : (
              <List label="Liste des participants">
                {participants.map((p) => (
                  <Row
                    key={p.id}
                    icon={Users}
                    tone="accent"
                    title={p.name}
                    end={
                      <Button
                        small
                        variant="danger"
                        icon={UserMinus}
                        onClick={() => setConfirmRemoveParticipant(p.id)}
                        disabled={expenses.some(e => e.paidBy === p.id || e.forWhom.includes(p.id))}
                      >
                        Supprimer
                      </Button>
                    }
                  />
                ))}
              </List>
            )}
          </Card>
        </Screen>

        {/* ÉCRAN DÉPENSES */}
        <Screen id="depenses" title="Dépenses" onAdd={onAddExpense}>
          <Card title={editingExpenseId ? "Modifier la dépense" : "Ajouter une dépense"} level={3}>
            <form onSubmit={handleAddExpense} noValidate>
              <div className="field-row">
                <TextField
                  label="Libellé"
                  value={expenseLabel}
                  onChange={setExpenseLabel}
                  placeholder="Ex: Restaurant, Taxi..."
                />
              </div>
              <div className="field-row">
                <TextField
                  label="Montant (€)"
                  value={expenseAmount}
                  onChange={(v) => { setExpenseAmount(v); setExpenseError(""); }}
                  type="number"
                  placeholder="12,50"
                  error={expenseError}
                />
              </div>
              <div className="field-row">
                <TextField label="Payé par" value="" onChange={() => {}} placeholder=" " />
              </div>
              <div className="field-row" style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Payé par</span>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => { setExpensePaidBy(e.target.value); setExpenseError(""); }}
                    style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                  >
                    <option value=""> - Choisir - </option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label>Pour qui</label>
                <Chips
                  options={participants.map((p) => ({ value: p.id, label: p.name }))}
                  value={expenseForWhom}
                  onChange={setExpenseForWhom}
                  label="Participants concernés"
                />
                <p className="field__help">Vide = tout le monde</p>
              </div>
              <div className="field-row">
                <TextField
                  label="Date"
                  type="date"
                  value={expenseDate}
                  onChange={setExpenseDate}
                />
              </div>
              <ButtonRow>
                <Button type="submit" variant="primary" icon={editingExpenseId ? undefined : Plus}>
                  {editingExpenseId ? "Enregistrer" : "Ajouter"}
                </Button>
                {editingExpenseId && (
                  <Button type="button" variant="plain" onClick={resetExpenseForm}>Annuler</Button>
                )}
              </ButtonRow>
            </form>
          </Card>

          <Card title={`Dépenses (${expenses.length})`} level={3}>
            {expenses.length === 0 ? (
              <Empty icon={Receipt} text="Aucune dépense pour l'instant" action={{ label: "Ajouter une dépense", onClick: resetExpenseForm }} />
            ) : (
              <List label="Liste des dépenses">
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => (
                    <Row
                      key={expense.id}
                      icon={Receipt}
                      tone="out"
                      title={expense.label}
                      sub={[
                        `Payé par ${getParticipantName(expense.paidBy)}`,
                        expense.forWhom.length > 0 && expense.forWhom.length < participants.length
                          ? `Pour: ${expense.forWhom.map(getParticipantName).join(", ")}`
                          : "Pour tout le monde",
                        expense.date,
                      ].filter(Boolean).join(" · ")}
                      amount={-expense.amount / 100}
                      end={
                        <Button
                          small
                          variant="plain"
                          icon={Trash2}
                          onClick={() => setConfirmRemoveExpense(expense.id)}
                        >
                          Supprimer
                        </Button>
                      }
                    />
                  ))}
              </List>
            )}
          </Card>
        </Screen>

        {/* ÉCRAN SOLDES */}
        <Screen id="soldes" title="Soldes">
          <Hero
            label="Total des dépenses"
            amount={totalExpenses / 100}
            sub={`Réparties entre ${participants.length} participant${participants.length > 1 ? "s" : ""}`}
          />

          <Card title="Solde de chacun" level={3}>
            {participants.length === 0 ? (
              <Empty icon={Users} text="Ajoutez des participants d'abord" />
            ) : (
              <List label="Soldes">
                {participants.map((p) => {
                  const balance = balances.get(p.id) || 0;
                  return (
                    <Row
                      key={p.id}
                      icon={balance >= 0 ? CreditCard : CreditCard}
                      tone={balance > 0 ? "in" : balance < 0 ? "out" : "accent"}
                      title={p.name}
                      sub={balance > 0 ? "À recevoir" : balance < 0 ? "À payer" : "Équilibré"}
                      amount={balance / 100}
                    />
                  );
                })}
              </List>
            )}
          </Card>

          <Card title="Détail par dépense" level={3}>
            {expenses.length === 0 ? (
              <Empty icon={Receipt} text="Aucune dépense" />
            ) : (
              <List label="Détail">
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => {
                    const concerned = expense.forWhom.length > 0 ? expense.forWhom : participants.map(p => p.id);
                    const shareCount = concerned.length;
                    const share = Math.floor(expense.amount / shareCount);
                    const remainder = expense.amount % shareCount;
                    return (
                      <Row
                        key={expense.id}
                        icon={Receipt}
                        tone="accent"
                        title={expense.label}
                        sub={
                          <>
                            {concerned.map((pid, i) => (
                              <span key={pid} style={{ display: "block", fontSize: "12px" }}>
                                {getParticipantName(pid)}: {formatCents(share + (i < remainder ? 1 : 0))}
                              </span>
                            ))}
                          </>
                        }
                        amount={-expense.amount / 100}
                      />
                    );
                  })}
              </List>
            )}
          </Card>
        </Screen>

        {/* ÉCRAN REMBOURSEMENTS */}
        <Screen id="remboursements" title="Remboursements">
          <Hero
            label="Remboursements à faire"
            value={settlements.length === 0 ? "Tout est équilibré" : `${settlements.length} virement${settlements.length > 1 ? "s" : ""}`}
            sub="Le minimum de virements pour tout équilibrer"
          />

          <Card title="Qui doit combien à qui" level={3}>
            {settlements.length === 0 ? (
              <Empty
                icon={ArrowLeftRight}
                text="Tous les soldes sont à zéro, tout est équilibré !"
              />
            ) : (
              <List label="Remboursements">
                {settlements.map((s, i) => (
                  <Row
                    key={i}
                    icon={ArrowLeftRight}
                    tone="out"
                    title={`${getParticipantName(s.from)} → ${getParticipantName(s.to)}`}
                    amount={s.amount / 100}
                    end={
                      <Button
                        small
                        variant="plain"
                        icon={Trash2}
                        onClick={() => {}}
                        disabled
                      >
                        Fait
                      </Button>
                    }
                  />
                ))}
              </List>
            )}
          </Card>

          <Card title="Résumé des soldes" level={3}>
            {participants.length === 0 ? (
              <Empty icon={Users} text="Ajoutez des participants" />
            ) : (
              <List label="Soldes finaux">
                {participants.map((p) => {
                  const balance = balances.get(p.id) || 0;
                  return (
                    <Row
                      key={p.id}
                      icon={balance >= 0 ? CreditCard : CreditCard}
                      tone={balance > 0 ? "in" : balance < 0 ? "out" : "accent"}
                      title={p.name}
                      sub={balance > 0 ? "Doit recevoir" : balance < 0 ? "Doit payer" : "Équilibré"}
                      amount={balance / 100}
                    />
                  );
                })}
              </List>
            )}
          </Card>
        </Screen>
      </AppShell>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Tous les participants et dépenses seront effacés définitivement."
        confirmLabel="Tout effacer"
        onConfirm={() => {
          clearAll();
          toast("Tout a été effacé");
        }}
      />

      <ConfirmModal
        open={!!confirmRemoveParticipant}
        onClose={() => setConfirmRemoveParticipant(null)}
        title="Supprimer ce participant ?"
        text="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => confirmRemoveParticipant && handleRemoveParticipant(confirmRemoveParticipant)}
      />

      <ConfirmModal
        open={!!confirmRemoveExpense}
        onClose={() => setConfirmRemoveExpense(null)}
        title="Supprimer cette dépense ?"
        text="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => confirmRemoveExpense && handleRemoveExpense(confirmRemoveExpense)}
      />
    </>
  );
}