// Appli de partage de dépenses entre amis pour un voyage
// - Participants : ajout, modification, suppression (protégée si dépenses liées)
// - Dépenses : libellé, montant, payeur, partagés avec (tous par défaut)
// - Soldes : ce qu'on a payé - sa part, au centime près, somme = 0
// - Remboursements : minimum de virements pour équilibrer
// - Persistance localStorage

import {
  Users,
  Plus,
  Receipt,
  Calculator,
  ArrowLeftRight,
  Trash2,
  Edit2,
  X,
  Check,
  UserPlus,
  Euro,
  ArrowUpDown,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  TextField,
  Tile,
  Tiles,
  Toaster,
  toast,
  openEntrySheet,
  useScreen,
} from "./kit";
import { useTripStore, useParticipants, useExpenses, useBalances, useSettlements, useTotalExpenses } from "./tripStore";
import { formatCents, formatSignedCents, parseAmountToCents, today } from "./calculations";
import type { Participant, Expense, Balance, Settlement } from "./types";
import { motion } from "framer-motion";
import React from "react";

const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "remboursements", label: "Remb.", icon: ArrowLeftRight },
];

type ParticipantSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string }) => void;
  initialName?: string;
  title: string;
};

function ParticipantSheetContent({ isOpen, onClose, onSubmit, initialName = "", title }: ParticipantSheetProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Le prénom ne peut pas être vide");
      return;
    }
    onSubmit({ label: trimmed });
  };

  return isOpen ? (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      <motion.div
        className="w-full bg-surface rounded-t-2xl p-4 pb-safe pb-6 shadow-xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="Fermer">
            <X size={24} />
          </button>
        </div>

        {error && <div className="mb-3 p-2 bg-red-100 text-red-800 rounded text-sm">{error}</div>}

        <TextField
          label="Prénom"
          value={name}
          onChange={(value) => {
            setName(value);
            setError("");
          }}
          placeholder="Prénom"
        />

        <ButtonRow>
          <Button variant="plain" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>
            {title === "Nouveau participant" ? "Ajouter" : "Enregistrer"}
          </Button>
        </ButtonRow>
      </motion.div>
    </div>
  ) : null;
}

type ExpenseSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string; amount: number; paidBy: string; sharedWith: string[] }) => void;
  participants: Participant[];
  initialLabel?: string;
  initialAmount?: string;
  initialPaidBy?: string;
  initialSharedWith?: string[];
  title: string;
};

function ExpenseSheetContent({ 
  isOpen, 
  onClose, 
  onSubmit, 
  participants, 
  initialLabel = "", 
  initialAmount = "", 
  initialPaidBy = "", 
  initialSharedWith = [],
  title 
}: ExpenseSheetProps) {
  const [label, setLabel] = useState(initialLabel);
  const [amount, setAmount] = useState(initialAmount);
  const [paidBy, setPaidBy] = useState(initialPaidBy);
  const [sharedWith, setSharedWith] = useState<string[]>(initialSharedWith);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (participants.length > 0 && !paidBy && !initialPaidBy) {
      setPaidBy(participants[0].id);
    }
    if (sharedWith.length === 0 && initialSharedWith.length === 0) {
      setSharedWith(participants.map((p) => p.id));
    }
  }, [participants, initialPaidBy, initialSharedWith]);

  const handleSubmit = () => {
    const amountCents = parseAmountToCents(amount);
    if (!label.trim()) {
      setError("Le libellé ne peut pas être vide");
      return;
    }
    if (amountCents <= 0) {
      setError("Le montant doit être positif");
      return;
    }
    if (!paidBy) {
      setError("Sélectionnez qui a payé");
      return;
    }
    if (sharedWith.length === 0) {
      setError("Sélectionnez au moins un participant");
      return;
    }

    onSubmit({
      label: label.trim(),
      amount: amountCents,
      paidBy,
      sharedWith,
    });
    onClose();
  };

  const toggleShared = (participantId: string) => {
    setSharedWith((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId]
    );
  };

  const isAllSelected = sharedWith.length === participants.length && participants.length > 0;

  return isOpen ? (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      <motion.div
        className="w-full bg-surface rounded-t-2xl p-4 pb-safe pb-6 shadow-xl max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="Fermer">
            <X size={24} />
          </button>
        </div>

        {error && <div className="mb-3 p-2 bg-red-100 text-red-800 rounded text-sm">{error}</div>}

        <TextField
          label="Libellé"
          placeholder="Ex: Restaurant, essence, hébergement"
          value={label}
          onChange={(value) => {
            setLabel(value);
            setError("");
          }}
        />

        <TextField
          label="Montant"
          placeholder="0,00"
          type="tel"
          value={amount}
          onChange={(value) => {
            setAmount(value);
            setError("");
          }}
        />

        <div className="mt-4">
          <label className="block text-sm font-medium text-muted mb-2">Payé par</label>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(participants.length, 3)}, 1fr)` }}>
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setPaidBy(p.id)}
                className={`p-3 rounded-xl border-2 text-center font-medium transition ${
                  paidBy === p.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line hover:border-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted">Partagé avec</label>
            <button
              onClick={() =>
                setSharedWith(
                  isAllSelected ? [] : participants.map((p) => p.id)
                )
              }
              className="text-sm text-accent"
            >
              {isAllSelected ? "Désélectionner tout" : "Tout sélectionner"}
            </button>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(participants.length, 3)}, 1fr)` }}>
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleShared(p.id)}
                className={`p-3 rounded-xl border-2 text-center font-medium transition ${
                  sharedWith.includes(p.id)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line hover:border-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <ButtonRow>
          <Button variant="plain" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>
            {title === "Nouvelle dépense" ? "Ajouter" : "Enregistrer"}
          </Button>
        </ButtonRow>
      </motion.div>
    </div>
  ) : null;
}

function ParticipantsScreen({ onAdd }: { onAdd: () => void }) {
  const participants = useParticipants();
  const addParticipant = useTripStore((state) => state.addParticipant);
  const updateParticipant = useTripStore((state) => state.updateParticipant);
  const removeParticipant = useTripStore((state) => state.removeParticipant);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (participant: Participant) => {
    setEditingId(participant.id);
    setEditName(participant.name);
  };

  const handleRemove = (participant: Participant) => {
    const result = removeParticipant(participant.id);
    if (result.success) {
      toast("Participant supprimé");
    } else if (result.error) {
      toast(result.error, { tone: "error" });
    }
  };

  const saveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed && updateParticipant(id, trimmed)) {
      toast("Participant modifié");
      setEditingId(null);
      setEditName("");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  return (
    <Screen id="participants" title="Participants" onAdd={onAdd}>
      {participants.length === 0 ? (
        <Empty
          icon={UserPlus}
          text="Aucun participant"
          action={{ label: "Ajouter le premier", onClick: onAdd }}
        />
      ) : (
        <>
          <Card title="Participants" level={3}>
            <List>
              {participants.map((participant) => (
                <div key={participant.id} className="py-2">
                  {editingId === participant.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(participant.id)}
                        onBlur={() => saveEdit(participant.id)}
                        autoFocus
                        className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface text-base"
                      />
                      <Button small icon={Check} onClick={() => saveEdit(participant.id)}>
                        <Check size={16} />
                      </Button>
                      <Button small variant="plain" icon={X} onClick={cancelEdit}>
                        <X size={16} />
                      </Button>
                    </div>
                  ) : (
                    <Row
                      title={participant.name}
                      tone="accent"
                      action={{
                        icon: Edit2,
                        label: `Modifier ${participant.name}`,
                        onClick: () => startEdit(participant),
                      }}
                      end={
                        <div className="ml-2">
                          <Button
                            small
                            variant="plain"
                            icon={Trash2}
                            onClick={() => handleRemove(participant)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      }
                    />
                  )}
                </div>
              ))}
            </List>
          </Card>
          <div className="h-16" />
        </>
      )}
    </Screen>
  );
}

function DepensesScreen({ onAdd }: { onAdd: () => void }) {
  const participants = useParticipants();
  const expenses = useExpenses();
  const addExpense = useTripStore((state) => state.addExpense);
  const updateExpense = useTripStore((state) => state.updateExpense);
  const removeExpense = useTripStore((state) => state.removeExpense);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setSheetOpen(true);
  };

  const handleRemove = (expense: Expense) => {
    const undo = removeExpense(expense.id);
    toast("Dépense supprimée", { action: { label: "Annuler", run: undo } });
  };

  const handleSubmit = (data: { label: string; amount: number; paidBy: string; sharedWith: string[] }) => {
    if (editingExpense) {
      updateExpense(editingExpense.id, data);
      toast("Dépense modifiée");
    } else {
      addExpense(data);
      toast("Dépense ajoutée");
    }
  };

  const totalExpenses = useTotalExpenses();

  return (
    <Screen id="depenses" title="Dépenses" onAdd={onAdd}>
      {participants.length === 0 ? (
        <Empty
          icon={UserPlus}
          text="Ajoutez des participants d'abord"
          action={{ label: "Gérer les participants", onClick: () => {} }}
        />
      ) : (
        <>
          <Tiles>
            <Tile
              icon={Euro}
              label="Total dépenses"
              value={formatCents(totalExpenses)}
              note={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""}`}
            />
            <Tile
              icon={Users}
              label="Participants"
              value={participants.length}
              note="dans le voyage"
            />
          </Tiles>

          {expenses.length === 0 ? (
            <Empty
              icon={Receipt}
              text="Aucune dépense"
              action={{ label: "Ajouter la première", onClick: onAdd }}
            />
          ) : (
            <Card title="Dépenses" level={3}>
              <List>
                {expenses.map((expense) => {
                  const payer = participants.find((p) => p.id === expense.paidBy);
                  const sharers = expense.sharedWith.length === 0
                    ? participants
                    : participants.filter((p) => expense.sharedWith.includes(p.id));
                  const sharerNames = sharers.map((p) => p.name).join(", ");
                  
                  return (
                    <Row
                      key={expense.id}
                      icon={Euro}
                      tone="out"
                      title={expense.label}
                      badge={formatCents(expense.amount)}
                      sub={[
                        payer ? `Payé par ${payer.name}` : "Payeur inconnu",
                        `Partagé avec ${sharerNames}`,
                      ].join(" · ")}
                      action={{
                        icon: Edit2,
                        label: `Modifier « ${expense.label} »`,
                        onClick: () => handleEdit(expense),
                      }}
                      end={
                        <div className="ml-2">
                          <Button
                            small
                            variant="plain"
                            icon={Trash2}
                            onClick={() => handleRemove(expense)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      }
                    />
                  );
                })}
              </List>
            </Card>
          )}

          <ExpenseSheetContent
            isOpen={sheetOpen}
            onClose={() => {
              setSheetOpen(false);
              setEditingExpense(null);
            }}
            onSubmit={handleSubmit}
            participants={participants}
            initialLabel={editingExpense?.label || ""}
            initialAmount={editingExpense ? (editingExpense.amount / 100).toFixed(2).replace(".", ",") : ""}
            initialPaidBy={editingExpense?.paidBy || ""}
            initialSharedWith={editingExpense?.sharedWith || []}
            title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
          />
        </>
      )}
    </Screen>
  );
}

function SoldesScreen() {
  const participants = useParticipants();
  const balances = useBalances();
  const totalExpenses = useTotalExpenses();

  const totalPaid = useMemo(() => balances.reduce((sum: number, b: Balance) => sum + b.paid, 0), [balances]);
  const totalShare = useMemo(() => balances.reduce((sum: number, b: Balance) => sum + b.share, 0), [balances]);

  if (participants.length === 0) {
    return (
      <Screen id="soldes" title="Soldes">
        <Empty
          icon={Users}
          text="Ajoutez des participants pour voir les soldes"
        />
      </Screen>
    );
  }

  return (
    <Screen id="soldes" title="Soldes">
      <Hero
        label="Total des dépenses"
        amount={totalExpenses / 100}
        sub={`${participants.length} participant${participants.length > 1 ? "s" : ""}`}
      />

      <Card title="Solde de chacun" level={3}>
        <p className="text-sm text-muted mb-3">
          Positif = on lui doit · Négatif = il doit
        </p>
        <List>
          {balances.map((balance: Balance) => (
            <Row
              key={balance.participantId}
              icon={ArrowUpDown}
              tone={balance.balance > 0 ? "in" : balance.balance < 0 ? "out" : "accent"}
              title={balance.participantName}
              badge={formatSignedCents(balance.balance)}
              sub={`Payé ${formatCents(balance.paid)} · Part ${formatCents(balance.share)}`}
            />
          ))}
        </List>
        <div className="pt-2 border-t border-line flex justify-between text-sm text-muted">
          <span>Total payé : {formatCents(totalPaid)}</span>
          <span>Total parts : {formatCents(totalShare)}</span>
        </div>
      </Card>

      <div className="h-16" />
    </Screen>
  );
}

function RemboursementsScreen() {
  const participants = useParticipants();
  const settlements = useSettlements();
  const balances = useBalances();

  if (participants.length === 0) {
    return (
      <Screen id="remboursements" title="Remboursements">
        <Empty
          icon={Users}
          text="Ajoutez des participants pour voir les remboursements"
        />
      </Screen>
    );
  }

  if (settlements.length === 0) {
    return (
      <Screen id="remboursements" title="Remboursements">
        <Hero
          label="Tout est équilibré"
          amount={0}
          sub="Aucun remboursement nécessaire"
        />
        <div className="h-16" />
      </Screen>
    );
  }

  return (
    <Screen id="remboursements" title="Remboursements">
      <Card title="Remboursements à faire" level={3}>
        <p className="text-sm text-muted mb-3">
          Minimum de virements pour tout équilibrer
        </p>
        <List>
          {settlements.map((settlement: Settlement, index: number) => (
            <Row
              key={index}
              icon={ArrowLeftRight}
              tone="warn"
              title={`${settlement.fromName} → ${settlement.toName}`}
              badge={formatCents(settlement.amount)}
              sub={`${settlement.fromName} doit rembourser ${settlement.toName}`}
            />
          ))}
        </List>
      </Card>

      <Card title="Résumé des soldes" level={3}>
        <List>
          {balances.map((balance: Balance) => (
            <Row
              key={balance.participantId}
              icon={ArrowUpDown}
              tone={balance.balance > 0 ? "in" : balance.balance < 0 ? "out" : "accent"}
              title={balance.participantName}
              badge={formatSignedCents(balance.balance)}
              sub={`Payé ${formatCents(balance.paid)} · Part ${formatCents(balance.share)}`}
            />
          ))}
        </List>
      </Card>

      <div className="h-16" />
    </Screen>
  );
}

export default function App() {
  const [hash, go] = useScreen();
  const tabsIds = ["participants", "depenses", "soldes", "remboursements"];
  const screen = tabsIds.includes(hash) ? hash : tabsIds[0];
  const [participantSheetOpen, setParticipantSheetOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const participants = useParticipants();
  const addParticipant = useTripStore((state) => state.addParticipant);
  const updateParticipant = useTripStore((state) => state.updateParticipant);
  const removeParticipant = useTripStore((state) => state.removeParticipant);
  const addExpense = useTripStore((state) => state.addExpense);
  const updateExpense = useTripStore((state) => state.updateExpense);
  const removeExpense = useTripStore((state) => state.removeExpense);

  const handleParticipantSubmit = (data: { label: string }) => {
    if (editingParticipant) {
      updateParticipant(editingParticipant.id, data.label);
      toast("Participant modifié");
    } else {
      addParticipant(data.label);
      toast("Participant ajouté");
    }
    setParticipantSheetOpen(false);
    setEditingParticipant(null);
  };


  const handleExpenseSubmit = (data: { label: string; amount: number; paidBy: string; sharedWith: string[] }) => {
    if (editingExpense) {
      updateExpense(editingExpense.id, data);
      toast("Dépense modifiée");
    } else {
      addExpense(data);
      toast("Dépense ajoutée");
    }
    setExpenseSheetOpen(false);
    setEditingExpense(null);
  };


  const openAddParticipant = () => {
    setEditingParticipant(null);
    setParticipantSheetOpen(true);
  };


  const openAddExpense = () => {
    if (participants.length === 0) {
      toast("Ajoutez d'abord des participants", { tone: "error" });
      return;
    }
    setEditingExpense(null);
    setExpenseSheetOpen(true);
  };


  return (
    <>
      <AppShell
        bar={
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold">Voyage partagé</h1>
            <IconButton
              icon={Plus}
              label="Ajouter"
              onClick={
                screen === "participants" ? openAddParticipant :
                screen === "depenses" ? openAddExpense :
                undefined
              }
            />
          </div>
        }
        tabs={TABS}
        onAdd={screen === "participants" ? openAddParticipant : screen === "depenses" ? openAddExpense : undefined}
        addLabel={screen === "participants" ? "Ajouter participant" : "Ajouter dépense"}
      >
        <ParticipantsScreen onAdd={openAddParticipant} />
        <DepensesScreen onAdd={openAddExpense} />
        <SoldesScreen />
        <RemboursementsScreen />
      </AppShell>

      <ParticipantSheetContent
        isOpen={participantSheetOpen}
        onClose={() => {
          setParticipantSheetOpen(false);
          setEditingParticipant(null);
        }}
        onSubmit={handleParticipantSubmit}
        initialName={editingParticipant?.name || ""}
        title={editingParticipant ? "Modifier le participant" : "Nouveau participant"}
      />

      <ExpenseSheetContent
        isOpen={expenseSheetOpen}
        onClose={() => {
          setExpenseSheetOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleExpenseSubmit}
        participants={participants}
        initialLabel={editingExpense?.label || ""}
        initialAmount={editingExpense ? (editingExpense.amount / 100).toFixed(2).replace(".", ",") : ""}
        initialPaidBy={editingExpense?.paidBy || ""}
        initialSharedWith={editingExpense?.sharedWith || []}
        title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
      />

      <Toaster />
    </>
  );
}