// Application de partage de dépenses de voyage

import {
  UserPlus,
  Users,
  Receipt,
  Calculator,
  ArrowUpDown,
  Trash2,
  Edit,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Euro,
  UserMinus,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Hero,
  List,
  Row,
  Screen,
  Settings as SettingsComp,
  Setting,
  TextField,
  Tile,
  Tiles,
  MoneyInput,
  Segmented,
  Chips,
  Empty,
  Sheet,
  toast,
  type Category,
} from "./kit";
import {
  useTripStore,
  computeBalances,
  computeSettlements,
  verifyBalancesSumZero,
  formatCents,
  eurosToCents,
  getParticipantName,
  type Participant,
  type Expense,
} from "./tripStore";

const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "remboursements", label: "Remb.", icon: ArrowUpDown },
];

const EXPENSE_CATEGORIES: Category[] = [
  { name: "Hébergement", icon: Users },
  { name: "Repas", icon: Euro },
  { name: "Transport", icon: ArrowUpDown },
  { name: "Activités", icon: Settings },
  { name: "Autre", icon: Euro },
];

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function App() {
  const participants = useTripStore((s) => s.participants);
  const expenses = useTripStore((s) => s.expenses);
  const addParticipant = useTripStore((s) => s.addParticipant);
  const removeParticipant = useTripStore((s) => s.removeParticipant);
  const updateParticipant = useTripStore((s) => s.updateParticipant);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const clearAll = useTripStore((s) => s.clearAll);

  const [newParticipantName, setNewParticipantName] = useState("");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editParticipantName, setEditParticipantName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<string | null>(null);
  const [confirmRemoveExpense, setConfirmRemoveExpense] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Ouvre la sheet pour ajouter une dépense
  const openExpenseSheet = () => {
    setIsAddingExpense(true);
    setEditingExpense(null);
  };

  // Ouvre la sheet pour modifier une dépense
  const handleEditExpense = (expense: Expense) => {
    setIsAddingExpense(false);
    setEditingExpense(expense);
  };

  // Calculs dérivés
  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(participants, balances), [participants, balances]);
  const balancesSumZero = useMemo(() => verifyBalancesSumZero(balances), [balances]);

  // --- Handlers Participants ---
  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    const result = addParticipant(name);
    if (result) {
      setNewParticipantName("");
      setShowAddParticipant(false);
      toast("Participant ajouté");
    } else {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  const handleRemoveParticipant = (id: string) => {
    const success = removeParticipant(id);
    if (success) {
      toast("Participant supprimé");
    } else {
      toast("Impossible : ce participant a des dépenses", { tone: "error" });
    }
    setConfirmRemoveParticipant(null);
  };

  const handleStartEditParticipant = (p: Participant) => {
    setEditingParticipantId(p.id);
    setEditParticipantName(p.name);
  };

  const handleSaveEditParticipant = () => {
    if (!editingParticipantId) return;
    const name = editParticipantName.trim();
    if (!name) return;
    const success = updateParticipant(editingParticipantId, name);
    if (success) {
      toast("Participant modifié");
      setEditingParticipantId(null);
      setEditParticipantName("");
    } else {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  // --- Handlers Dépenses ---
  const handleAddExpense = (data: {
    label: string;
    amount: string;
    paidBy: string;
    forWhom: string[];
    category: string;
  }) => {
    const amountCents = eurosToCents(parseFloat(data.amount) || 0);
    if (amountCents <= 0) {
      toast("Montant invalide", { tone: "error" });
      return;
    }
    if (!data.paidBy) {
      toast("Choisissez qui a payé", { tone: "error" });
      return;
    }
    addExpense({
      label: data.label.trim() || "Sans nom",
      amountCents,
      paidBy: data.paidBy,
      forWhom: data.forWhom,
      category: data.category,
      date: todayISO(),
    });
    toast("Dépense ajoutée");
  };

  const handleUpdateExpense = (id: string, data: {
    label: string;
    amount: string;
    paidBy: string;
    forWhom: string[];
    category: string;
  }) => {
    const amountCents = eurosToCents(parseFloat(data.amount) || 0);
    if (amountCents <= 0) {
      toast("Montant invalide", { tone: "error" });
      return;
    }
    updateExpense(id, {
      label: data.label.trim() || "Sans nom",
      amountCents,
      paidBy: data.paidBy,
      forWhom: data.forWhom,
      category: data.category,
    });
    toast("Dépense modifiée");
    setEditingExpense(null);
  };

  const handleRemoveExpense = (id: string) => {
    removeExpense(id);
    toast("Dépense supprimée");
    setConfirmRemoveExpense(null);
  };

  // --- Handlers Globaux ---
  const handleClearAll = () => {
    clearAll();
    toast("Tout effacé", { action: { label: "Annuler", run: () => {} } });
    setConfirmClear(false);
  };

  // Pour la Sheet d'ajout/modif de dépense
  const expenseSheetData = useMemo(() => {
    if (!editingExpense) return null;
    return {
      label: editingExpense.label,
      amount: (editingExpense.amountCents / 100).toFixed(2),
      paidBy: editingExpense.paidBy,
      forWhom: editingExpense.forWhom,
      category: editingExpense.category,
    };
  }, [editingExpense]);

  return (
    <>
      <AppShell
        bar={
          <>
            <h1 className="app-bar__title">Voyage entre amis</h1>
            <Button small variant="ghost" icon={Settings} onClick={() => setConfirmClear(true)} aria-label="Réglages" />
          </>
        }
        tabs={TABS}
        onAdd={() => {
          if (participants.length === 0) {
            setShowAddParticipant(true);
          } else {
            openExpenseSheet();
          }
        }}
        addLabel={participants.length === 0 ? "Ajouter un participant" : "Ajouter une dépense"}
      >
        {/* ÉCRAN PARTICIPANTS */}
        <Screen id="participants" title="Participants" onAdd={() => setShowAddParticipant(true)}>
          {participants.length === 0 ? (
            <Empty
              icon={UserPlus}
              text="Aucun participant pour l'instant"
              action={{ label: "Ajouter le premier", onClick: () => setShowAddParticipant(true) }}
            />
          ) : (
            <>
              <Card title="Participants" meta={`${participants.length} personne${participants.length > 1 ? "s" : ""}`}>
                <List>
                  {participants.map((p) => (
                    <Row
                      key={p.id}
                      icon={UserPlus}
                      tone="accent"
                      title={editingParticipantId === p.id ? (
                        <TextField
                          label=""
                          value={editParticipantName}
                          onChange={setEditParticipantName}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEditParticipant()}
                        />
                      ) : (
                        p.name
                      )}
                      sub={editingParticipantId === p.id ? undefined : `${expenses.filter((e) => e.paidBy === p.id || e.forWhom.includes(p.id)).length} dépense${expenses.filter((e) => e.paidBy === p.id || e.forWhom.includes(p.id)).length > 1 ? "s" : ""}`}
                      action={
                        editingParticipantId === p.id ? (
                          <ButtonRow>
                            <Button small icon={Check} onClick={handleSaveEditParticipant} />
                            <Button small variant="ghost" icon={X} onClick={() => setEditingParticipantId(null)} aria-label="Annuler" />
                          </ButtonRow>
                        ) : (
                          <>
                            <Button small variant="ghost" icon={Edit} onClick={() => handleStartEditParticipant(p)} aria-label={`Modifier ${p.name}`} />
                            <Button
                              small
                              variant="ghost"
                              icon={UserMinus}
                              onClick={() => {
                                const used = expenses.some((e) => e.paidBy === p.id || e.forWhom.includes(p.id));
                                if (used) setConfirmRemoveParticipant(p.id);
                                else handleRemoveParticipant(p.id);
                              }}
                              aria-label={`Supprimer ${p.name}`}
                            />
                          </>
                        )
                      }
                    />
                  ))}
                </List>
              </Card>
              <Card>
                <Button block icon={UserPlus} onClick={() => setShowAddParticipant(true)}>
                  Ajouter un participant
                </Button>
              </Card>
            </>
          )}
        </Screen>

        {/* ÉCRAN DÉPENSES */}
        <Screen id="depenses" title="Dépenses" onAdd={openExpenseSheet}>
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez d'abord des participants"
              action={{ label: "Gérer les participants", onClick: () => setShowAddParticipant(true) }}
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Receipt}
              text="Aucune dépense pour l'instant"
              action={{ label: "Ajouter une dépense", onClick: () => openExpenseSheet() }}
            />
          ) : (
            <Card title="Dépenses" meta={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""}`}>
              <List>
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => {
                    const paidByName = getParticipantName(participants, expense.paidBy);
                    const forWhomNames = expense.forWhom.length === 0
                      ? "Tout le monde"
                      : expense.forWhom.map((id) => getParticipantName(participants, id)).join(", ");
                    return (
                      <Row
                        key={expense.id}
                        icon={Euro}
                        tone="out"
                        title={expense.label}
                        sub={`${expense.category} · Payé par ${paidByName} · Pour : ${forWhomNames}`}
                        amount={-expense.amountCents}
                        action={
                          <>
                            <Button small variant="ghost" icon={Edit} onClick={() => handleEditExpense(expense)} aria-label={`Modifier ${expense.label}`} />
                            <Button
                              small
                              variant="ghost"
                              icon={Trash2}
                              onClick={() => setConfirmRemoveExpense(expense.id)}
                              aria-label={`Supprimer ${expense.label}`}
                            />
                          </>
                        }
                      />
                    );
                  })}
              </List>
            </Card>
          )}
        </Screen>

        {/* ÉCRAN SOLDES */}
        <Screen id="soldes" title="Soldes">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour voir les soldes"
            />
          ) : (
            <>
              <Card title="Solde de chacun" meta={balancesSumZero ? "Équilibré ✓" : "⚠️ Déséquilibré"}>
                <List>
                  {participants.map((p) => {
                    const balance = balances.get(p.id) ?? 0;
                    return (
                      <Row
                        key={p.id}
                        icon={Euro}
                        tone={balance > 0 ? "in" : balance < 0 ? "out" : "accent"}
                        title={p.name}
                        amount={balance}
                        badge={balance > 0 ? "À recevoir" : balance < 0 ? "À payer" : "Équilibré"}
                      />
                    );
                  })}
                </List>
              </Card>
              <Card>
                <p className="text-sm text-muted text-center">
                  Positif = à recevoir | Négatif = à payer | La somme fait toujours 0
                </p>
              </Card>
            </>
          )}
        </Screen>

        {/* ÉCRAN REMBOURSEMENTS */}
        <Screen id="remboursements" title="Remboursements">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants"
            />
          ) : settlements.length === 0 ? (
            <Empty
              icon={Check}
              text="Tout est équilibré !"
              action={expenses.length === 0 ? { label: "Ajouter une dépense", onClick: () => openExpenseSheet() } : undefined}
            />
          ) : (
            <Card title="Qui doit combien à qui" meta={`${settlements.length} virement${settlements.length > 1 ? "s" : ""} nécessaire${settlements.length > 1 ? "s" : ""}`}>
              <List>
                {settlements.map((s, index) => (
                  <Row
                    key={`${s.from}-${s.to}-${index}`}
                    icon={ArrowUpDown}
                    tone="warn"
                    title={`${getParticipantName(participants, s.from)} → ${getParticipantName(participants, s.to)}`}
                    amount={s.amountCents}
                    badge="Rembourse"
                  />
                ))}
              </List>
            </Card>
          )}
        </Screen>
      </AppShell>

      {/* Modale ajout participant */}
      {showAddParticipant && (
        <ConfirmModal
          open={true}
          onClose={() => setShowAddParticipant(false)}
          title="Ajouter un participant"
          text=""
          confirmLabel="Ajouter"
          onConfirm={handleAddParticipant}
        >
          <TextField
            label=""
            value={newParticipantName}
            onChange={setNewParticipantName}
            placeholder="Prénom"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAddParticipant()}
          />
        </ConfirmModal>
      )}

      {/* Modale confirmation suppression participant */}
      {confirmRemoveParticipant && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmRemoveParticipant(null)}
          title="Supprimer ce participant ?"
          text="Il sera retiré de la liste. Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => handleRemoveParticipant(confirmRemoveParticipant!)}
        />
      )}

      {/* Modale confirmation suppression dépense */}
      {confirmRemoveExpense && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmRemoveExpense(null)}
          title="Supprimer cette dépense ?"
          text="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => handleRemoveExpense(confirmRemoveExpense!)}
        />
      )}

      {/* Modale confirmation tout effacer */}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Tous les participants et dépenses seront supprimés définitivement."
        confirmLabel="Tout effacer"
        onConfirm={handleClearAll}
      />

      {/* Sheet pour ajouter/modifier une dépense */}
      <ExpenseSheet
        participants={participants}
        categories={EXPENSE_CATEGORIES}
        editingExpense={editingExpense}
        isAddingExpense={isAddingExpense}
        initialData={expenseSheetData}
        onAdd={handleAddExpense}
        onUpdate={handleUpdateExpense}
        onClose={() => {
          setIsAddingExpense(false);
          setEditingExpense(null);
        }}
      />
    </>
  );
}

// Composant Sheet pour les dépenses
interface ExpenseSheetProps {
  participants: Participant[];
  categories: Category[];
  editingExpense: Expense | null;
  isAddingExpense: boolean;
  initialData: {
    label: string;
    amount: string;
    paidBy: string;
    forWhom: string[];
    category: string;
  } | null;
  onAdd: (data: { label: string; amount: string; paidBy: string; forWhom: string[]; category: string }) => void;
  onUpdate: (id: string, data: { label: string; amount: string; paidBy: string; forWhom: string[]; category: string }) => void;
  onClose: () => void;
}

function ExpenseSheet({ participants, categories, editingExpense, isAddingExpense, initialData, onAdd, onUpdate, onClose }: ExpenseSheetProps) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [forWhom, setForWhom] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [showForWhom, setShowForWhom] = useState(false);

  // Initialiser au premier rendu ou quand editingExpense change
  const initialized = useMemo(() => {
    if (initialData) {
      setLabel(initialData.label);
      setAmount(initialData.amount);
      setPaidBy(initialData.paidBy);
      setForWhom(initialData.forWhom);
      setCategory(initialData.category);
    } else {
      setLabel("");
      setAmount("");
      setPaidBy(participants[0]?.id || "");
      setForWhom([]);
      setCategory(categories[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense?.id]);

  const handleSubmit = () => {
    if (!label.trim() || !amount || !paidBy) return;
    const data = { label, amount, paidBy, forWhom, category };
    if (editingExpense) {
      onUpdate(editingExpense.id, data);
    } else {
      onAdd(data);
    }
    onClose();
  };

  const toggleForWhom = (id: string) => {
    setForWhom((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const isAllSelected = forWhom.length === participants.length || forWhom.length === 0;

  return (
    <Sheet
      open={isAddingExpense || !!editingExpense}
      onClose={onClose}
      title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
    >
      <div className="space-y-4">
        <TextField
          label="Libellé"
          value={label}
          onChange={setLabel}
          placeholder="Ex: Courses, resto, essence..."
        />
        <MoneyInput label="Montant" value={amount} onChange={(v) => setAmount(String(v))} placeholder="0,00" />
        
        <div>
          <label className="block text-sm text-muted mb-1">Payé par</label>
          <Segmented
            options={participants.map((p) => ({ value: p.id, label: p.name }))}
            value={paidBy}
            onChange={(value) => setPaidBy(value)}
            label="Payé par"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">
            Pour qui {forWhom.length === 0 ? "(tout le monde)" : `(${forWhom.length} personne${forWhom.length > 1 ? "s" : ""})`}
          </label>
          <Chips
            options={participants.map((p) => ({ value: p.id, label: p.name }))}
            value={forWhom}
            onChange={(v) => setForWhom(Array.isArray(v) ? v : [v])}
            multiple
            label="Pour qui"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Catégorie</label>
          <Segmented
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
            value={category}
            onChange={(value) => setCategory(value)}
            label="Catégorie"
          />
        </div>

        <ButtonRow>
          <Button block variant="ghost" onClick={onClose}>Annuler</Button>
          <Button block onClick={handleSubmit}>{editingExpense ? "Enregistrer" : "Ajouter"}</Button>
        </ButtonRow>
      </div>
    </Sheet>
  );
}