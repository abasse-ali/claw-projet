// Écran des soldes

import { useMemo } from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight, Minus, User } from 'lucide-react';
import { useTripStore } from '../lib/store';
import { Balance } from '../lib/calculations';
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

export function BalancesScreen() {
  const { participants, getBalances } = useTripStore();
  const balances = useMemo(() => getBalances(), [getBalances, participants]);

  const totalPaid = useMemo(() =>
    balances.reduce((sum, b) => sum + b.paid, 0),
    [balances]
  );
  const totalShare = useMemo(() =>
    balances.reduce((sum, b) => sum + b.share, 0),
    [balances]
  );
  const totalBalance = useMemo(() =>
    balances.reduce((sum, b) => sum + b.balance, 0),
    [balances]
  );

  const creditors = useMemo(() =>
    balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance),
    [balances]
  );
  const debtors = useMemo(() =>
    balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance),
    [balances]
  );
  const settled = useMemo(() =>
    balances.filter(b => b.balance === 0),
    [balances]
  );

  if (participants.length === 0) {
    return (
      <Card>
        <Empty
          icon={User}
          text="Ajoutez des participants pour voir les soldes"
        />
      </Card>
    );
  }

  if (balances.length === 0 || totalPaid === 0) {
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
    <>
      <Hero
        label="Total des dépenses"
        amount={totalPaid / 100}
        sub={<>Réparti entre {participants.length} personne{participants.length > 1 ? 's' : ''}</>}
        pills={[
          { label: 'Payé au total', value: formatCents(totalPaid) },
          { label: 'Parts totales', value: formatCents(totalShare) },
          { label: 'Écart', value: formatCents(totalBalance), note: totalBalance === 0 ? 'Équilibré' : 'Attention' },
        ]}
      />

      <Tiles>
        <Tile icon={ArrowUpRight} label="À recevoir" value={formatCents(creditors.reduce((s, b) => s + b.balance, 0))} note={`${creditors.length} personne${creditors.length > 1 ? 's' : ''}`} />
        <Tile icon={ArrowDownRight} label="À payer" value={formatCents(Math.abs(debtors.reduce((s, b) => s + b.balance, 0)))} note={`${debtors.length} personne${debtors.length > 1 ? 's' : ''}`} />
        <Tile icon={Minus} label="Équilibrés" value={settled.length} note="personne(s)" />
      </Tiles>

      {creditors.length > 0 && (
        <Card title="Ils ont payé plus que leur part" level={3} meta={`${creditors.length} personne${creditors.length > 1 ? 's' : ''}`}>
          <List>
            {creditors.map((b) => (
              <Row
                key={b.participantId}
                icon={Wallet}
                tone="in"
                title={b.participantName}
                sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)}`}
                amount={b.balance / 100}
                end={<Badge tone="in">On lui doit</Badge>}
              />
            ))}
          </List>
        </Card>
      )}

      {debtors.length > 0 && (
        <Card title="Ils ont payé moins que leur part" level={3} meta={`${debtors.length} personne${debtors.length > 1 ? 's' : ''}`}>
          <List>
            {debtors.map((b) => (
              <Row
                key={b.participantId}
                icon={Wallet}
                tone="out"
                title={b.participantName}
                sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)}`}
                amount={b.balance / 100}
                end={<Badge tone="out">Il doit</Badge>}
              />
            ))}
          </List>
        </Card>
      )}

      {settled.length > 0 && (
        <Card title="Comptes équilibrés" level={3} meta={`${settled.length} personne${settled.length > 1 ? 's' : ''}`}>
          <List>
            {settled.map((b) => (
              <Row
                key={b.participantId}
                icon={Wallet}
                tone="accent"
                title={b.participantName}
                sub={`Payé ${formatCents(b.paid)} · Part ${formatCents(b.share)}`}
                amount={0}
                end={<Badge tone="accent">Équilibré</Badge>}
              />
            ))}
          </List>
        </Card>
      )}
    </>
  );
}