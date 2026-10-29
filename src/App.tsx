// Application de partage de dépenses de voyage
// Ajouter participants, dépenses, voir soldes et remboursements

import {
  Users,
  Plus,
  Receipt,
  Trash2,
  Edit3,
  CreditCard,
  ArrowLeftRight,
  Calculator,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
} from "lucide-react";
import { Sheet } from "./kit/sheet";
import { useMemo, useState } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Empty,
  Hero,
  IconButton,
  List,
  Row,
  Screen,
  Settings,
  Setting,
  TextField,
  Tile,
  Tiles,
  toast,
  useScreen,
} from "./kit";
import { formatCents, parseCents, type Balance, type Transfer, type Participant, type Expense } from "./lib/trip";
import { useTripStore } from "./lib/store";

// Icônes pour les catégories de dépenses (utilisées pour le libellé par défaut)
const EXPENSE_ICONS = {
  "Repas": "🍽️",
  "Transport": "🚌",
  "Hébergement": "🏨",
  "Activité": "🎯",
  "Courses": "🛒",
  "Autre": "📦",
};

const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "remboursements", label: "Remboursements", icon: ArrowLeftRight },
];

export default function App() {
  const [screenId, setScreenId] = useScreen();
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<Expense | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const participants = useTripStore((state) => state.participants);
  const expenses = useTripStore((state) => state.expenses);
  const addParticipant = useTripStore((state) => state.addParticipant);
  const removeParticipant = useTripStore((state) => state.removeParticipant);
  const addExpense = useTripStore((state) => state.addExpense);
  const removeExpense = useTripStore((state) => state.removeExpense);
  const getBalances = useTripStore((state) => state.getBalances);
  const getTransfers = useTripStore((state) => state.getTransfers);

  const balances = useMemo(() => getBalances(), [getBalances, expenses, participants]);
  const transfers = useMemo(() => getTransfers(), [getTransfers, balances]);

  // Gestion ajout participant
  const handleAddParticipant = () => {
    const trimmed = newParticipantName.trim();
    if (!trimmed) {
      setParticipantError("Le prénom ne peut pas être vide");
      return;
    }
    // Vérifier doublon (insensible à la casse)
    const exists = participants.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setParticipantError("Ce prénom existe déjà");
      return;
    }
    addParticipant(trimmed);
    setNewParticipantName("");
    setParticipantError("");
    setShowAddParticipant(false);
    toast("Participant ajouté");
  };

  // Gestion ajout/modification dépense
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState<string>("");
  const [expenseSplitBetween, setExpenseSplitBetween] = useState<string[]>([]);
  const [expenseError, setExpenseError] = useState("");

  const openAddExpense = () => {
    if (participants.length === 0) {
      toast("Ajoutez d'abord des participants", { tone: "error" });
      return;
    }
    setEditingExpense(null);
    setExpenseLabel("");
    setExpenseAmount("");
    setExpensePaidBy(participants[0].id);
    setExpenseSplitBetween([]);
    setExpenseError("");
    setShowAddExpense(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseLabel(expense.label);
    setExpenseAmount(formatCents(expense.amount).replace(" €", ""));
    setExpensePaidBy(expense.paidBy);
    setExpenseSplitBetween([...expense.splitBetween]);
    setExpenseError("");
    setShowAddExpense(true);
  };

  const handleSaveExpense = () => {
    const amountCents = parseCents(expenseAmount);
    if (!expenseLabel.trim()) {
      setExpenseError("Le libellé est requis");
      return;
    }
    if (amountCents <= 0) {
      setExpenseError("Le montant doit être supérieur à 0");
      return;
    }
    if (!expensePaidBy) {
      setExpenseError("Sélectionnez qui a payé");
      return;
    }

    const splitBetween = expenseSplitBetween.length > 0 ? expenseSplitBetween : participants.map((p) => p.id);

    if (editingExpense) {
      // Supprimer l'ancienne et ajouter la nouvelle (simplification)
      removeExpense(editingExpense.id);
      addExpense(expenseLabel.trim(), amountCents, expensePaidBy, splitBetween);
      toast("Dépense modifiée");
    } else {
      addExpense(expenseLabel.trim(), amountCents, expensePaidBy, splitBetween);
      toast("Dépense ajoutée");
    }
    setShowAddExpense(false);
  };

  const handleRemoveExpense = (expense: Expense) => {
    setConfirmDeleteExpense(expense);
  };

  const confirmRemoveExpense = () => {
    if (confirmDeleteExpense) {
      removeExpense(confirmDeleteExpense.id);
      toast("Dépense supprimée", {
        action: { label: "Annuler", run: () => addExpense(confirmDeleteExpense.label, confirmDeleteExpense.amount, confirmDeleteExpense.paidBy, confirmDeleteExpense.splitBetween) },
      });
      setConfirmDeleteExpense(null);
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    const success = removeParticipant(participantId);
    if (success) {
      toast("Participant supprimé");
    } else {
      toast("Impossible : participant utilisé dans une dépense", { tone: "error" });
    }
  };

  const handleClearAll = () => {
    // On ne peut pas clear directement via le store, on recrée un état vide
    // Pour simplifier, on supprime tout
    useTripStore.setState({ participants: [], expenses: [] });
    toast("Tout effacé");
    setConfirmClearAll(false);
  };

  const getParticipantName = (id: string) => participants.find((p) => p.id === id)?.name || "?";
  const getParticipantInitial = (name: string) => name.charAt(0).toUpperCase();

  // Vérifier si un participant est dans splitBetween
  const isInSplit = (participantId: string) => expenseSplitBetween.includes(participantId);
  const toggleSplit = (participantId: string) => {
    setExpenseSplitBetween((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId]
    );
  };

  return (
    <>
      <AppShell
        bar={
          <>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Voyage entre amis</h1>
          </>
        }
        tabs={TABS}
        onAdd={screenId === "participants" ? () => setShowAddParticipant(true) : screenId === "depenses" ? openAddExpense : undefined}
        addLabel={screenId === "participants" ? "Ajouter un participant" : screenId === "depenses" ? "Ajouter une dépense" : undefined}
      >
        {/* ONGLET PARTICIPANTS */}
        <Screen id="participants" label="Participants">
          <Card title="Participants">
            {participants.length === 0 ? (
              <Empty
                icon={Users}
                text="Aucun participant pour l'instant"
                action={{ label: "Ajouter un participant", onClick: () => setShowAddParticipant(true) }}
              />
            ) : (
              <List>
                {participants.map((p) => (
                  <Row
                    key={p.id}
                    icon={Users}
                    tone="accent"
                    title={p.name}
                    sub={`${expenses.filter((e) => e.paidBy === p.id).length} dépense(s) payée(s)`}
                    action={{
                      icon: Trash2,
                      label: `Supprimer ${p.name}`,
                      onClick: () => handleRemoveParticipant(p.id),
                    }}
                  />
                ))}
              </List>
            )}
          </Card>

          {participants.length > 0 && (
            <Card title="Résumé">
              <Tiles>
                <Tile icon={Users} label="Participants" value={participants.length} />
                <Tile icon={Receipt} label="Dépenses" value={expenses.length} />
                <Tile icon={CreditCard} label="Total dépenses" value={formatCents(expenses.reduce((sum, e) => sum + e.amount, 0))} />
              </Tiles>
            </Card>
          )}
        </Screen>

        {/* ONGLET DÉPENSES */}
        <Screen id="depenses" label="Dépenses">
          <Card title="Dépenses">
            {expenses.length === 0 ? (
              <Empty
                icon={Receipt}
                text="Aucune dépense pour l'instant"
                action={{ label: "Ajouter une dépense", onClick: openAddExpense }}
              />
            ) : (
              <List>
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => (
                    <Row
                      key={expense.id}
                      icon={CreditCard}
                      tone="out"
                      title={expense.label}
                      sub={
                        <>
                          Payé par <b>{getParticipantName(expense.paidBy)}</b> · Partagé entre{" "}
                          {expense.splitBetween.map((id) => getParticipantName(id)).join(", ")}
                        </>
                      }
                      amount={-expense.amount}
                      action={{
                        icon: Edit3,
                        label: `Modifier « ${expense.label} »`,
                        onClick: () => openEditExpense(expense),
                      }}
                    />
                  ))}
              </List>
            )}
          </Card>

          {expenses.length > 0 && (
            <Card title="Total">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: 600 }}>
                <span>Total dépenses</span>
                <span>{formatCents(expenses.reduce((sum, e) => sum + e.amount, 0))}</span>
              </div>
            </Card>
          )}
        </Screen>

        {/* ONGLET SOLDES */}
        <Screen id="soldes" label="Soldes">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour voir les soldes"
              action={{ label: "Aller aux participants", onClick: () => setScreenId("participants") }}
            />
          ) : (
            <>
              <Card title="Solde de chacun">
                <List>
                  {balances.map((b) => (
                    <Row
                      key={b.participantId}
                      icon={CreditCard}
                      tone={b.balance >= 0 ? "in" : "out"}
                      title={b.participantName}
                      sub={
                        <>
                          Payé : {formatCents(b.paid)} · Part : {formatCents(b.share)}
                        </>
                      }
                      amount={b.balance}
                      endNote={b.balance > 0 ? "À recevoir" : b.balance < 0 ? "À payer" : "Équilibré"}
                    />
                  ))}
                </List>
              </Card>

              <Card title="Détail">
                <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  <p>Le solde = ce qu'il a payé − sa part des dépenses</p>
                  <p>Somme des soldes : <b>{formatCents(balances.reduce((sum, b) => sum + b.balance, 0))}</b> (toujours 0)</p>
                </div>
              </Card>
            </>
          )}
        </Screen>

        {/* ONGLET REMBOURSEMENTS */}
        <Screen id="remboursements" label="Remboursements">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour voir les remboursements"
              action={{ label: "Aller aux participants", onClick: () => setScreenId("participants") }}
            />
          ) : transfers.length === 0 ? (
            <Card title="Tout est équilibré">
              <Empty
                icon={Check}
                text="Personne ne doit rien à personne. Les soldes sont à zéro."
              />
            </Card>
          ) : (
            <>
              <Card title="Qui doit combien à qui">
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  {transfers.length} virement{transfers.length > 1 ? "s" : ""} pour tout équilibrer
                </p>
                <List>
                  {transfers.map((t, index) => (
                    <Row
                      key={index}
                      icon={ArrowLeftRight}
                      tone="warn"
                      title={`${t.fromName} → ${t.toName}`}
                      amount={-t.amount}
                      endNote={`Virement de ${formatCents(t.amount)}`}
                    />
                  ))}
                </List>
              </Card>

              <Card title="Explication">
                <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  <p>L'algorithme calcule les remboursements avec le <b>moins de virements possible</b> :</p>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem" }}>
                    <li>Ceux qui ont un solde positif (ont payé pour les autres) reçoivent de l'argent</li>
                    <li>Ceux qui ont un solde négatif (doivent de l'argent) paient</li>
                    <li>On fait payer le plus gros débiteur au plus gros créancier, et ainsi de suite</li>
                  </ul>
                </div>
              </Card>
            </>
          )}
        </Screen>
      </AppShell>

      {/* MODALE AJOUT PARTICIPANT */}
      <Sheet
        open={showAddParticipant}
        onClose={() => {
          setShowAddParticipant(false);
          setNewParticipantName("");
          setParticipantError("");
        }}
        title="Ajouter un participant"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddParticipant();
          }}
          className="form"
        >
          <TextField
            label="Prénom"
            value={newParticipantName}
            onChange={(v) => {
              setNewParticipantName(v);
              setParticipantError("");
            }}
            placeholder="Ex: Alice"
            error={participantError}
          />
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            Les prénoms en double (même orthographe, casse différente) ne sont pas autorisés.
          </p>
          <ButtonRow>
            <Button variant="plain" onClick={() => setShowAddParticipant(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" block>
              Ajouter
            </Button>
          </ButtonRow>
        </form>
      </Sheet>

      {/* MODALE AJOUT/MODIFICATION DÉPENSE */}
      <Sheet
        open={showAddExpense}
        onClose={() => {
          setShowAddExpense(false);
          setEditingExpense(null);
        }}
        title={editingExpense ? "Modifier la dépense" : "Ajouter une dépense"}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveExpense(); }} className="form">
          <TextField
            label="Libellé"
            value={expenseLabel}
            onChange={setExpenseLabel}
            placeholder="Ex: Repas, Taxi, Musée..."
            error={expenseError}
          />

          <TextField
            label="Montant (€)"
            value={expenseAmount}
            onChange={setExpenseAmount}
            placeholder="Ex: 25,50"
            type="text"
          />

          <div className="field">
            <label>Payé par</label>
            <div className="chips" role="group" aria-label="Payé par">
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${expensePaidBy === p.id ? " is-pressed" : ""}`}
                  onClick={() => setExpensePaidBy(p.id)}
                  aria-pressed={expensePaidBy === p.id}
                >
                  {getParticipantInitial(p.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Partagé entre <small style={{ color: "var(--text-muted)" }}> (vide = tout le monde)</small></label>
            <div className="chips" role="group" aria-label="Partagé entre">
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${isInSplit(p.id) ? " is-pressed" : ""}`}
                  onClick={() => toggleSplit(p.id)}
                  aria-pressed={isInSplit(p.id)}
                >
                  {getParticipantInitial(p.name)}
                </button>
              ))}
            </div>
            {expenseSplitBetween.length === 0 && participants.length > 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Tout le monde ({participants.map((p) => getParticipantInitial(p.name)).join(", ")})
              </p>
            )}
          </div>

          <ButtonRow>
            <Button variant="plain" onClick={() => setShowAddExpense(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" block>
              {editingExpense ? "Enregistrer" : "Ajouter"}
            </Button>
          </ButtonRow>
        </form>
      </Sheet>

      {/* CONFIRMATION SUPPRESSION DÉPENSE */}
      <ConfirmModal
        open={!!confirmDeleteExpense}
        onClose={() => setConfirmDeleteExpense(null)}
        title="Supprimer cette dépense ?"
        text={`« ${confirmDeleteExpense?.label} » de ${formatCents(confirmDeleteExpense?.amount || 0)} sera effacée.`}
        confirmLabel="Supprimer"
        onConfirm={confirmRemoveExpense}
      />

      {/* CONFIRMATION TOUT EFFACER */}
      <ConfirmModal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="Tout effacer ?"
        text="Tous les participants et dépenses seront supprimés définitivement."
        confirmLabel="Tout effacer"
        cancelLabel="Annuler"
        onConfirm={handleClearAll}
      />
    </>
  );
}