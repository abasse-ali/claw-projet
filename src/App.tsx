// L'appli budget : import relevés bancaires, catégorisation auto, solde mensuel et dépenses par catégorie.

import {
  ArrowDownCircle,
  ArrowRightLeft,
  Bus,
  ChartColumn,
  CreditCard,
  Download,
  Gamepad2,
  HeartPulse,
  Home,
  List as ListIcon,
  Receipt,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Trash2,
  Upload,
  Utensils,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  EntryList,
  EntrySheet,
  Hero,
  IconButton,
  Meter,
  Meters,
  MoneyInput,
  MonthBar,
  MonthsChart,
  Screen,
  Setting,
  Settings,
  Tile,
  Tiles,
  daysLeft,
  exportCsv,
  getAllCategories,
  money,
  openEntrySheet,
  persistentStore,
  pickBankCsv,
  seedOnce,
  toast,
  useEntries,
  useMonthEntries,
  useMonthTotals,
  type Category,
  type NewEntry,
} from "./kit";

const SEED: NewEntry[] = [];
seedOnce(SEED);

const CATEGORIES: Category[] = getAllCategories().map((name) => {
  const iconMap: Record<string, any> = {
    Courses: ShoppingCart,
    Transport: Bus,
    Logement: Home,
    Santé: HeartPulse,
    Restauration: Utensils,
    Shopping: ShoppingBag,
    Loisirs: Gamepad2,
    Banque: Wallet,
    Salaire: ArrowDownCircle,
    Virements: ArrowRightLeft,
    Autre: Tag,
  };
  return { name, icon: iconMap[name] || Tag };
});

const TABS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "operations", label: "Opérations", icon: ListIcon },
  { id: "bilan", label: "Bilan", icon: ChartColumn },
  { id: "reglages", label: "Réglages", icon: SettingsIcon },
];

export default function App() {
  const month = useEntries((state) => state.month);
  const clear = useEntries((state) => state.clear);
  const entries = useMonthEntries();
  const { income, spending, balance } = useMonthTotals();
  const [confirm, setConfirm] = useState(false);

  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) {
      if (entry.amount < 0) {
        sums.set(entry.category, (sums.get(entry.category) ?? 0) - entry.amount);
      }
    }
    return [...sums].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <>
      <AppShell
        bar={<MonthBar>
          <IconButton icon={SettingsIcon} label="Réglages" href="#reglages" />
        </MonthBar>}
        tabs={TABS}
        onAdd={() => openEntrySheet()}
        addLabel="Ajouter une opération"
      >
        <Screen id="accueil" label="Accueil">
          <Hero
            label="Solde du mois"
            amount={balance}
            sub={<>Dépenses : <b>{money(spending)}</b> · Rentrées : <b>{money(income)}</b></>}
            pills={[
              { label: "Par jour", value: money(spending / Math.max(1, daysLeft(month))), note: `${daysLeft(month)} jours restants` },
              { label: "Solde", value: money(balance), note: "ce mois-ci" },
            ]}
            progress={{
              value: income > 0 ? spending / income : 0,
              label: "Part des revenus dépensée",
              start: `${income > 0 ? Math.round((spending / income) * 100) : 0} % des revenus dépensés`,
              end: money(income),
            }}
          />
          <Tiles>
            <Tile icon={Wallet} label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile icon={Receipt} label="Opérations" value={entries.length} note="ce mois-ci" />
          </Tiles>
          <Card title="Dernières opérations" link={{ label: "Tout voir", href: "#operations" }}>
            <EntryList limit={4} />
          </Card>
        </Screen>

        <Screen id="operations" title="Opérations">
          <Tiles>
            <Tile label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile label="Solde" value={money(balance)} note="ce mois-ci" />
          </Tiles>
          <Card>
            <EntryList label="Opérations du mois" />
          </Card>
        </Screen>

        <Screen id="bilan" title="Bilan">
          <Card title="Rentrées et dépenses" meta="6 derniers mois" level={3}>
            <MonthsChart months={6} />
          </Card>
          <Card title="Dépenses par catégorie" level={3}>
            {byCategory.length ? (
              <Meters>
                {byCategory.map(([name, sum]) => (
                  <Meter key={name} name={name} value={spending ? sum / spending : 0} valueText={money(sum)} tone="out" />
                ))}
              </Meters>
            ) : (
              <p className="text-muted text-center py-4">Aucune dépense ce mois-ci.</p>
            )}
          </Card>
        </Screen>

        <Screen id="reglages" title="Réglages">
          <Card title="Importer un relevé bancaire" level={3}>
            <p className="text-muted text-sm mb-3">Sélectionnez le fichier CSV exporté par votre banque (colonnes Date;Libellé;Montant, séparateur point-virgule).</p>
            <Button block icon={Upload} onClick={pickBankCsv}>Importer un relevé</Button>
          </Card>
          <Card title="Mes données" level={3}>
            <p className="text-muted text-sm mb-3">Elles restent sur ce téléphone. Gardez-en une copie de temps en temps.</p>
            <div className="mt-3 grid gap-2.5">
              <ButtonRow>
                <Button small icon={Download} onClick={exportCsv}>Copie (CSV)</Button>
                <Button small icon={Upload} onClick={pickBankCsv}>Importer</Button>
              </ButtonRow>
              <Button small block variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>Tout effacer</Button>
            </div>
          </Card>
        </Screen>
      </AppShell>

      <EntrySheet categories={CATEGORIES} />
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Tout effacer ?"
        text="Les opérations de tous les mois seront effacées de ce téléphone."
        confirmLabel="Effacer"
        onConfirm={() => {
          const undo = clear();
          toast("Toutes les opérations sont effacées", { action: { label: "Annuler", run: undo } });
        }}
      />
    </>
  );
}