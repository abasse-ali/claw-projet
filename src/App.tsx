// Application de partage de dépenses de voyage

import {
  Plus,
  Users,
  Receipt,
  Calculator,
  Trash2,
  X,
  Check,
  ArrowUpDown,
  Euro,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  AppBar,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  List,
  Row,
  Screen,
  Settings,
  Setting,
  Tile,
  Tiles,
  TextField,
  Segmented,
  Switch,
  toast,
  money,
} from "./kit";
import { useTravelStore } from "./store";
import { computeBalances, computeSettlements, validateBalances } from "./types";
import type { Participant, Expense } from "./types";

// Onglets
const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "expenses", label: "Dépenses", icon: Receipt },
  { id: "balances", label: "Soldes", icon: Calculator },
  { id: "settlements", label: "Remb.", icon: ArrowUpDown },
];

// Format montant en euros depuis centimes
const formatCents = (cents: number) => money(cents / 100);

export default function App() {
  const participants = useTravelStore((s) => s.participants);
  const expenses = useTravelStore((s) => s.expenses);
  const addParticipant = useTravelStore((s) => s.addParticipant);
  const removeParticipant = useTravelStore((s) => s.removeParticipant);
  const addExpense = useTravelStore((s) => s.addExpense);
  const updateExpense = useTravelStore((s) => s.updateExpense);
  const removeExpense = useTravelStore((s) => s.removeExpense);
  const clearAll = useTravelStore((s) => s.clearAll);

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<string | null>(null);
  const [confirmRemoveExpense, setConfirmRemoveExpense] = useState<string | null>(null);

  // Soldes calculés
  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(balances), [balances]);
  const isValid = useMemo(() => validateBalances(balances), [balances]);

  // Total des dépenses
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  // Écran Participants
  const renderParticipants = () => (
    <Screen id="participants" title="Participants">
      <Card title="Participants du voyage" level={3}>
        <p className="text-sm text-muted mb-3">
          Ajoutez les prénoms de chaque participant. Pas de doublons (insensible à la casse et accents).
        </p>
        <AddParticipantForm onAdd={addParticipant} />
        {participants.length === 0 ? (
          <p className="text-center text-muted py-4">Aucun participant pour l'instant.</p>
        ) : (
          <List>
            {participants.map((p) => {
              const used = expenses.some(e => e.paidBy === p.id || e.sharedWith.includes(p.id));
              return (
                <Row
                  key={p.id}
                  icon={UserPlus}
                  tone={used ? "warn" : "accent"}
                  title={p.name}
                  badge={used ? "Utilisé" : "Libre"}
                  action={{
                    icon: Trash2,
                    label: `Supprimer ${p.name}`,
                    onClick: () => setConfirmRemoveParticipant(p.id),
                  }}
                />
              );
            })}
          </List>
        )}
      </Card>
    </Screen>
  );

  // Écran Dépenses
  const renderExpenses = () => (
    <Screen id="expenses" title="Dépenses">
      <Card title="Dépenses du voyage" level={3}>
        <AddExpenseForm
          participants={participants}
          onAdd={addExpense}
          onUpdate={updateExpense}
        />
        {expenses.length === 0 ? (
          <p className="text-center text-muted py-4">Aucune dépense pour l'instant.</p>
        ) : (
          <List>
            {expenses
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((expense) => {
                const payer = participants.find(p => p.id === expense.paidBy);
                const sharedNames = expense.sharedWith.length === 0
                  ? "Tout le monde"
                  : expense.sharedWith.map(id => participants.find(p => p.id === id)?.name).filter(Boolean).join(", ");
                
                return (
                  <Row
                    key={expense.id}
                    icon={Euro}
                    tone="out"
                    title={expense.label}
                    sub={`${payer?.name || "?"} a payé · Partagé avec : ${sharedNames}`}
                    amount={-expense.amount / 100}
                    end={formatCents(expense.amount)}
                    action={{
                      icon: Trash2,
                      label: `Supprimer « ${expense.label} »`,
                      onClick: () => setConfirmRemoveExpense(expense.id),
                    }}
                  />
                );
              })}
          </List>
        )}
      </Card>
    </Screen>
  );

  // Écran Soldes
  const renderBalances = () => (
    <Screen id="balances" title="Soldes">
      <Card title="Solde de chaque participant" level={3}>
        <p className="text-sm text-muted mb-3">
          Ce qu'il a payé moins sa part. Positif = on lui doit, Négatif = il doit.
          {isValid ? " ✓" : " ✗ Somme ≠ 0"}
        </p>
        {participants.length === 0 ? (
          <p className="text-center text-muted py-4">Ajoutez des participants et des dépenses.</p>
        ) : (
          <List>
            {balances.map((b) => (
              <Row
                key={b.participantId}
                icon={Euro}
                tone={b.balance >= 0 ? "in" : "out"}
                title={b.participantName}
                sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)}`}
                amount={b.balance / 100}
                end={b.balance >= 0 ? `+${formatCents(b.balance)}` : formatCents(b.balance)}
              />
            ))}
          </List>
        )}
        <div className="mt-3 text-right text-sm text-muted">
          Total des dépenses : {formatCents(totalExpenses)}
        </div>
      </Card>
    </Screen>
  );

  // Écran Remboursements
  const renderSettlements = () => (
    <Screen id="settlements" title="Remboursements">
      <Card title="Qui doit combien à qui" level={3}>
        <p className="text-sm text-muted mb-3">
          Les remboursements pour équilibrer les comptes, avec le moins de virements possible.
        </p>
        {settlements.length === 0 ? (
          <p className="text-center text-muted py-4">
            {participants.length === 0 
              ? "Ajoutez des participants et des dépenses."
              : "Tout est équilibré !"}
          </p>
        ) : (
          <List>
            {settlements.map((s, i) => (
              <Row
                key={`${s.from}-${s.to}-${i}`}
                icon={ArrowUpDown}
                tone="accent"
                title={`${s.fromName} → ${s.toName}`}
                amount={s.amount / 100}
                end={formatCents(s.amount)}
              />
            ))}
          </List>
        )}
      </Card>
    </Screen>
  );

  // Écran Réglages (vidage)
  const renderSettings = () => (
    <Screen id="settings" title="Réglages">
      <Card title="Données" level={3}>
        <p className="text-sm text-muted mb-3">
          Les données restent sur ce téléphone. Vous pouvez tout effacer.
        </p>
        <Button
          block
          variant="danger"
          icon={Trash2}
          onClick={() => setConfirmClear(true)}
        >
          Tout effacer (participants et dépenses)
        </Button>
      </Card>
    </Screen>
  );

  return (
    <>
      <AppShell
        bar={<AppBar title="Voyage entre amis" />}
        tabs={TABS}
        onAdd={() => {
          if (participants.length === 0) {
            toast("Ajoutez d'abord des participants", { tone: "error" });
            return;
          }
        }}
        addLabel="Ajouter une dépense"
      >
        {renderParticipants()}
        {renderExpenses()}
        {renderBalances()}
        {renderSettlements()}
        {renderSettings()}
      </AppShell>

      {confirmRemoveParticipant && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmRemoveParticipant(null)}
          title="Supprimer ce participant ?"
          text="Cette action est irréversible. Impossible s'il a des dépenses."
          confirmLabel="Supprimer"
          onConfirm={() => {
            const ok = removeParticipant(confirmRemoveParticipant);
            if (ok) toast("Participant supprimé");
            else toast("Impossible : participant utilisé dans une dépense", { tone: "error" });
            setConfirmRemoveParticipant(null);
          }}
        />
      )}

      {confirmRemoveExpense && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmRemoveExpense(null)}
          title="Supprimer cette dépense ?"
          text="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => {
            removeExpense(confirmRemoveExpense);
            toast("Dépense supprimée");
            setConfirmRemoveExpense(null);
          }}
        />
      )}

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Tous les participants et dépenses seront supprimés définitivement."
        confirmLabel="Tout effacer"
        onConfirm={() => {
          clearAll();
          toast("Tout a été effacé");
          setConfirmClear(false);
        }}
      />
    </>
  );
}

// Formulaire d'ajout de participant
function AddParticipantForm({ onAdd }: { onAdd: (name: string) => Participant | null }) {
  const [name, setName] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onAdd(name);
    if (result) {
      setName("");
      toast(`${result.name} ajouté`);
    } else if (name.trim()) {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <TextField
        label="Prénom"
        value={name}
        onChange={setName}
        placeholder="Marie"
      />
      <Button type="submit" icon={Plus}>Ajouter</Button>
    </form>
  );
}

// Composant pour la feuille de dépense personnalisée
function AddExpenseForm({
  participants,
  onAdd,
  onUpdate,
}: {
  participants: Participant[];
  onAdd: (expense: Omit<Expense, "id">) => Expense;
  onUpdate: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [sharedWithAll, setSharedWithAll] = useState(true);

  const openSheet = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setLabel(expense.label);
      setAmount(String(expense.amount / 100));
      setPaidBy(expense.paidBy);
      setSharedWith(expense.sharedWith);
      setSharedWithAll(expense.sharedWith.length === 0);
    } else {
      setEditingExpense(null);
      setLabel("");
      setAmount("");
      setPaidBy(participants[0]?.id || "");
      setSharedWith([]);
      setSharedWithAll(true);
    }
    setIsOpen(true);
  };

  const closeSheet = () => {
    setIsOpen(false);
    setEditingExpense(null);
    setLabel("");
    setAmount("");
    setPaidBy(participants[0]?.id || "");
    setSharedWith([]);
    setSharedWithAll(true);
  };

  const parseAmountToCents = (value: string): number => {
    const normalized = value.replace(",", ".");
    const parts = normalized.split(".");
    const euros = parseInt(parts[0] || "0", 10);
    const cents = (parts[1] || "").padEnd(2, "0").slice(0, 2);
    return euros * 100 + parseInt(cents, 10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (!label.trim() || !amountCents || !paidBy) return;

    const shared = sharedWithAll ? [] : sharedWith;
    
    if (editingExpense) {
      onUpdate(editingExpense.id, { label: label.trim(), amount: amountCents, paidBy, sharedWith: shared });
      toast("Dépense modifiée");
    } else {
      onAdd({ label: label.trim(), amount: amountCents, paidBy, sharedWith: shared, date: new Date().toISOString().split("T")[0] });
      toast("Dépense ajoutée");
    }
    closeSheet();
  };

  const toggleShared = (id: string) => {
    setSharedWith(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (!isOpen && !editingExpense) {
    return (
      <div className="mb-3">
        <ButtonRow>
          <Button block icon={Plus} onClick={() => openSheet()}>
            Ajouter une dépense
          </Button>
        </ButtonRow>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end px-4 pb-4" onClick={closeSheet}>
      <div className="bg-surface rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}</h2>
          <Button variant="plain" icon={X} onClick={closeSheet}>Fermer</Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField label="Libellé" value={label} onChange={setLabel} placeholder="Ex: Restaurant, Essence..." />
          
          <TextField 
            label="Montant (€)" 
            value={amount} 
            onChange={setAmount} 
            placeholder="Ex: 45,50"
            type="number"
          />
          
          <div>
            <label className="block text-sm font-medium mb-1">Payé par</label>
            <Segmented
              label="Payé par"
              options={participants.map(p => ({ value: p.id, label: p.name }))}
              value={paidBy}
              onChange={setPaidBy}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Partagé avec</label>
            <Switch
              checked={sharedWithAll}
              onChange={setSharedWithAll}
              label="Tout le monde"
            />
            {!sharedWithAll && participants.length > 0 && (
              <div className="mt-2 space-y-2">
                {participants.map(p => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sharedWith.includes(p.id)}
                      onChange={e => toggleShared(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <ButtonRow>
            <Button variant="plain" onClick={closeSheet}>Annuler</Button>
            <Button type="submit" icon={Check}>{editingExpense ? "Enregistrer" : "Ajouter"}</Button>
          </ButtonRow>
        </form>
      </div>
    </div>
  );
}