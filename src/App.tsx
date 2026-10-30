// L'appli de partage de dépenses entre amis
// Écrans : Participants, Dépenses, Soldes, Remboursements

import { Users, Receipt, Wallet, ArrowRight, Settings as SettingsIcon, Plus } from 'lucide-react';
import { useMemo } from 'react';
import {
  AppShell,
  MonthBar,
  IconButton,
  Screen,
  Card,
  Empty,
  Button,
} from './kit';
import { useTripStore } from './lib/store';
import { ParticipantsScreen } from './screens/ParticipantsScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { BalancesScreen } from './screens/BalancesScreen';
import { TransfersScreen } from './screens/TransfersScreen';
import { toast } from './kit/toast';
import { ConfirmModal } from './kit/sheet';
import { useState } from 'react';

const TABS = [
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'expenses', label: 'Dépenses', icon: Receipt },
  { id: 'balances', label: 'Soldes', icon: Wallet },
  { id: 'transfers', label: 'Remb.', icon: ArrowRight },
];

export default function App() {
  const { participants, expenses, clearAll } = useTripStore();
  const [confirmClear, setConfirmClear] = useState(false);

  const totalExpenses = useMemo(() =>
    expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const handleClearAll = () => {
    clearAll();
    toast('Tout a été effacé', {
      action: { label: 'Annuler', run: () => {} },
    });
    setConfirmClear(false);
  };

  return (
    <>
      <AppShell
        bar={
          <MonthBar>
            <IconButton
              icon={SettingsIcon}
              label="Réinitialiser"
              onClick={() => setConfirmClear(true)}
            />
          </MonthBar>
        }
        tabs={TABS}
      >
        <Screen id="participants" title="Participants" onAdd={() => {}}>
          <ParticipantsScreen />
        </Screen>

        <Screen id="expenses" title="Dépenses" onAdd={() => {}}>
          <ExpensesScreen />
        </Screen>

        <Screen id="balances" title="Soldes">
          <BalancesScreen />
        </Screen>

        <Screen id="transfers" title="Remboursements">
          <TransfersScreen />
        </Screen>
      </AppShell>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Cela supprimera tous les participants et toutes les dépenses. Cette action est irréversible."
        confirmLabel="Tout effacer"
        onConfirm={handleClearAll}
      />
    </>
  );
}