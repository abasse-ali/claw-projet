// Écran des dépenses

import { useState, useMemo } from 'react';
import { useScreen } from '../kit/layout';
import { Plus, Trash2, Receipt, User, Users, Calendar, Pencil } from 'lucide-react';
import { useTripStore } from '../lib/store';
import { Participant, Expense } from '../lib/calculations';
import { parseCents, formatCents, generateId } from '../lib/calculations';
import { today } from '../kit/format';
import {
  Card,
  List,
  Row,
  Empty,
  Badge,
} from '../kit/blocks';
import { Icon } from '../kit/icons';
import { toast } from '../kit/toast';
import { Segmented, ButtonRow, Button, TextField, MoneyInput, Chips } from '../kit/forms';
import { IconButton } from '../kit/layout';

type ExpenseFormData = {
  label: string;
  amount: string; // string pour garder la virgule
  paidBy: string;
  forWhom: string[];
  date: string;
};

export function ExpensesScreen() {
  const { participants, expenses, addExpense, removeExpense, getParticipant } = useTripStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, go] = useScreen();

  // État du formulaire
  const [formData, setFormData] = useState<ExpenseFormData>({
    label: '',
    amount: '',
    paidBy: '',
    forWhom: [],
    date: today(),
  });
  const [error, setError] = useState('');

  // Initialiser paidBy au premier participant
  const firstParticipant = useMemo(() => participants[0]?.id || '', [participants]);

  const resetForm = () => {
    setFormData({
      label: '',
      amount: '',
      paidBy: firstParticipant,
      forWhom: participants.map(p => p.id), // tout le monde par défaut
      date: today(),
    });
    setError('');
  };

  const handleSubmit = () => {
    if (!formData.label.trim()) {
      setError('Le libellé est obligatoire');
      return;
    }
    const amountCents = parseCents(formData.amount);
    if (amountCents <= 0) {
      setError('Le montant doit être positif');
      return;
    }
    if (!formData.paidBy) {
      setError('Choisissez qui a payé');
      return;
    }
    if (formData.forWhom.length === 0) {
      setError('Choisissez au moins une personne');
      return;
    }

    const expenseData = {
      label: formData.label.trim(),
      amount: amountCents,
      paidBy: formData.paidBy,
      forWhom: formData.forWhom,
      date: formData.date,
    };

    if (editingId) {
      // Pour updateExpense, on a besoin de l'id
      // On utilise removeExpense + addExpense pour simplifier
      removeExpense(editingId);
      addExpense(expenseData);
      toast('Dépense modifiée');
    } else {
      addExpense(expenseData);
      toast('Dépense ajoutée');
    }

    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    const paidByParticipant = getParticipant(expense.paidBy);
    setFormData({
      label: expense.label,
      amount: formatCents(expense.amount).replace(' €', '').replace(/\s/g, '').replace(',', ','),
      paidBy: expense.paidBy,
      forWhom: expense.forWhom.length > 0 ? expense.forWhom : participants.map(p => p.id),
      date: expense.date,
    });
    setEditingId(expense.id);
    setIsAdding(true);
  };

  const handleRemove = (id: string) => {
    removeExpense(id);
    toast('Dépense supprimée', {
      action: { label: 'Annuler', run: () => {} }, // undo pas simple ici
    });
  };

  const participantOptions = useMemo(() =>
    participants.map(p => ({ value: p.id, label: p.name })),
    [participants]
  );

  const paidByOptions = useMemo(() =>
    participants.map(p => ({ value: p.id, label: p.name })),
    [participants]
  );

  const totalExpenses = useMemo(() =>
    expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  // Pour l'affichage des montants dans la liste
  const formatAmount = (cents: number) => formatCents(cents);

  return (
    <>
      {participants.length === 0 ? (
        <Card>
          <Empty
            icon={Users}
            text="Ajoutez d'abord des participants"
            action={{ label: 'Aller aux participants', onClick: () => go('participants') }}
          />
        </Card>
      ) : (
        <>
          <Card title="Dépenses" meta={`${expenses.length} dépense${expenses.length > 1 ? 's' : ''} · ${formatAmount(totalExpenses)}`}>
            {expenses.length === 0 ? (
              <Empty
                icon={Receipt}
                text="Aucune dépense pour l'instant"
              />
            ) : (
              <List>
                {expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((expense) => {
                    const paidBy = getParticipant(expense.paidBy);
                    const forWhomNames = expense.forWhom.length === 0
                      ? 'Tous'
                      : expense.forWhom.map(id => getParticipant(id)?.name).filter(Boolean).join(', ');

                    return (
                      <Row
                        key={expense.id}
                        icon={Receipt}
                        tone="out"
                        title={expense.label}
                        sub={`${expense.date} · Payé par ${paidBy?.name || '?'} · Pour: ${forWhomNames}`}
                        amount={-expense.amount / 100} // négatif pour dépense
                        end={
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              small
                              variant="plain"
                              icon={Trash2}
                              onClick={() => handleRemove(expense.id)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        }
                        action={{
                          icon: Pencil,
                          label: `Modifier « ${expense.label} »`,
                          onClick: () => handleEdit(expense),
                        }}
                      />
                    );
                  })}
              </List>
            )}
          </Card>

          <Card title={editingId ? 'Modifier la dépense' : 'Ajouter une dépense'} level={3}>
            <TextField
              label="Libellé"
              value={formData.label}
              onChange={(v) => setFormData({ ...formData, label: v })}
              placeholder="Ex: Courses, Restaurant, Essence..."
              error={error}
            />

            <MoneyInput
              label="Montant"
              value={parseCents(formData.amount) / 100}
              onChange={(v) => setFormData({ ...formData, amount: v.toFixed(2).replace('.', ',') })}
            />

            <div className="field">
              <label>Payé par</label>
              <Segmented
                options={paidByOptions}
                value={formData.paidBy || firstParticipant}
                onChange={(v) => setFormData({ ...formData, paidBy: v })}
                label="Payé par"
              />
            </div>

            <div className="field">
              <label>Partagée entre</label>
              <Chips
                options={participantOptions}
                value={formData.forWhom}
                onChange={(v) => setFormData({ ...formData, forWhom: v })}
                label="Partagée entre"
              />
              <p className="field__help">
                {formData.forWhom.length === 0 ? 'Tout le monde (par défaut)' : `${formData.forWhom.length} personne${formData.forWhom.length > 1 ? 's' : ''} sélectionnée${formData.forWhom.length > 1 ? 's' : ''}`}
              </p>
            </div>

            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={(v) => setFormData({ ...formData, date: v })}
            />

            <ButtonRow>
              <Button block variant={editingId ? 'primary' : 'primary'} icon={Plus} onClick={handleSubmit}>
                {editingId ? 'Enregistrer' : 'Ajouter la dépense'}
              </Button>
              {editingId && (
                <Button block variant="plain" onClick={() => { setEditingId(null); resetForm(); }}>
                  Annuler
                </Button>
              )}
            </ButtonRow>
          </Card>
        </>
      )}
    </>
  );
}