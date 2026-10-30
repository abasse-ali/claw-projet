// Écran des remboursements (qui doit combien à qui)

import { useMemo } from 'react';
import { ArrowRight, Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import { useTripStore } from '../lib/store';
import { Transfer } from '../lib/calculations';
import { formatCents } from '../lib/calculations';
import {
  Card,
  List,
  Row,
  Tile,
  Tiles,
  Badge,
  Empty,
  Hero,
} from '../kit/blocks';
import { Icon } from '../kit/icons';

export function TransfersScreen() {
  const { participants, getTransfers, getBalances } = useTripStore();
  const transfers = useMemo(() => getTransfers(), [getTransfers, participants]);
  const balances = useMemo(() => getBalances(), [getBalances, participants]);

  const totalToTransfer = useMemo(() =>
    transfers.reduce((sum, t) => sum + t.amount, 0),
    [transfers]
  );

  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      map.set(p.id, p.name);
    }
    return map;
  }, [participants]);

  if (participants.length === 0) {
    return (
      <Card>
        <Empty
          icon={AlertCircle}
          text="Ajoutez des participants pour voir les remboursements"
        />
      </Card>
    );
  }

  if (transfers.length === 0) {
    const totalPaid = balances.reduce((sum, b) => sum + b.paid, 0);
    if (totalPaid === 0) {
      return (
        <Card>
          <Empty
            icon={Wallet}
            text="Aucune dépense enregistrée"
            action={{ label: 'Ajouter une dépense', onClick: () => {} }}
          />
        </Card>
      );
    }
    return (
      <Card>
        <Empty
          icon={CheckCircle}
          text="Tous les comptes sont déjà équilibrés !"
        />
      </Card>
    );
  }

  return (
    <>
      <Hero
        label="Remboursements à faire"
        amount={totalToTransfer / 100}
        sub={`${transfers.length} virement${transfers.length > 1 ? 's' : ''} pour tout équilibrer`}
        pills={[
          { label: 'Total à virer', value: formatCents(totalToTransfer) },
          { label: 'Nombre de virements', value: transfers.length },
        ]}
      />

      <Card title="Qui doit combien à qui" level={3}>
        <List>
          {transfers.map((transfer, index) => {
            const fromName = participantNames.get(transfer.from) || '?';
            const toName = participantNames.get(transfer.to) || '?';

            return (
              <Row
                key={`${transfer.from}-${transfer.to}-${index}`}
                icon={ArrowRight}
                tone="accent"
                title={`${fromName} → ${toName}`}
                sub={`Virement de ${formatCents(transfer.amount)}`}
                amount={transfer.amount / 100}
                end={
                  <Badge tone="accent">
                    {fromName} paye {toName}
                  </Badge>
                }
              />
            );
          })}
        </List>
      </Card>

      <Card title="Comment ça marche" level={3}>
        <div className="text-sm text-muted space-y-2">
          <p>
            <strong>Algorithme :</strong> On minimise le nombre de virements en faisant payer
            les plus gros débiteurs aux plus gros créanciers en premier.
          </p>
          <p>
            <strong>Résultat :</strong> Après ces virements, tout le monde aura payé exactement
            sa part (au centime près).
          </p>
          <p>
            <strong>Somme des soldes :</strong> Toujours 0 € (vérifié automatiquement).
          </p>
        </div>
      </Card>

      <Card title="Détail par personne" level={3}>
        <List>
          {balances
            .slice()
            .sort((a, b) => b.balance - a.balance)
            .map((b) => {
              const status = b.balance > 0 ? 'reçoit' : b.balance < 0 ? 'paie' : 'équilibré';
              const tone = b.balance > 0 ? 'in' : b.balance < 0 ? 'out' : 'accent';

              return (
                <Row
                  key={b.participantId}
                  icon={Wallet}
                  tone={tone}
                  title={b.participantName}
                  sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)} · ${status} ${formatCents(Math.abs(b.balance))}`}
                  amount={b.balance / 100}
                  end={
                    <Badge tone={tone}>
                      {b.balance > 0 ? `+${formatCents(b.balance)}` : b.balance < 0 ? formatCents(b.balance) : '0 €'}
                    </Badge>
                  }
                />
              );
            })}
        </List>
      </Card>
    </>
  );
}