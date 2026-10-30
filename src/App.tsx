// Appli de partage de dépenses de voyage entre amis.
// - Ajouter participants (prénom unique)
// - Ajouter dépense : libellé, montant, qui a payé, pour qui (tous par défaut), parts égales
// - Solde de chacun (payé - part), au centime près, somme = 0
// - Remboursements minimaux (qui doit combien à qui)
// - Supprimer dépense ; pas de suppression participant s'il est dans une dépense
// - Données persistées dans localStorage

import {
  UserPlus,
  Users,
  Receipt,
  Calculator,
  ArrowLeftRight,
  Trash2,
  X,
  Plus,
  Edit2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  AppBar,
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
  TextField,
  toast,

  formatCents,
  parseCents,
  computeBalances,
  computeSettlements,
  useTripStore,
  type Participant,
  type Expense,
} from "./kit";

// Onglets de l'application
const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "remboursements", label: "Remb.", icon: ArrowLeftRight },
];

// Icônes pour les statuts de solde
const balanceTone = (balance: number) =>
  balance > 0 ? "in" : balance < 0 ? "out" : "accent";

export default function App() {
  const participants = useTripStore((s) => s.participants);
  const expenses = useTripStore((s) => s.expenses);
  const addParticipant = useTripStore((s) => s.addParticipant);
  const updateParticipant = useTripStore((s) => s.updateParticipant);
  const removeParticipant = useTripStore((s) => s.removeParticipant);
  const addExpense = useTripStore((s) => s.addExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);

  const [newParticipantName, setNewParticipantName] = useState("");
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<string | null>(null);
  const [confirmDeleteParticipant, setConfirmDeleteParticipant] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Calculs dérivés
  const balances = useMemo(() => computeBalances(), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(), [balances]);
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  // --- Actions participants ---
  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    const result = addParticipant(name);
    if (result) {
      setNewParticipantName("");
      toast("Participant ajouté");
    } else {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  const handleRemoveParticipant = (id: string) => {
    const used = expenses.some((e) => e.paidBy === id || e.splitAmong.includes(id));
    if (used) {
      toast("Ce participant a des dépenses, impossible de le supprimer", { tone: "error" });
      return;
    }
    setConfirmDeleteParticipant(id);
  };

  const confirmRemoveParticipant = (id: string) => {
    removeParticipant(id);
    setConfirmDeleteParticipant(null);
    toast("Participant supprimé");
  };

  // --- Actions dépenses ---
  const handleAddExpense = (data: {
    label: string;
    amount: number;
    paidBy: string;
    splitAmong: string[];
  }) => {
    addExpense({
      label: data.label.trim(),
      amount: data.amount,
      paidBy: data.paidBy,
      splitAmong: data.splitAmong,
    });
    toast("Dépense ajoutée");
  };

  const handleRemoveExpense = (id: string) => {
    removeExpense(id);
    setConfirmDeleteExpense(null);
    toast("Dépense supprimée");
  };

  // --- Rendu ---
  return (
    <>
      <AppShell
        bar={
          <AppBar title="Budget voyage">
            <IconButton icon={UserPlus} label="Ajouter participant" href="#participants" />
          </AppBar>
        }
        tabs={TABS}
      >
        {/* Écran Participants */}
        <Screen id="participants" title="Participants">
          <Card title="Ajouter un participant" level={3}>
            <div className="flex gap-2">
              <TextField
                label="Prénom"
                value={newParticipantName}
                onChange={setNewParticipantName}
                placeholder="Marie"
              />
              <Button icon={Plus} onClick={handleAddParticipant}>
                Ajouter
              </Button>
            </div>
          </Card>

          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Aucun participant pour l'instant"
              action={{ label: "Ajouter le premier", onClick: () => { (document.querySelector('input[placeholder="Marie"]') as HTMLInputElement)?.focus(); } }}
            />
          ) : (
            <Card title={`Participants (${participants.length})`} level={3}>
              <List>
                {participants.map((p) => {
                  const used = expenses.some(
                    (e) => e.paidBy === p.id || e.splitAmong.includes(p.id)
                  );
                  return (
                    <Row
                      key={p.id}
                      icon={Users}
                      title={p.name}
                      badge={used ? <span className="badge badge--accent">Utilisé</span> : undefined}
                      end={
                        <Button
                          small
                          variant="danger"
                          icon={Trash2}
                          onClick={() => handleRemoveParticipant(p.id)}
                          disabled={used}
                        >
                          Supprimer
                        </Button>
                      }
                    />
                  );
                })}
              </List>
            </Card>
          )}
        </Screen>

        {/* Écran Dépenses */}
        <Screen id="depenses" title="Dépenses">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez d'abord des participants"
            />
          ) : (
            <>
              <ExpenseForm
                participants={participants}
                onSubmit={handleAddExpense}
              />
              {expenses.length === 0 ? (
                <Empty
                  icon={Receipt}
                  text="Aucune dépense pour l'instant"
                />
              ) : (
                <Card title={`Dépenses (${expenses.length})`} level={3}>
                  <List>
                    {expenses
                      .slice()
                      .sort((a, b) => b.label.localeCompare(a.label))
                      .map((expense) => {
                        const payer = participants.find((p) => p.id === expense.paidBy);
                        const splitNames = expense.splitAmong
                          .map((id) => participants.find((p) => p.id === id)?.name)
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <Row
                            key={expense.id}
                            icon={Receipt}
                            tone="out"
                            title={expense.label}
                            sub={
                              <>
                                Payé par {payer?.name || "?"}
                                {expense.splitAmong.length > 0 && (
                                  <>
                                    {" · "}
                                    Pour : {splitNames || "tous"}
                                  </>
                                )}
                              </>
                            }
                            amount={-expense.amount / 100}
                            end={
                              <ButtonRow>
                                <Button small variant="danger" icon={Trash2} onClick={() => setConfirmDeleteExpense(expense.id)}>
                                  Supprimer
                                </Button>
                              </ButtonRow>
                            }
                          />
                        );
                      })}
                  </List>
                </Card>
              )}
            </>
          )}
        </Screen>

        {/* Écran Soldes */}
        <Screen id="soldes" title="Soldes">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour voir les soldes"
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Receipt}
              text="Ajoutez des dépenses pour calculer les soldes"
            />
          ) : (
            <>
              <Card title="Total des dépenses" level={3}>
                <Hero
                  label="Total"
                  amount={totalExpenses / 100}
                  sub={`${participants.length} participant(s), ${expenses.length} dépense(s)`}
                />
              </Card>

              <Card title="Solde de chacun (payé − part)" level={3}>
                <List>
                  {balances.map((b) => (
                    <Row
                      key={b.participantId}
                      icon={Calculator}
                      tone={balanceTone(b.balance)}
                      title={b.name}
                      sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)}`}
                      amount={b.balance / 100}
                    />
                  ))}
                </List>
                <p className="text-xs text-muted mt-2 text-center">
                  Somme des soldes : {formatCents(balances.reduce((s, b) => s + b.balance, 0))}
                </p>
              </Card>
            </>
          )}
        </Screen>

        {/* Écran Remboursements */}
        <Screen id="remboursements" title="Remboursements">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants"
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Receipt}
              text="Ajoutez des dépenses"
            />
          ) : settlements.length === 0 ? (
            <Card title="Tout est équilibré" level={3}>
              <Empty
                icon={Check}
                text="Personne ne doit rien à personne"
              />
            </Card>
          ) : (
            <Card title="Qui doit combien à qui" level={3}>
              <List>
                {settlements.map((s, i) => (
                  <Row
                    key={i}
                    icon={ArrowLeftRight}
                    tone="warn"
                    title={`${s.fromName} → ${s.toName}`}
                    amount={s.amount / 100}
                    sub={`Virement de ${formatCents(s.amount)}`}
                  />
                ))}
              </List>
              <p className="text-xs text-muted mt-2 text-center">
                {settlements.length} virement(s) pour équilibrer tout le monde
              </p>
            </Card>
          )}
        </Screen>
      </AppShell>

      {/* Modale confirmation suppression dépense */}
      {confirmDeleteExpense && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmDeleteExpense(null)}
          title="Supprimer cette dépense ?"
          text="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => handleRemoveExpense(confirmDeleteExpense!)}
        />
      )}

      {/* Modale confirmation suppression participant */}
      {confirmDeleteParticipant && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmDeleteParticipant(null)}
          title="Supprimer ce participant ?"
          text="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => confirmRemoveParticipant(confirmDeleteParticipant!)}
        />
      )}

      {/* Modale tout effacer */}
      <ConfirmModal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="Tout effacer ?"
        text="Tous les participants et dépenses seront supprimés définitivement."
        confirmLabel="Tout effacer"
        onConfirm={() => {
          useTripStore.getState().clearAll();
          setConfirmClearAll(false);
          toast("Tout a été effacé");
        }}
      />
    </>
  );
}

// Composant formulaire d'ajout/modification de dépense
function ExpenseForm({
  participants,
  onSubmit,
}: {
  participants: Participant[];
  onSubmit: (data: { label: string; amount: number; paidBy: string; splitAmong: string[] }) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(participants[0]?.id || "");
  const [splitAmong, setSplitAmong] = useState<string[]>(participants.map((p) => p.id));
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cents = parseCents(amount);
    if (cents === null || cents <= 0) {
      setError("Montant invalide");
      return;
    }
    if (!label.trim()) {
      setError("Libellé requis");
      return;
    }
    if (!paidBy) {
      setError("Choisissez qui a payé");
      return;
    }
    if (splitAmong.length === 0) {
      setError("Choisissez au moins un bénéficiaire");
      return;
    }

    onSubmit({
      label: label.trim(),
      amount: cents,
      paidBy,
      splitAmong,
    });

    setLabel("");
    setAmount("");
    setSplitAmong(participants.map((p) => p.id));
  };

  const allSelected = splitAmong.length === participants.length;
  const noneSelected = splitAmong.length === 0;

  return (
    <Card title="Nouvelle dépense" level={3}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <TextField
          label="Libellé"
          value={label}
          onChange={setLabel}
          placeholder="Ex: Courses, Restaurant, Essence..."
        />

        <TextField
          label="Montant"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Ex: 45,50"
        />

        <div>
          <label className="text-sm text-muted block mb-1">Payé par</label>
          <Chips
            options={participants.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            value={paidBy}
            onChange={setPaidBy}
            label="Payé par"
          />
        </div>

        <div>
          <label className="text-sm text-muted block mb-1">
            Partagé entre {allSelected ? "tous" : splitAmong.length === 0 ? "personne" : splitAmong.length + " personne(s)"}
          </label>
          <ButtonRow>
            <Button small variant={allSelected ? "primary" : "plain"} onClick={() => setSplitAmong(participants.map((p) => p.id))}>
              Tous
            </Button>
            <Button small variant={noneSelected ? "primary" : "plain"} onClick={() => setSplitAmong([])}>
              Aucun
            </Button>
          </ButtonRow>
          <div className="chips" role="group" aria-label="Partagé entre">
            {participants.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip${splitAmong.includes(p.id) ? " is-active" : ""}`}
                onClick={() => setSplitAmong((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <Button block type="submit" icon={Plus}>
          Ajouter la dépense
        </Button>
      </form>
    </Card>
  );
}