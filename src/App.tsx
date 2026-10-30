// Appli de partage de dépenses de voyage entre amis.
// - Ajouter participants (prénom unique)
// - Ajouter dépense : libellé, montant, payeur, bénéficiaires (tous par défaut), parts égales
// - Soldes (payé - part) au centime près, somme = 0
// - Remboursements optimaux (min virements)
// - Supprimer dépense ; pas de suppression participant s'il est dans une dépense
// - Persistance localStorage

import {
  Users,
  Plus,
  Receipt,
  Calculator,
  Trash2,
  X,
  ArrowLeftRight,
  Check,
  Circle,
  UserPlus,
  UserMinus,
  Edit,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Empty,
  Hero,
  Icon,
  List,
  Row,
  Screen,
  Settings,
  Setting,
  Sheet,
  Tiles,
  Tile,
  TextField,
  toast,
  money,
} from "./kit";

import {
  useTripStore,
  computeBalances,
  computeSettlements,
  validateBalances,
  centsToEuros,
  parseAmountToCents,
  type Participant,
  type Expense,
  type Balance,
  type Settlement,
} from "./store";

const TABS = [
  { id: "participants", label: "Participants", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "remboursements", label: "Rembours.", icon: ArrowLeftRight },
] as const;

export default function App() {
  const participants = useTripStore((s) => s.participants);
  const expenses = useTripStore((s) => s.expenses);
  const addParticipant = useTripStore((s) => s.addParticipant);
  const removeParticipant = useTripStore((s) => s.removeParticipant);
  const updateParticipant = useTripStore((s) => s.updateParticipant);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);

  const balances = useMemo(() => computeBalances(participants, expenses), [participants, expenses]);
  const settlements = useMemo(() => computeSettlements(balances), [balances]);
  const balancesValid = useMemo(() => validateBalances(balances), [balances]);

  // États pour les modales/feuilles
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [editParticipantId, setEditParticipantId] = useState<string | null>(null);
  const [editParticipantName, setEditParticipantName] = useState("");

  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState<string>("");
  const [expenseSharedWith, setExpenseSharedWith] = useState<string[]>([]);
  const [expenseError, setExpenseError] = useState<string>("");

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "expense" | "participant"; id: string; name: string } | null>(null);

  // Calculer les bénéficiaires par défaut (tous)
  const allParticipantIds = useMemo(() => participants.map((p) => p.id), [participants]);

  // --- Gestion participants ---

  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    const result = addParticipant(name);
    if (result) {
      toast(`${name} ajouté`);
      setNewParticipantName("");
      setAddParticipantOpen(false);
    } else {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  const handleRemoveParticipant = (id: string, name: string) => {
    const success = removeParticipant(id);
    if (success) {
      toast(`${name} supprimé`);
    } else {
      setDeleteConfirm({ type: "participant", id, name });
    }
  };

  const handleEditParticipant = (id: string, name: string) => {
    setEditParticipantId(id);
    setEditParticipantName(name);
  };

  const handleSaveEditParticipant = () => {
    if (!editParticipantId) return;
    const name = editParticipantName.trim();
    if (!name) return;
    const success = updateParticipant(editParticipantId, name);
    if (success) {
      toast("Prénom modifié");
      setEditParticipantId(null);
      setEditParticipantName("");
    } else {
      toast("Ce prénom existe déjà", { tone: "error" });
    }
  };

  // --- Gestion dépenses ---

  const openExpenseSheet = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseLabel(expense.label);
      setExpenseAmount(centsToEuros(expense.amount).toFixed(2).replace(".", ","));
      setExpensePaidBy(expense.paidBy);
      setExpenseSharedWith(expense.sharedWith.length ? expense.sharedWith : allParticipantIds);
    } else {
      setEditingExpense(null);
      setExpenseLabel("");
      setExpenseAmount("");
      setExpensePaidBy(participants[0]?.id || "");
      setExpenseSharedWith(allParticipantIds);
    }
    setExpenseError("");
    setExpenseSheetOpen(true);
  };

  const handleSaveExpense = () => {
    const amountCents = parseAmountToCents(expenseAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setExpenseError("Montant invalide");
      return;
    }
    if (!expenseLabel.trim()) {
      setExpenseError("Libellé requis");
      return;
    }
    if (!expensePaidBy) {
      setExpenseError("Choisir qui a payé");
      return;
    }
    if (expenseSharedWith.length === 0) {
      setExpenseError("Au moins un bénéficiaire");
      return;
    }

    const data = {
      label: expenseLabel.trim(),
      amount: amountCents,
      paidBy: expensePaidBy,
      sharedWith: expenseSharedWith,
    };

    if (editingExpense) {
      updateExpense(editingExpense.id, data);
      toast("Dépense modifiée");
    } else {
      addExpense(data);
      toast("Dépense ajoutée");
    }
    setExpenseSheetOpen(false);
  };

  const handleRemoveExpense = (id: string, label: string) => {
    setDeleteConfirm({ type: "expense", id, name: label });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "expense") {
      removeExpense(deleteConfirm.id);
      toast(`« ${deleteConfirm.name} » supprimée`);
    }
    setDeleteConfirm(null);
  };

  // --- Rendu ---

  const totalPaid = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalParticipants = participants.length;

  return (
    <>
      <AppShell
        bar={
          <div className="app-bar">
            <h1 className="app-bar__title">Voyage</h1>
            <span className="app-bar__count">{totalParticipants} participant{totalParticipants > 1 ? "s" : ""}</span>
          </div>
        }
        tabs={TABS}
        onAdd={() => participants.length > 0 ? openExpenseSheet() : setAddParticipantOpen(true)}
        addLabel={participants.length > 0 ? "Ajouter une dépense" : "Ajouter un participant"}
      >
        {/* --- Onglet Participants --- */}
        <Screen id="participants" label="Participants">
          {participants.length === 0 ? (
            <Empty
              icon={UserPlus}
              text="Aucun participant pour l'instant."
              action={{ label: "Ajouter le premier", onClick: () => setAddParticipantOpen(true) }}
            />
          ) : (
            <>
              <Tiles>
                <Tile
                  icon={Users}
                  label="Participants"
                  value={participants.length}
                  note="au total"
                />
                <Tile
                  icon={Receipt}
                  label="Dépenses"
                  value={expenses.length}
                  note="enregistrées"
                />
                <Tile
                  icon={Calculator}
                  label="Total payé"
                  value={money(centsToEuros(totalPaid))}
                  note="aujourd'hui"
                />
              </Tiles>
              <Card title="Liste des participants">
                <List label="Participants">
                  {participants.map((p) => {
                    const usedInExpenses = expenses.some(
                      (e) => e.paidBy === p.id || e.sharedWith.includes(p.id)
                    );
                    return (
                      <Row
                        key={p.id}
                        icon={Users}
                        tone="accent"
                        title={p.firstName}
                        badge={editParticipantId === p.id && <span className="badge badge--accent">Modification</span>}
                        sub={usedInExpenses ? "Impliqué dans des dépenses" : "Peut être supprimé"}
                        end={editParticipantId === p.id ? (
                          <ButtonRow>
                            <Button
                              small
                              icon={Check}
                              onClick={handleSaveEditParticipant}
                            >
                              OK
                            </Button>
                            <Button
                              small
                              variant="plain"
                              icon={X}
                              onClick={() => setEditParticipantId(null)}
                            >
                              Annuler
                            </Button>
                          </ButtonRow>
                        ) : (
                          <div className="row-actions">
                            <Button
                              small
                              variant="plain"
                              icon={Edit}
                              onClick={() => handleEditParticipant(p.id, p.firstName)}
                              aria-label={`Modifier ${p.firstName}`}
                            />
                            {!usedInExpenses && (
                              <Button
                                small
                                variant="plain"
                                icon={Trash2}
                                onClick={() => handleRemoveParticipant(p.id, p.firstName)}
                                aria-label={`Supprimer ${p.firstName}`}
                              />
                            )}
                          </div>
                        )}
                      />
                    );
                  })}
                </List>
              </Card>
            </>
          )}
        </Screen>

        {/* --- Onglet Dépenses --- */}
        <Screen id="depenses" label="Dépenses">
          {participants.length === 0 ? (
            <Empty
              icon={UserPlus}
              text="Ajoutez d'abord des participants."
              action={{ label: "Ajouter un participant", onClick: () => setAddParticipantOpen(true) }}
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Receipt}
              text="Aucune dépense pour ce voyage."
              action={{ label: "Ajouter la première", onClick: () => openExpenseSheet() }}
            />
          ) : (
            <Card title="Dépenses enregistrées">
              <List label="Dépenses">
                {expenses
                  .slice()
                  .sort((a, b) => b.label.localeCompare(a.label))
                  .map((expense) => {
                    const payer = participants.find((p) => p.id === expense.paidBy);
                    const beneficiaries = participants.filter((p) =>
                      expense.sharedWith.length ? expense.sharedWith.includes(p.id) : true
                    );
                    return (
                      <Row
                        key={expense.id}
                        icon={Receipt}
                        tone="out"
                        title={expense.label}
                        sub={
                          <>
                            Payé par <b>{payer?.firstName || "?"}</b>{" "}
                            · Partagé avec{" "}
                            <b>
                              {expense.sharedWith.length === 0
                                ? "tous"
                                : beneficiaries.map((b) => b.firstName).join(", ")}
                            </b>
                          </>
                        }
                        amount={centsToEuros(expense.amount)}
                        action={{
                          icon: Edit,
                          label: `Modifier « ${expense.label} »`,
                          onClick: () => openExpenseSheet(expense),
                        }}
                        end={
                          <Button
                            small
                            variant="plain"
                            icon={Trash2}
                            onClick={() => handleRemoveExpense(expense.id, expense.label)}
                            aria-label={`Supprimer ${expense.label}`}
                          />
                        }
                      />
                    );
                  })}
              </List>
            </Card>
          )}
        </Screen>

        {/* --- Onglet Soldes --- */}
        <Screen id="soldes" label="Soldes">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour voir les soldes."
              action={{ label: "Ajouter un participant", onClick: () => setAddParticipantOpen(true) }}
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Calculator}
              text="Aucune dépense enregistrée."
              action={{ label: "Ajouter une dépense", onClick: () => openExpenseSheet() }}
            />
          ) : (
            <>
              <Card title="Solde de chaque participant" meta={balancesValid ? "✓ Vérifié" : "⚠ Erreur"}>
                <List label="Soldes">
                  {balances.map((b) => {
                    const participant = participants.find((p) => p.id === b.participantId);
                    const isPositive = b.balance > 0;
                    const isNegative = b.balance < 0;
                    return (
                      <Row
                        key={b.participantId}
                        icon={isPositive ? Check : isNegative ? X : Circle}
                        tone={isPositive ? "in" : isNegative ? "out" : "accent"}
                        title={participant?.firstName || "Inconnu"}
                        sub={
                          <>
                            Payé : <b>{money(centsToEuros(b.paid))}</b>{" "}
                            · Part : <b>{money(centsToEuros(b.share))}</b>
                          </>
                        }
                        amount={centsToEuros(b.balance)}
                        end={
                          <Badge tone={isPositive ? "in" : isNegative ? "out" : "accent"}>
                            {isPositive ? "On lui doit" : isNegative ? "Il doit" : "Équilibré"}
                          </Badge>
                        }
                      />
                    );
                  })}
                </List>
              </Card>

              <Card title="Détail des calculs">
                <p className="text-muted text-sm mb-3">
                  Chaque dépense est divisée en parts égales au centime près.
                  Le reste de la division (centimes restants) est réparti sur les premiers bénéficiaires.
                </p>
                <div className="grid gap-2 text-sm">
                  {expenses.map((expense) => {
                    const payer = participants.find((p) => p.id === expense.paidBy);
                    const beneficiaries = expense.sharedWith.length
                      ? expense.sharedWith.map((id) => participants.find((p) => p.id === id)).filter(Boolean)
                      : participants;
                    const shareCount = beneficiaries.length;
                    const baseShare = Math.floor(expense.amount / shareCount);
                    const remainder = expense.amount % shareCount;

                    return (
                      <div key={expense.id} className="p-3 bg-surface rounded-lg border border-line">
                        <p className="font-medium">
                          {expense.label} - {money(centsToEuros(expense.amount))} payé par {payer?.firstName}
                        </p>
                        <p className="text-muted mt-1">
                          {shareCount} bénéficiaire{shareCount > 1 ? "s" : ""} → {shareCount - remainder} ×{" "}
                          {money(centsToEuros(baseShare))} + {remainder} ×{" "}
                          {money(centsToEuros(baseShare + 1))} ={" "}
                          {money(centsToEuros(baseShare * shareCount + remainder))}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {beneficiaries.map((b, i) => `${b?.firstName}: ${money(centsToEuros(baseShare + (i < remainder ? 1 : 0)))}`).join("  •  ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </Screen>

        {/* --- Onglet Remboursements --- */}
        <Screen id="remboursements" label="Remboursements">
          {participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants pour calculer les remboursements."
              action={{ label: "Ajouter un participant", onClick: () => setAddParticipantOpen(true) }}
            />
          ) : settlements.length === 0 ? (
            <Empty
              icon={Check}
              text="Tout est équilibré ! Personne ne doit rien à personne."
              icon={Circle}
            />
          ) : (
            <>
              <Card title="Remboursements à faire" meta={`${settlements.length} virement${settlements.length > 1 ? "s" : ""} nécessaire${settlements.length > 1 ? "s" : ""}`}>
                <List label="Remboursements">
                  {settlements.map((s, index) => {
                    const from = participants.find((p) => p.id === s.from);
                    const to = participants.find((p) => p.id === s.to);
                    return (
                      <Row
                        key={`${s.from}-${s.to}-${index}`}
                        icon={ArrowLeftRight}
                        tone="warn"
                        title={`${from?.firstName} → ${to?.firstName}`}
                        sub={`Virement de ${money(centsToEuros(s.amount))}`}
                        amount={centsToEuros(s.amount)}
                        badge={<Badge tone="warn">À faire</Badge>}
                      />
                    );
                  })}
                </List>
              </Card>

              <Card title="Comment ça marche">
                <p className="text-muted text-sm mb-3">
                  L'algorithme minimise le nombre de virements : les plus gros débiteurs paient
                  d'abord les plus gros créanciers, jusqu'à ce que tout soit équilibré.
                </p>
                <div className="space-y-2 text-sm">
                  {(() => {
                    // Recalculer pour montrer la logique
                    const debtors = balances
                      .filter((b) => b.balance < 0)
                      .map((b) => ({ ...b, amount: -b.balance }))
                      .sort((a, b) => b.amount - a.amount);
                    const creditors = balances
                      .filter((b) => b.balance > 0)
                      .map((b) => ({ ...b, amount: b.balance }))
                      .sort((a, b) => b.amount - a.amount);

                    return (
                      <>
                        <p>
                          <b>Débiteurs :</b>{" "}
                          {debtors.map((d) => {
                            const p = participants.find((x) => x.id === d.participantId);
                            return `${p?.firstName} (${money(centsToEuros(d.amount))})`;
                          }).join(", ") || "aucun"}
                        </p>
                        <p>
                          <b>Créanciers :</b>{" "}
                          {creditors.map((c) => {
                            const p = participants.find((x) => x.id === c.participantId);
                            return `${p?.firstName} (${money(centsToEuros(c.amount))})`;
                          }).join(", ") || "aucun"}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </Card>
            </>
          )}
        </Screen>
      </AppShell>

      {/* --- Modale ajout participant --- */}
      <Sheet
        open={addParticipantOpen}
        onClose={() => {
          setAddParticipantOpen(false);
          setNewParticipantName("");
        }}
        title="Ajouter un participant"
      >
        <div className="form">
          <div className="field">
            <label htmlFor="participant-name">Prénom</label>
            <input
              id="participant-name"
              autoComplete="off"
              placeholder="Prénom"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-muted text-sm">
            Chaque participant doit avoir un prénom unique (insensible à la casse et aux espaces).
          </p>
          <ButtonRow>
            <Button block variant="primary" icon={Plus} onClick={handleAddParticipant}>
              Ajouter
            </Button>
            <Button block variant="plain" onClick={() => setAddParticipantOpen(false)}>
              Annuler
            </Button>
          </ButtonRow>
        </div>
      </Sheet>

      {/* --- Feuille ajout/modification dépense --- */}
      <Sheet
        open={expenseSheetOpen}
        onClose={() => {
          setExpenseSheetOpen(false);
          setEditingExpense(null);
        }}
        title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
      >
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleSaveExpense(); }} noValidate>
          <div className="field">
            <label htmlFor="expense-label">Libellé</label>
            <input
              id="expense-label"
              autoComplete="off"
              placeholder="Ex: Courses, Restaurant, Essence…"
              value={expenseLabel}
              onChange={(e) => setExpenseLabel(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="expense-amount">Montant (€)</label>
            <input
              id="expense-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              aria-invalid={!!expenseError}
            />
            {expenseError && <p className="field__error">{expenseError}</p>}
          </div>

          <div className="field">
            <label htmlFor="expense-paidby">Payé par</label>
            <select
              id="expense-paidby"
              value={expensePaidBy}
              onChange={(e) => setExpensePaidBy(e.target.value)}
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="field">
            <legend>Partagé avec (par défaut : tout le monde)</legend>
            {participants.map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={expenseSharedWith.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExpenseSharedWith([...expenseSharedWith, p.id]);
                    } else {
                      setExpenseSharedWith(expenseSharedWith.filter((id) => id !== p.id));
                    }
                  }}
                />
                <span>{p.firstName}</span>
              </label>
            ))}
          </fieldset>

          <ButtonRow>
            <Button block variant="primary" type="submit" icon={editingExpense ? Check : Plus}>
              {editingExpense ? "Enregistrer" : "Ajouter"}
            </Button>
            <Button block variant="plain" onClick={() => setExpenseSheetOpen(false)}>
              Annuler
            </Button>
          </ButtonRow>
        </form>
      </Sheet>

      {/* --- Confirmation suppression --- */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={deleteConfirm ? (deleteConfirm.type === "expense" ? "Supprimer la dépense ?" : "Supprimer le participant ?") : ""}
        text={deleteConfirm
          ? deleteConfirm.type === "expense"
            ? `La dépense « ${deleteConfirm.name} » sera supprimée définitivement.`
            : `Le participant « ${deleteConfirm.name} » apparaît dans au moins une dépense. Il ne peut pas être supprimé.`
          : ""}
        confirmLabel="Supprimer"
        cancelLabel="Garder"
        onConfirm={confirmDelete}
      />
    </>
  );
}