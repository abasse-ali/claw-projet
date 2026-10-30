import { useState } from "react";
import {
  AppShell,
  AppBar,
  Screen,
  Tiles,
  Tile,
  Card,
  List,
  Row,
  Empty,
  Badge,
  IconButton,
  Icon,
  Segmented,
  Chips,
  TextField,
  Button,
  ButtonRow,
  Sheet,
  Modal,
  ConfirmModal,
  Amount,
  toast,
} from "./kit";
import {
  useParticipants,
  useExpenses,
  useBalances,
  useSettlements,
  useAddParticipant,
  useUpdateParticipant,
  useDeleteParticipant,
  useAddExpense,
  useUpdateExpense,
  useDeleteExpense,
  useResetTrip,
  formatCents,
  parseCents,
  todayISO,
  validateBalancesSumZero,
} from "./store";
import {
  type Participant,
  type Expense,
  type Balance,
  type Settlement,
} from "./trip";
import { Users, CreditCard, PiggyBank, ArrowRightLeft, Trash2, Plus, X, Check, Edit, Minus, UserPlus, Receipt } from "lucide-react";

// --- Onglets ---
const tabs = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "expenses", label: "Dépenses", icon: CreditCard },
  { id: "balances", label: "Soldes", icon: PiggyBank },
  { id: "settlements", label: "Remboursements", icon: ArrowRightLeft },
];

// --- Écran Participants ---
function ParticipantsScreen() {
  const participants = useParticipants();
  const addParticipant = useAddParticipant();
  const updateParticipant = useUpdateParticipant();
  const deleteParticipant = useDeleteParticipant();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = () => {
    const result = addParticipant(newName);
    if (result.success) {
      setNewName("");
      toast("Participant ajouté");
    } else {
      toast(result.error || "Erreur", { tone: "error" });
    }
  };

  const handleEdit = (p: Participant) => {
    setEditId(p.id);
    setEditName(p.firstName);
  };

  const handleSaveEdit = (id: string) => {
    const result = updateParticipant(id, editName);
    if (result.success) {
      setEditId(null);
      setEditName("");
      toast("Participant modifié");
    } else {
      toast(result.error || "Erreur", { tone: "error" });
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const handleDelete = (id: string) => {
    const result = deleteParticipant(id);
    if (result.success) {
      toast("Participant supprimé");
    } else {
      toast(result.error || "Erreur", { tone: "error" });
    }
  };

  const renderParticipantRow = (p: Participant) => {
    if (editId === p.id) {
      return (
        <Row
          key={p.id}
          icon={UserPlus}
          tone="accent"
          title={
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              style={{ border: "none", outline: "none", font: "inherit", width: "100%" }}
            />
          }
          action={{
            icon: Check,
            label: "Valider",
            onClick: () => handleSaveEdit(p.id),
          }}
        />
      );
    }
    return (
      <Row
        key={p.id}
        icon={UserPlus}
        tone="accent"
        title={p.firstName}
        action={{
          icon: Edit,
          label: "Modifier",
          onClick: () => handleEdit(p),
        }}
      />
    );
  };

  return (
    <Screen id="participants" title="Participants">
      <Card>
        <TextField
          label="Prénom"
          value={newName}
          onChange={setNewName}
          placeholder="Ex: Alice"
        />
        <ButtonRow>
          <Button variant="primary" block onClick={handleAdd} disabled={!newName.trim()}>
            Ajouter
          </Button>
        </ButtonRow>
      </Card>

      {participants.length === 0 ? (
        <Empty icon={Users} text="Aucun participant. Ajoutez le premier !" />
      ) : (
        <List label="Participants">
          {participants.map(renderParticipantRow)}
        </List>
      )}
    </Screen>
  );
}

// --- Écran Dépenses ---
function ExpensesScreen() {
  const participants = useParticipants();
  const expenses = useExpenses();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [label, setLabel] = useState("");
  const [amountCents, setAmountCents] = useState<number>(0);
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [forWhom, setForWhom] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  // Par défaut : tous les participants
  const resetForm = () => {
    setLabel("");
    setAmountCents(0);
    setAmountText("");
    setPaidBy(participants[0]?.id || "");
    setForWhom(participants.map((p) => p.id));
    setEditId(null);
    setShowSheet(false);
  };

  const handleOpenAdd = () => {
    if (participants.length === 0) {
      toast("Ajoutez d'abord des participants", { tone: "error" });
      return;
    }
    setPaidBy(participants[0]?.id || "");
    setForWhom(participants.map((p) => p.id));
    setShowSheet(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setEditId(expense.id);
    setLabel(expense.label);
    setAmountCents(expense.amountCents);
    setAmountText(formatCents(expense.amountCents));
    setPaidBy(expense.paidBy);
    setForWhom(expense.forWhom);
    setShowSheet(true);
  };

  const handleAmountChange = (text: string) => {
    setAmountText(text);
    const cents = parseCents(text);
    if (Number.isFinite(cents) && cents >= 0) {
      setAmountCents(cents);
    }
  };

  const handleSubmit = () => {
    if (!label.trim() || amountCents <= 0 || !paidBy || forWhom.length === 0) {
      toast("Remplissez tous les champs", { tone: "error" });
      return;
    }

    if (editId) {
      updateExpense(editId, { label: label.trim(), amountCents, paidBy, forWhom });
      toast("Dépense modifiée");
    } else {
      addExpense({ label: label.trim(), amountCents, paidBy, forWhom, date: todayISO() });
      toast("Dépense ajoutée");
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteExpense(id);
    toast("Dépense supprimée");
  };

  const participantOptions = participants.map((p) => ({ value: p.id, label: p.firstName }));

  return (
    <>
      <Screen id="expenses" title="Dépenses">
        {participants.length === 0 ? (
          <Empty
            icon={CreditCard}
            text="Ajoutez des participants d'abord"
            action={{ label: "Participants", onClick: () => window.location.hash = "participants" }}
          />
        ) : expenses.length === 0 ? (
          <Empty
            icon={Receipt}
            text="Aucune dépense"
            action={{ label: "Ajouter", onClick: handleOpenAdd }}
          />
        ) : (
          <List label="Dépenses">
            {expenses.map((expense) => {
              const payer = participants.find((p) => p.id === expense.paidBy);
              const forWhomNames = expense.forWhom
                .map((id) => participants.find((p) => p.id === id)?.firstName)
                .filter(Boolean)
                .join(", ");
              return (
                <Row
                  key={expense.id}
                  icon={Receipt}
                  tone="out"
                  title={expense.label}
                  sub={`${formatCents(expense.amountCents)} • Payé par ${payer?.firstName} • Pour: ${forWhomNames}`}
                  amount={-expense.amountCents / 100}
                  action={{ icon: Edit, label: "Modifier", onClick: () => handleOpenEdit(expense) }}
                />
              );
            })}
          </List>
        )}
      </Screen>

      <Sheet open={showSheet} onClose={resetForm} title={editId ? "Modifier la dépense" : "Nouvelle dépense"}>
        <TextField
          label="Libellé"
          value={label}
          onChange={setLabel}
          placeholder="Ex: Courses, Restaurant..."
        />
        <TextField
          label="Montant"
          value={amountText}
          onChange={handleAmountChange}
          placeholder="Ex: 12,50 ou 12.50"
          type="text"
          inputMode="decimal"
        />
        <Card title="Payé par">
          <Chips
            options={participantOptions}
            value={paidBy}
            onChange={setPaidBy}
            label="Payeur"
          />
        </Card>
        <Card title="Pour qui">
          {participants.map((p) => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0" }}>
              <input
                type="checkbox"
                checked={forWhom.includes(p.id)}
                onChange={(e) =>
                  setForWhom(e.target.checked
                    ? [...forWhom, p.id]
                    : forWhom.filter((id) => id !== p.id))
                }
              />
              <span>{p.firstName}</span>
            </label>
          ))}
        </Card>
        <ButtonRow>
          <Button variant="primary" block onClick={handleSubmit}>
            {editId ? "Enregistrer" : "Ajouter"}
          </Button>
        </ButtonRow>
        {editId && (
          <Button variant="danger" block onClick={() => { deleteExpense(editId); resetForm(); }}>
            Supprimer
          </Button>
        )}
      </Sheet>
    </>
  );
}

// --- Écran Soldes ---
function BalancesScreen() {
  const balances = useBalances();
  const participants = useParticipants();

  if (participants.length === 0) {
    return (
      <Screen id="balances" title="Soldes">
        <Empty icon={Users} text="Ajoutez des participants pour voir les soldes" />
      </Screen>
    );
  }

  return (
    <Screen id="balances" title="Soldes">
      {balances.length === 0 ? (
        <Empty icon={PiggyBank} text="Aucune dépense pour l'instant" />
      ) : (
        <List label="Soldes">
          {balances.map((b) => {
            const p = participants.find((part) => part.id === b.participantId);
            const isPositive = b.balanceCents > 0;
            return (
              <Row
                key={b.participantId}
                icon={isPositive ? ArrowRightLeft : CreditCard}
                tone={isPositive ? "in" : "out"}
                title={p?.firstName || "Inconnu"}
                sub={`Payé: ${formatCents(b.paidCents)} • Part: ${formatCents(b.shareCents)}`}
                amount={b.balanceCents / 100}
              />
            );
          })}
        </List>
      )}
      <Card>
        <p style={{ textAlign: "center", color: "var(--muted)" }}>
          Total des soldes: <b>{formatCents(balances.reduce((sum, b) => sum + b.balanceCents, 0))}</b>
        </p>
      </Card>
    </Screen>
  );
}

// --- Écran Remboursements ---
function SettlementsScreen() {
  const settlements = useSettlements();
  const participants = useParticipants();

  if (participants.length === 0) {
    return (
      <Screen id="settlements" title="Remboursements">
        <Empty icon={Users} text="Ajoutez des participants" />
      </Screen>
    );
  }

  if (settlements.length === 0) {
    return (
      <Screen id="settlements" title="Remboursements">
        <Empty
          icon={Check}
          text="Tout est équilibré ! Personne ne doit rien à personne."
        />
      </Screen>
    );
  }

  return (
    <Screen id="settlements" title="Remboursements">
      <List label="Remboursements à faire">
        {settlements.map((s, i) => {
          const from = participants.find((p) => p.id === s.from);
          const to = participants.find((p) => p.id === s.to);
          return (
            <Row
              key={i}
              icon={ArrowRightLeft}
              tone="warn"
              title={`${from?.firstName} → ${to?.firstName}`}
              amount={s.amountCents / 100}
            />
          );
        })}
      </List>
      <Card>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
          {settlements.length} virement{settlements.length > 1 ? "s" : ""} pour tout équilibrer
        </p>
      </Card>
    </Screen>
  );
}

// --- App principale ---
export default function App() {
  const participants = useParticipants();
  const [showReset, setShowReset] = useState(false);
  const resetTrip = useResetTrip();

  const handleAdd = () => {
    if (window.location.hash === "#participants") {
      // L'écran participants gère son propre ajout
    } else if (window.location.hash === "#expenses") {
      window.location.hash = "#expenses";
    }
  };

  return (
    <AppShell
      bar={<AppBar title="Voyage entre amis" />}
      tabs={tabs}
      onAdd={handleAdd}
      addLabel="Ajouter"
    >
      <ParticipantsScreen />
      <ExpensesScreen />
      <BalancesScreen />
      <SettlementsScreen />

      <ConfirmModal
        open={showReset}
        onClose={() => setShowReset(false)}
        title="Réinitialiser le voyage ?"
        text="Toutes les données (participants, dépenses) seront effacées définitivement."
        confirmLabel="Tout effacer"
        onConfirm={() => {
          resetTrip();
          setShowReset(false);
          toast("Voyage réinitialisé");
        }}
      />
    </AppShell>
  );
}