// Application de partage de dépenses de voyage entre amis
// Écrans : Accueil (voyages), Participants, Dépenses, Soldes/Remboursements, Réglages

import {
  Plus,
  Users,
  Receipt,
  CreditCard,
  Settings as SettingsIcon,
  Trash2,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Calculator,
  ArrowUpDown,
  Home,
  List,
  Wallet,
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
  List as ListComp,
  Row,
  Screen,
  Setting,
  Settings,
  Tile,
  Tiles,
  TextField,
  Segmented,
  Sheet,
  Modal,
  IconButton,
  openEntrySheet,
  toast,
  money,
  parseAmount,
} from "./kit";
import { formatCents, parseAmountCents, useTripStore, type Trip, type Participant, type Expense, type Reimbursement } from "./trip-store";
import { today } from "./kit/format";

const TABS = [
  { id: "accueil", label: "Voyages", icon: Home },
  { id: "participants", label: "Membres", icon: Users },
  { id: "depenses", label: "Dépenses", icon: Receipt },
  { id: "soldes", label: "Soldes", icon: Calculator },
  { id: "reglages", label: "Options", icon: SettingsIcon },
];

export default function App() {
  const trips = useTripStore((s) => s.trips);
  const activeTripId = useTripStore((s) => s.activeTripId);
  const createTrip = useTripStore((s) => s.createTrip);
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const getActiveTrip = useTripStore((s) => s.getActiveTrip);
  const addParticipant = useTripStore((s) => s.addParticipant);
  const removeParticipant = useTripStore((s) => s.removeParticipant);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const getBalances = useTripStore((s) => s.getBalances);
  const getReimbursements = useTripStore((s) => s.getReimbursements);
  const exportTrip = useTripStore((s) => s.exportTrip);
  const importTrip = useTripStore((s) => s.importTrip);

  const activeTrip = useMemo(() => getActiveTrip(), [getActiveTrip, activeTripId]);
  const participants = activeTrip?.participants ?? [];
  const expenses = activeTrip?.expenses ?? [];
  const balances = activeTrip ? getBalances(activeTrip.id) : new Map();
  const reimbursements = activeTrip ? getReimbursements(activeTrip.id) : [];

  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseAmountError, setExpenseAmountError] = useState(false);
  const [expensePayerId, setExpensePayerId] = useState<string>("");
  const [expenseParticipantIds, setExpenseParticipantIds] = useState<string[]>([]);
  const [expenseDate, setExpenseDate] = useState(today());
  const [showExport, setShowExport] = useState(false);
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<string | null>(null);
  const [confirmDeleteParticipant, setConfirmDeleteParticipant] = useState<string | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<string | null>(null);

  // Réinitialiser les formulaires quand le voyage change
  useEffect(() => {
    if (activeTrip) {
      const allIds = participants.map((p) => p.id);
      setExpenseParticipantIds(allIds);
      setExpensePayerId(participants[0]?.id ?? "");
    }
    setShowAddExpense(false);
    setEditingExpense(null);
    setShowAddParticipant(false);
  }, [activeTripId, participants]);

  // Ouvrir le formulaire d'ajout de dépense
  const openAddExpense = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseLabel(expense.label);
      setExpenseAmount(formatCents(expense.amountCents).replace(" €", "").replace(",", "."));
      setExpensePayerId(expense.payerId);
      setExpenseParticipantIds([...expense.participantIds]);
      setExpenseDate(expense.date);
    } else {
      setEditingExpense(null);
      setExpenseLabel("");
      setExpenseAmount("");
      const allIds = participants.map((p) => p.id);
      setExpenseParticipantIds(allIds);
      setExpensePayerId(participants[0]?.id ?? "");
      setExpenseDate(today());
    }
    setExpenseAmountError(false);
    setShowAddExpense(true);
  };

  const handleCreateTrip = () => {
    const name = newTripName.trim();
    if (!name) return;
    const trip = createTrip(name);
    setActiveTrip(trip.id);
    setNewTripName("");
    setShowCreateTrip(false);
    toast(`Voyage « ${name} » créé`);
  };

  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    const result = addParticipant(activeTripId!, name);
    if ("error" in result) {
      setParticipantError(result.error);
      return;
    }
    setNewParticipantName("");
    setParticipantError("");
    setShowAddParticipant(false);
    toast(`${name} ajouté`);
  };

  const handleRemoveParticipant = (participantId: string) => {
    const result = removeParticipant(activeTripId!, participantId);
    if ("error" in result && result.error) {
      toast(result.error, { tone: "error" });
    } else {
      toast("Participant supprimé");
    }
    setConfirmDeleteParticipant(null);
  };

  const handleSubmitExpense = () => {
    const amountCents = parseAmountCents(expenseAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setExpenseAmountError(true);
      return;
    }
    if (!expenseLabel.trim()) {
      setExpenseLabel(participants.find((p) => p.id === expensePayerId)?.name ?? "Dépense");
    }
    if (expenseParticipantIds.length === 0) {
      toast("Sélectionnez au moins un participant", { tone: "error" });
      return;
    }

    if (editingExpense) {
      // Pour modifier, on supprime et recrée (simplification)
      removeExpense(activeTripId!, editingExpense.id);
      addExpense(activeTripId!, {
        label: expenseLabel.trim(),
        amountCents,
        payerId: expensePayerId,
        participantIds: expenseParticipantIds,
        date: expenseDate,
      });
      toast("Dépense modifiée");
    } else {
      addExpense(activeTripId!, {
        label: expenseLabel.trim(),
        amountCents,
        payerId: expensePayerId,
        participantIds: expenseParticipantIds,
        date: expenseDate,
      });
      toast("Dépense ajoutée");
    }
    setShowAddExpense(false);
  };

  const handleRemoveExpense = (expenseId: string) => {
    removeExpense(activeTripId!, expenseId);
    toast("Dépense supprimée");
    setConfirmDeleteExpense(null);
  };

  const handleExport = () => {
    if (!activeTrip) return;
    const json = exportTrip(activeTrip.id);
    setExportJson(json);
    setShowExport(true);
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportJson);
    toast("Copié dans le presse-papiers");
  };

  const handleImport = () => {
    const result = importTrip(importJson);
    if (result.error) {
      setImportError(result.error);
    } else {
      setImportJson("");
      setImportError("");
      toast("Voyage importé");
    }
  };

  const handleDeleteTrip = (tripId: string) => {
    // Le store ne supprime pas directement, on filtre
    useTripStore.setState((state) => ({
      trips: state.trips.filter((t) => t.id !== tripId),
      activeTripId: state.activeTripId === tripId ? null : state.activeTripId,
    }));
    toast("Voyage supprimé");
    setConfirmDeleteTrip(null);
  };

  const getParticipantName = (id: string) => participants.find((p) => p.id === id)?.name ?? "?";

  const payerOptions = participants.map((p) => ({ value: p.id, label: p.name }));
  const participantOptions = participants.map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <AppShell
        bar={
          <header className="app-bar">
            <h1 className="app-bar__title">Voyages</h1>
            <span className="app-bar__spacer" />
            <IconButton
              icon={Plus}
              label="Nouveau voyage"
              onClick={() => setShowCreateTrip(true)}
            />
          </header>
        }
        tabs={TABS}
      >
        {/* ÉCRAN ACCUEIL - Liste des voyages */}
        <Screen id="accueil" label="Voyages">
          {trips.length === 0 ? (
            <Empty
              icon={Wallet}
              text="Aucun voyage pour l'instant"
              action={{ label: "Créer un voyage", onClick: () => setShowCreateTrip(true) }}
            />
          ) : (
            <ListComp label="Mes voyages">
              {trips.map((trip) => (
                <Row
                  key={trip.id}
                  icon={Wallet}
                  tone="accent"
                  title={trip.name}
                  sub={`${trip.participants.length} participant(s) · ${trip.expenses.length} dépense(s)`}
                  amount={0}
                  end={
                    activeTripId === trip.id ? (
                      <span className="badge badge--accent">Actif</span>
                    ) : (
                      <button
                        className="btn btn--plain btn--small"
                        onClick={() => setActiveTrip(trip.id)}
                      >
                        Ouvrir
                      </button>
                    )
                  }
                  action={{
                    icon: Trash2,
                    label: `Supprimer « ${trip.name} »`,
                    onClick: () => setConfirmDeleteTrip(trip.id),
                  }}
                />
              ))}
            </ListComp>
          )}
        </Screen>

        {/* ÉCRAN PARTICIPANTS */}
        <Screen id="participants" label="Participants" title={activeTrip?.name}>
          {!activeTrip ? (
            <Empty
              icon={Users}
              text="Sélectionnez ou créez un voyage dans l'onglet « Voyages »"
            />
          ) : participants.length === 0 ? (
            <Card title="Participants" level={3}>
              <Empty
                icon={Users}
                text="Aucun participant pour ce voyage"
                action={{ label: "Ajouter un participant", onClick: () => setShowAddParticipant(true) }}
              />
            </Card>
          ) : (
            <>
              <Card title="Participants" level={3}>
                <ListComp label="Liste des participants">
                  {participants.map((p) => (
                    <Row
                      key={p.id}
                      icon={Users}
                      tone="accent"
                      title={p.name}
                      sub={`${balances.get(p.id) ?? 0 > 0 ? "+" : ""}${formatCents(balances.get(p.id) ?? 0)}`}
                      action={{
                        icon: Trash2,
                        label: `Supprimer « ${p.name} »`,
                        onClick: () => setConfirmDeleteParticipant(p.id),
                      }}
                    />
                  ))}
                </ListComp>
              </Card>
              <div className="mt-3">
                <ButtonRow>
                  <Button block icon={Plus} onClick={() => setShowAddParticipant(true)}>
                    Ajouter un participant
                  </Button>
                </ButtonRow>
              </div>
            </>
          )}
        </Screen>

        {/* ÉCRAN DÉPENSES */}
        <Screen id="depenses" label="Dépenses" title={activeTrip?.name}>
          {!activeTrip ? (
            <Empty
              icon={Receipt}
              text="Sélectionnez ou créez un voyage dans l'onglet « Voyages »"
            />
          ) : expenses.length === 0 ? (
            <Card title="Dépenses" level={3}>
              <Empty
                icon={Receipt}
                text="Aucune dépense pour ce voyage"
                action={{ label: "Ajouter une dépense", onClick: () => openAddExpense() }}
              />
            </Card>
          ) : (
            <Card title="Dépenses" level={3}>
              <ListComp label="Toutes les dépenses">
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => {
                    const payer = participants.find((p) => p.id === expense.payerId);
                    const count = expense.participantIds.length;
                    return (
                      <Row
                        key={expense.id}
                        icon={CreditCard}
                        tone="out"
                        title={expense.label}
                        sub={
                          <>
                            Payé par {payer?.name ?? "?"}
                            {count < participants.length && (
                              <> · {count} sur {participants.length} participant(s)</>
                            )}
                          </>
                        }
                        amount={-expense.amountCents / 100}
                        end={expense.date}
                        action={{
                          icon: Edit,
                          label: `Modifier « ${expense.label} »`,
                          onClick: () => openAddExpense(expense),
                        }}
                      />
                    );
                  })}
              </ListComp>
            </Card>
          )}
        </Screen>

        {/* ÉCRAN SOLDES / REMBOURSEMENTS */}
        <Screen id="soldes" label="Soldes" title={activeTrip?.name}>
          {!activeTrip ? (
            <Empty
              icon={Calculator}
              text="Sélectionnez ou créez un voyage dans l'onglet « Voyages »"
            />
          ) : participants.length === 0 ? (
            <Empty
              icon={Users}
              text="Ajoutez des participants d'abord"
              action={{ label: "Aller aux participants", onClick: () => window.location.hash = "participants" }}
            />
          ) : expenses.length === 0 ? (
            <Empty
              icon={Calculator}
              text="Aucune dépense enregistrée"
              action={{ label: "Ajouter une dépense", onClick: () => openAddExpense() }}
            />
          ) : (
            <>
              <Card title="Solde de chacun" level={3}>
                <p className="text-muted text-sm mb-2">
                  Positif = à recevoir · Négatif = à payer
                </p>
                <ListComp label="Soldes">
                  {participants
                    .slice()
                    .sort((a, b) => (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0))
                    .map((p) => {
                      const balance = balances.get(p.id) ?? 0;
                      const tone = balance > 0 ? "in" : balance < 0 ? "out" : "accent";
                      return (
                        <Row
                          key={p.id}
                          icon={Wallet}
                          tone={tone}
                          title={p.name}
                          amount={balance / 100}
                          badge={balance === 0 ? <span className="badge badge--accent">Équilibré</span> : null}
                        />
                      );
                    })}
                </ListComp>
                <div className="mt-2 text-sm text-muted">
                  Somme des soldes : <b>{formatCents(Array.from(balances.values()).reduce((a, b) => a + b, 0))}</b>
                </div>
              </Card>

              <Card title="Qui doit combien à qui" level={3}>
                {reimbursements.length === 0 ? (
                  <Empty
                    icon={ArrowUpDown}
                    text="Tout le monde est à l'équilibre"
                  />
                ) : (
                  <ListComp label="Remboursements">
                    {reimbursements.map((r, i) => (
                      <Row
                        key={i}
                        icon={ArrowUpDown}
                        tone="warn"
                        title={`${r.fromName} → ${r.toName}`}
                        amount={r.amountCents / 100}
                        sub={`${r.fromName} paie ${formatCents(r.amountCents)} à ${r.toName}`}
                      />
                    ))}
                  </ListComp>
                )}
                <p className="mt-2 text-sm text-muted">
                  {reimbursements.length} virement{reimbursements.length > 1 ? "s" : ""} nécessaire{reimbursements.length > 1 ? "s" : ""}
                </p>
              </Card>
            </>
          )}
        </Screen>

        {/* ÉCRAN RÉGLAGES */}
        <Screen id="reglages" label="Réglages" title={activeTrip?.name ?? "Réglages"}>
          {!activeTrip ? (
            <Card title="Aucun voyage actif" level={3}>
              <p>Sélectionnez un voyage dans l'onglet « Voyages » pour accéder aux réglages.</p>
            </Card>
          ) : (
            <>
              <Card title="Voyage" level={3}>
                <Settings>
                  <Setting name="Nom du voyage" note={activeTrip.name}>
                    <TextField
                      label="Nom"
                      value={activeTrip.name}
                      onChange={(v) => {
                        useTripStore.setState((state) => ({
                          trips: state.trips.map((t) =>
                            t.id === activeTrip.id ? { ...t, name: v.trim() || "Sans nom" } : t
                          ),
                        }));
                      }}
                    />
                  </Setting>
                </Settings>
              </Card>

              <Card title="Données" level={3}>
                <p className="text-muted text-sm mb-3">
                  Les données sont stockées localement sur ce téléphone. Faites une copie de temps en temps.
                </p>
                <ButtonRow>
                  <Button small icon={Download} onClick={handleExport}>Exporter (JSON)</Button>
                  <Button small icon={Upload} onClick={() => setImportJson("")}>Importer (JSON)</Button>
                </ButtonRow>
                <div className="mt-3">
                  <Button block variant="danger" icon={Trash2} onClick={() => setConfirmDeleteTrip(activeTrip.id)}>
                    Supprimer ce voyage
                  </Button>
                </div>
              </Card>
            </>
          )}
        </Screen>
      </AppShell>

      {/* MODAL CRÉER VOYAGE */}
      <Modal
        open={showCreateTrip}
        onClose={() => setShowCreateTrip(false)}
        title="Nouveau voyage"
      >
        <div className="field">
          <label htmlFor="trip-name">Nom du voyage</label>
          <input
            id="trip-name"
            autoFocus
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            placeholder="Ex: Week-end à Lyon"
          />
        </div>
        <ButtonRow>
          <Button onClick={() => setShowCreateTrip(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleCreateTrip} disabled={!newTripName.trim()}>
            Créer
          </Button>
        </ButtonRow>
      </Modal>

      {/* SHEET AJOUTER PARTICIPANT */}
      <Sheet
        open={showAddParticipant}
        onClose={() => {
          setShowAddParticipant(false);
          setNewParticipantName("");
          setParticipantError("");
        }}
        title="Ajouter un participant"
      >
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleAddParticipant(); }}>
          <div className="field">
            <label htmlFor="participant-name">Prénom</label>
            <input
              id="participant-name"
              autoFocus
              value={newParticipantName}
              onChange={(e) => {
                setNewParticipantName(e.target.value);
                setParticipantError("");
              }}
              placeholder="Ex: Alice"
            />
            {participantError && <p className="field__error">{participantError}</p>}
          </div>
          <p className="text-muted text-sm">Les prénoms en double (même casse, espaces) sont refusés.</p>
          <ButtonRow>
            <Button type="button" onClick={() => setShowAddParticipant(false)}>Annuler</Button>
            <Button variant="primary" type="submit" disabled={!newParticipantName.trim()}>
              Ajouter
            </Button>
          </ButtonRow>
        </form>
      </Sheet>

      {/* SHEET AJOUTER/MODIFIER DÉPENSE */}
      <Sheet
        open={showAddExpense}
        onClose={() => {
          setShowAddExpense(false);
          setEditingExpense(null);
        }}
        title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
      >
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleSubmitExpense(); }}>
          <div className="field">
            <label htmlFor="expense-label">Libellé</label>
            <input
              id="expense-label"
              autoFocus
              value={expenseLabel}
              onChange={(e) => setExpenseLabel(e.target.value)}
              placeholder="Ex: Restaurant, Hébergement..."
            />
          </div>

          <div className={`field${expenseAmountError ? " is-invalid" : ""}`}>
            <label htmlFor="expense-amount">Montant (€)</label>
            <input
              id="expense-amount"
              inputMode="decimal"
              value={expenseAmount}
              onChange={(e) => {
                setExpenseAmount(e.target.value);
                setExpenseAmountError(false);
              }}
              placeholder="0,00"
            />
            <span aria-hidden="true">€</span>
            {expenseAmountError && <p className="field__error">Montant invalide (ex: 12,50)</p>}
          </div>

          <div className="field">
            <label>Qui a payé</label>
            <Segmented
              options={payerOptions}
              value={expensePayerId}
              onChange={setExpensePayerId}
              label="Payeur"
            />
          </div>

          <fieldset className="field">
            <legend>Pour qui (partage égal)</legend>
            {participantOptions.map((opt) => (
              <label key={opt.value} className="chip-label">
                <input
                  type="checkbox"
                  checked={expenseParticipantIds.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExpenseParticipantIds([...expenseParticipantIds, opt.value]);
                    } else {
                      setExpenseParticipantIds(expenseParticipantIds.filter((id) => id !== opt.value));
                    }
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="field">
            <label htmlFor="expense-date">Date</label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          <ButtonRow>
            <Button type="button" onClick={() => setShowAddExpense(false)}>Annuler</Button>
            <Button variant="primary" type="submit">{editingExpense ? "Enregistrer" : "Ajouter"}</Button>
          </ButtonRow>
        </form>
      </Sheet>

      {/* MODAL EXPORT */}
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Exporter le voyage">
        <div className="field">
          <label>JSON à copier</label>
          <textarea
            readOnly
            value={exportJson}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            rows={10}
            className="font-mono text-xs"
          />
        </div>
        <ButtonRow>
          <Button onClick={() => setShowExport(false)}>Fermer</Button>
          <Button variant="primary" icon={Download} onClick={handleCopyExport}>Copier</Button>
        </ButtonRow>
      </Modal>

      {/* MODAL IMPORT */}
      <Modal open={importJson !== ""} onClose={() => { setImportJson(""); setImportError(""); }} title="Importer un voyage">
        <div className="field">
          <label htmlFor="import-json">JSON du voyage</label>
          <textarea
            id="import-json"
            autoFocus
            value={importJson}
            onChange={(e) => { setImportJson(e.target.value); setImportError(""); }}
            rows={8}
            className="font-mono text-xs"
            placeholder="Collez le JSON exporté ici..."
          />
          {importError && <p className="field__error">{importError}</p>}
        </div>
        <ButtonRow>
          <Button onClick={() => { setImportJson(""); setImportError(""); }}>Annuler</Button>
          <Button variant="primary" onClick={handleImport} disabled={!importJson.trim()}>Importer</Button>
        </ButtonRow>
      </Modal>

      {/* CONFIRMATION SUPPRESSION VOYAGE */}
      <ConfirmModal
        open={!!confirmDeleteTrip}
        onClose={() => setConfirmDeleteTrip(null)}
        title="Supprimer ce voyage ?"
        text={`Le voyage « ${trips.find((t) => t.id === confirmDeleteTrip)?.name ?? ""} » et toutes ses données seront effacés définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={() => confirmDeleteTrip && handleDeleteTrip(confirmDeleteTrip)}
      />

      {/* CONFIRMATION SUPPRESSION PARTICIPANT */}
      <ConfirmModal
        open={!!confirmDeleteParticipant}
        onClose={() => setConfirmDeleteParticipant(null)}
        title="Supprimer ce participant ?"
        text={`Le participant « ${participants.find((p) => p.id === confirmDeleteParticipant)?.name ?? ""} » sera supprimé. Impossible s'il a des dépenses.`}
        confirmLabel="Supprimer"
        onConfirm={() => confirmDeleteParticipant && handleRemoveParticipant(confirmDeleteParticipant)}
      />

      {/* CONFIRMATION SUPPRESSION DÉPENSE */}
      <ConfirmModal
        open={!!confirmDeleteExpense}
        onClose={() => setConfirmDeleteExpense(null)}
        title="Supprimer cette dépense ?"
        text={expenses.find((e) => e.id === confirmDeleteExpense)?.label ?? ""}
        confirmLabel="Supprimer"
        onConfirm={() => confirmDeleteExpense && handleRemoveExpense(confirmDeleteExpense)}
      />
    </>
  );
}

// Style pour les labels de checkbox
const style = document.createElement("style");
style.textContent = `
  .chip-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    cursor: pointer;
    margin: 4px;
  }
  .chip-label input {
    accent-color: var(--accent);
  }
`;
document.head.appendChild(style);