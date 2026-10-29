// Appli de partage de dépenses entre amis pour un voyage.

import {
  Plus,
  Trash2,
  Users,
  Receipt,
  CreditCard,
  ArrowRight,
  Calculator,
  UserPlus,
  UserMinus,
  X,
  Edit,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Hero,
  IconButton,
  List,
  Row,
  Screen,
  Settings,
  Sheet,
  TextField,
  Tile,
  Tiles,
  toast,
  openEntrySheet,
  useTripStore,
  computeBalances,
  computeSettlements,
  formatCents,
  parseCents,
  type Participant,
  type Expense,
} from "./kit";

const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: CreditCard },
  { id: "remboursements", label: "Remboursements", icon: Calculator },
];

export default function App() {
  const participants = useTripStore((s) => s.participants);
  const expenses = useTripStore((s) => s.expenses);
  const addParticipant = useTripStore((s) => s.addParticipant);
  const removeParticipant = useTripStore((s) => s.removeParticipant);
  const updateParticipant = useTripStore((s) => s.updateParticipant);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const clear = useTripStore((s) => s.clear);

  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(balances), [balances]);

  // États pour les modales/feuilles
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantError, setParticipantError] = useState("");

  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState<string>("");
  const [expenseForWhom, setExpenseForWhom] = useState<string[]>([]);
  const [expenseError, setExpenseError] = useState("");

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemoveExpense, setConfirmRemoveExpense] = useState<Expense | null>(null);

  // Réinitialiser les formulaires quand ils s'ouvrent/ferment
  useEffect(() => {
    if (addParticipantOpen) {
      setNewParticipantName("");
      setParticipantError("");
    }
  }, [addParticipantOpen]);

  useEffect(() => {
    if (expenseSheetOpen) {
      if (editingExpense) {
        setExpenseLabel(editingExpense.label);
        setExpenseAmount(formatCents(editingExpense.amount).replace(" €", ""));
        setExpensePaidBy(editingExpense.paidBy);
        setExpenseForWhom(editingExpense.forWhom);
      } else {
        setExpenseLabel("");
        setExpenseAmount("");
        setExpensePaidBy(participants[0]?.id || "");
        setExpenseForWhom([]);
      }
      setExpenseError("");
    }
  }, [expenseSheetOpen, editingExpense, participants]);

  const handleAddParticipant = () => {
    const trimmed = newParticipantName.trim();
    if (!trimmed) {
      setParticipantError("Le prénom est requis");
      return;
    }
    const result = addParticipant(trimmed);
    if (!result) {
      setParticipantError("Ce prénom existe déjà");
      return;
    }
    setAddParticipantOpen(false);
    toast(`${trimmed} ajouté aux participants`);
  };

  const handleRemoveParticipant = (id: string) => {
    const participant = participants.find((p) => p.id === id);
    if (!participant) return;
    const success = removeParticipant(id);
    if (success) {
      toast(`${participant.name} retiré`);
    } else {
      toast("Impossible : ce participant a des dépenses", { tone: "error" });
    }
  };

  const openAddExpense = (expense?: Expense) => {
    setEditingExpense(expense || null);
    setExpenseSheetOpen(true);
  };

  const handleSubmitExpense = () => {
    const amount = parseCents(expenseAmount);
    if (amount <= 0) {
      setExpenseError("Montant invalide");
      return;
    }
    if (!expensePaidBy) {
      setExpenseError("Choisissez qui a payé");
      return;
    }
    const label = expenseLabel.trim() || "Sans nom";
    const forWhom = expenseForWhom.length > 0 ? expenseForWhom : participants.map((p) => p.id);

    if (editingExpense) {
      updateExpense(editingExpense.id, { label, amount, paidBy: expensePaidBy, forWhom });
      toast("Dépense modifiée");
    } else {
      addExpense({ label, amount, paidBy: expensePaidBy, forWhom });
      toast(`${label} : ${formatCents(amount)} ajoutée`);
    }
    setExpenseSheetOpen(false);
  };

  const handleRemoveExpense = (expense: Expense) => {
    setConfirmRemoveExpense(expense);
  };

  const confirmRemoveExpenseAction = () => {
    if (confirmRemoveExpense) {
      removeExpense(confirmRemoveExpense.id);
      toast(`« ${confirmRemoveExpense.label} » supprimée`);
      setConfirmRemoveExpense(null);
    }
  };

  const handleClearAll = () => {
    const undo = clear();
    toast("Tout effacé", { action: { label: "Annuler", run: undo } });
  };

  const getParticipantName = (id: string) => participants.find((p) => p.id === id)?.name || id;

  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  return (
    <>
      <AppShell
        bar={
          <div className="app-bar">
            <h1 className="app-bar__title">Voyage entre amis</h1>
          </div>
        }
        tabs={TABS}
        onAdd={() => {
          if (participants.length === 0) {
            setAddParticipantOpen(true);
          } else {
            openAddExpense();
          }
        }}
        addLabel={participants.length === 0 ? "Ajouter un participant" : "Ajouter une dépense"}
      >
        {/* ONGLET PARTICIPANTS */}
        <Screen id="participants" label="Participants">
          {participants.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Users className="empty-state__icon" size={48} />
                <h3>Aucun participant</h3>
                <p>Ajoutez les prénoms de vos amis pour commencer</p>
                <Button icon={UserPlus} block onClick={() => setAddParticipantOpen(true)}>
                  Ajouter le premier participant
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card title="Participants" meta={`${participants.length} personne${participants.length > 1 ? "s" : ""}`}>
                <List>
                  {participants.map((p) => (
                    <Row
                      key={p.id}
                      icon={UserPlus}
                      tone="accent"
                      title={p.name}
                      sub={`${expenses.filter((e) => e.paidBy === p.id || e.forWhom.includes(p.id)).length} dépense${expenses.filter((e) => e.paidBy === p.id || e.forWhom.includes(p.id)).length > 1 ? "s" : ""}`}
                      action={{
                        icon: X,
                        label: `Retirer ${p.name}`,
                        onClick: () => handleRemoveParticipant(p.id),
                      }}
                    />
                  ))}
                </List>
              </Card>
              <Button icon={UserPlus} block onClick={() => setAddParticipantOpen(true)}>
                Ajouter un participant
              </Button>
            </>
          )}
        </Screen>

        {/* ONGLET DÉPENSES */}
        <Screen id="depenses" label="Dépenses">
          {participants.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Users className="empty-state__icon" size={48} />
                <h3>Ajoutez d'abord des participants</h3>
                <p>Allez dans l'onglet Participants</p>
              </div>
            </Card>
          ) : expenses.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Receipt className="empty-state__icon" size={48} />
                <h3>Aucune dépense</h3>
                <p>Ajoutez la première dépense du voyage</p>
                <Button icon={Plus} block onClick={() => openAddExpense()}>
                  Ajouter une dépense
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card title="Dépenses" meta={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""} · Total ${formatCents(totalExpenses)}`}>
                <List>
                  {expenses
                    .slice()
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .map((expense) => (
                      <Row
                        key={expense.id}
                        icon={CreditCard}
                        tone="out"
                        title={expense.label}
                        badge={getParticipantName(expense.paidBy)}
                        sub={
                          expense.forWhom.length === 0 || expense.forWhom.length === participants.length
                            ? "Pour tout le monde"
                            : `Pour ${expense.forWhom.map(getParticipantName).join(", ")}`
                        }
                        amount={-expense.amount}
                        endNote={`${expense.forWhom.length === 0 || expense.forWhom.length === participants.length ? participants.length : expense.forWhom.length} pers.`}
                        action={{
                          icon: Edit,
                          label: `Modifier « ${expense.label} »`,
                          onClick: () => openAddExpense(expense),
                        }}
                      />
                    ))}
                </List>
              </Card>
              <Button icon={Plus} block onClick={() => openAddExpense()}>
                Ajouter une dépense
              </Button>
            </>
          )}
        </Screen>

        {/* ONGLET SOLDES */}
        <Screen id="soldes" label="Soldes">
          {participants.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Users className="empty-state__icon" size={48} />
                <h3>Aucun participant</h3>
                <p>Ajoutez des participants pour voir les soldes</p>
              </div>
            </Card>
          ) : (
            <Card title="Solde de chacun" meta="Payé − part = solde (positif = à recevoir)">
              <List>
                {participants.map((p) => {
                  const balance = balances.get(p.id) || 0;
                  return (
                    <Row
                      key={p.id}
                      icon={CreditCard}
                      tone={balance > 0 ? "in" : balance < 0 ? "out" : "accent"}
                      title={p.name}
                      sub={`Payé ${formatCents(expenses.filter((e) => e.paidBy === p.id).reduce((s, e) => s + e.amount, 0))} · Part ${formatCents(expenses.reduce((sum, e) => {
                        const ben = e.forWhom.length > 0 ? e.forWhom : participants.map((p2) => p2.id);
                        if (ben.includes(p.id)) {
                          const share = Math.floor(e.amount / ben.length);
                          const rem = e.amount % ben.length;
                          const idx = ben.indexOf(p.id);
                          return sum + share + (idx < rem ? 1 : 0);
                        }
                        return sum;
                      }, 0))}`}
                      amount={balance}
                    />
                  );
                })}
              </List>
              <div className="balance-summary">
                <strong>Somme des soldes : {formatCents(Array.from(balances.values()).reduce((a, b) => a + b, 0))}</strong>
              </div>
            </Card>
          )}
        </Screen>

        {/* ONGLET REMBOURSEMENTS */}
        <Screen id="remboursements" label="Remboursements">
          {participants.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Users className="empty-state__icon" size={48} />
                <h3>Aucun participant</h3>
                <p>Ajoutez des participants et des dépenses</p>
              </div>
            </Card>
          ) : settlements.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Calculator className="empty-state__icon" size={48} />
                <h3>Tout est équilibré</h3>
                <p>Aucun remboursement n'est nécessaire</p>
              </div>
            </Card>
          ) : (
            <Card title="Qui doit combien à qui" meta={`${settlements.length} virement${settlements.length > 1 ? "s" : ""} pour tout équilibrer`}>
              <List>
                {settlements.map((s, i) => (
                  <Row
                    key={`${s.from}-${s.to}-${i}`}
                    icon={ArrowRight}
                    tone="warn"
                    title={`${getParticipantName(s.from)} → ${getParticipantName(s.to)}`}
                    amount={s.amount}
                    endNote={formatCents(s.amount)}
                  />
                ))}
              </List>
              <p className="settlement-note">
                Les montants sont calculés pour minimiser le nombre de virements.
                Chaque personne paye ou reçoit exactement ce qu'elle doit.
              </p>
            </Card>
          )}
        </Screen>
      </AppShell>

      {/* MODALE AJOUT PARTICIPANT */}
      <Sheet open={addParticipantOpen} onClose={() => setAddParticipantOpen(false)} title="Ajouter un participant">
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleAddParticipant(); }}>
          <TextField
            label="Prénom"
            value={newParticipantName}
            onChange={setNewParticipantName}
            placeholder="Ex: Alice"
            error={participantError}
            autoFocus
          />
          <div className="btn-row">
            <Button type="button" onClick={() => setAddParticipantOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" block>Ajouter</Button>
          </div>
        </form>
      </Sheet>

      {/* FEUILLE AJOUT/MODIFICATION DÉPENSE */}
      <Sheet open={expenseSheetOpen} onClose={() => setExpenseSheetOpen(false)} title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}>
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleSubmitExpense(); }}>
          <TextField
            label="Libellé"
            value={expenseLabel}
            onChange={setExpenseLabel}
            placeholder="Ex: Restaurant, Hôtel, Essence..."
            error={expenseError}
            autoFocus
          />
          <div className="field">
            <label>Montant</label>
            <div className="money">
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value.replace(/[^0-9,.]/g, "").replace(",", "."))}
              />
              <span aria-hidden="true">€</span>
            </div>
          </div>
          <div className="field">
            <label>Payé par</label>
            <select
              value={expensePaidBy}
              onChange={(e) => setExpensePaidBy(e.target.value)}
              className="field__select"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <fieldset className="field">
            <legend>Partagé pour</legend>
            <div className="chips chips--checkbox">
              {participants.map((p) => (
                <label key={p.id} className="chip-checkbox">
                  <input
                    type="checkbox"
                    checked={expenseForWhom.includes(p.id)}
                    onChange={(e) => setExpenseForWhom(e.target.checked ? [...expenseForWhom, p.id] : expenseForWhom.filter((id) => id !== p.id))}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <p className="field__help">
              {expenseForWhom.length === 0 || expenseForWhom.length === participants.length
                ? "Tout le monde (par défaut)"
                : `${expenseForWhom.length} personne${expenseForWhom.length > 1 ? "s" : ""} sélectionnée${expenseForWhom.length > 1 ? "s" : ""}`}
            </p>
          </fieldset>
          <div className="btn-row">
            <Button type="button" onClick={() => setExpenseSheetOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" block>{editingExpense ? "Enregistrer" : "Ajouter"}</Button>
          </div>
        </form>
      </Sheet>

      {/* CONFIRMATION SUPPRESSION DÉPENSE */}
      <ConfirmModal
        open={!!confirmRemoveExpense}
        onClose={() => setConfirmRemoveExpense(null)}
        title="Supprimer cette dépense ?"
        text={`« ${confirmRemoveExpense?.label} » (${confirmRemoveExpense ? formatCents(confirmRemoveExpense.amount) : ""}) sera effacée.`}
        confirmLabel="Supprimer"
        cancelLabel="Garder"
        onConfirm={confirmRemoveExpenseAction}
      />

      {/* CONFIRMATION TOUT EFFACER */}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Tous les participants et toutes les dépenses seront effacés de ce téléphone."
        confirmLabel="Tout effacer"
        cancelLabel="Annuler"
        onConfirm={handleClearAll}
      />
    </>
  );
}