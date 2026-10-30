// Écran des participants

import { useState } from 'react';
import { useScreen } from '../kit/layout';
import { Plus, Trash2, User, AlertCircle } from 'lucide-react';
import { useTripStore } from '../lib/store';
import { formatCents } from '../lib/calculations';
import {
  Card,
  List,
  Row,
  Empty,
  Badge,
} from '../kit/blocks';
import { Button, TextField } from '../kit/forms';
import { Icon } from '../kit/icons';
import { toast } from '../kit/toast';

export function ParticipantsScreen() {
  const { participants, addParticipant, removeParticipant, canRemoveParticipant } = useTripStore();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [, go] = useScreen();

  const handleAdd = () => {
    const result = addParticipant(newName);
    if (result.success) {
      setNewName('');
      setError('');
      toast('Participant ajouté');
    } else {
      setError(result.error || 'Erreur');
    }
  };

  const handleRemove = (id: string) => {
    const result = removeParticipant(id);
    if (result.success) {
      toast('Participant supprimé', {
        action: {
          label: 'Annuler',
          run: () => {
            // Pour annuler, on devrait restaurer - pas implémenté simplement
          },
        },
      });
    } else {
      toast(result.error || 'Erreur', { tone: 'error' });
    }
  };

  const totalExpenses = useTripStore.getState().expenses.length;

  return (
    <>
      <Card title="Participants" meta={`${participants.length} personne${participants.length > 1 ? 's' : ''}`}>
        {participants.length === 0 ? (
          <Empty
            icon={User}
            text="Aucun participant pour l'instant"
            action={{ label: 'Ajouter le premier', onClick: () => go('participants') }}
          />
        ) : (
          <List>
            {participants.map((p) => {
              const canRemove = canRemoveParticipant(p.id);
              return (
                <Row
                  key={p.id}
                  icon={User}
                  tone="accent"
                  title={p.name}
                  badge={!canRemove && <Badge tone="warn">Dans une dépense</Badge>}
                  end={!canRemove ? undefined : (
                    <Button
                      small
                      variant="danger"
                      icon={Trash2}
                      onClick={() => handleRemove(p.id)}
                    >
                      Supprimer
                    </Button>
                  )}
                />
              );
            })}
          </List>
        )}
      </Card>

      <Card title="Ajouter un participant" level={3}>
        <TextField
          label="Prénom"
          value={newName}
          onChange={setNewName}
          placeholder="Ex: Marie"
          error={error}
          help="Un prénom par personne, pas de doublon"
        />
        <Button block icon={Plus} onClick={handleAdd} disabled={!newName.trim()}>
          Ajouter
        </Button>
      </Card>

      {participants.length > 0 && totalExpenses === 0 && (
        <Card level={3}>
          <p className="text-muted text-sm">
            Ajoutez des dépenses dans l'onglet « Dépenses » pour commencer le partage.
          </p>
        </Card>
      )}
    </>
  );
}