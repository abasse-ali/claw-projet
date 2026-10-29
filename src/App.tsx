// L'appli : suivi de budget à partir de relevés bancaires CSV.
// Onglets : Accueil (solde + opérations récentes), Opérations (liste complète avec catégorie modifiable),
// Bilan (dépenses par catégorie + graphique 6 mois), Réglages (budget mensuel, import/export, effacer).

import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  CreditCard,
  Download,
  FileText,
  FolderKanban,
  Home,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Upload,
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
  importCsv,
  money,
  openEntrySheet,
  persistentStore,
  pickCsv,
  seedOnce,
  toast,
  useEntries,
  useMonthEntries,
  useMonthTotals,
  type Category,
  type NewEntry,
} from "./kit";

// Aucune donnée de départ : l'utilisateur importe ses relevés CSV.
const SEED: NewEntry[] = [];
seedOnce(SEED);

// Budget mensuel réglable dans les réglages.
const useBudget = persistentStore("budget", { monthly: 0 });

// Catégories cohérentes avec l'auto-catégorisation du CSV.
const CATEGORIES: Category[] = [
  { name: "Courses", icon: Wallet },
  { name: "Transport", icon: CreditCard },
  { name: "Shopping", icon: Wallet },
  { name: "Santé", icon: CreditCard },
  { name: "Restaurants", icon: CreditCard },
  { name: "Énergie", icon: CreditCard },
  { name: "Télécom", icon: CreditCard },
  { name: "Logement", icon: Home },
  { name: "Assurance", icon: CreditCard },
  { name: "Revenus", icon: ArrowUpRight },
  { name: "Abonnements", icon: CreditCard },
  { name: "Loisirs", icon: CreditCard },
  { name: "Cadeaux", icon: CreditCard },
  { name: "Carburant", icon: CreditCard },
  { name: "Frais bancaires", icon: CreditCard },
  { name: "Autre", icon: FolderKanban },
];

const TABS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "operations", label: "Opérations", icon: FileText },
  { id: "bilan", label: "Bilan", icon: BarChart2 },
  { id: "reglages", label: "Réglages", icon: SettingsIcon },
];

export default function App() {
  const monthly = useBudget((state) => state.monthly);
  const month = useEntries((state) => state.month);
  const clear = useEntries((state) => state.clear);
  const entries = useMonthEntries();
  const { income, spending } = useMonthTotals();
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);

  const left = monthly - spending;
  const days = daysLeft(month);
  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) if (entry.amount < 0) sums.set(entry.category, (sums.get(entry.category) ?? 0) - entry.amount);
    return [...sums].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <>
      <AppShell
        bar={<MonthBar><IconButton icon={SettingsIcon} label="Réglages" href="#reglages" /></MonthBar>}
        tabs={TABS}
        onAdd={() => openEntrySheet()}
        addLabel="Ajouter une opération"
      >
        <Screen id="accueil" label="Accueil">
          <Hero
            label="Reste à dépenser"
            amount={left}
            sub={<>Budget du mois : <b>{money(monthly)}</b></>}
            pills={[
              { label: "Par jour", value: money(Math.max(0, left) / days), note: `${days} jours restants` },
              { label: "Dépensé", value: money(spending), note: "ce mois-ci" },
            ]}
            progress={{
              value: monthly > 0 ? spending / monthly : 0,
              label: "Budget du mois déjà dépensé",
              start: `${monthly > 0 ? Math.round((spending / monthly) * 100) : 0} % du budget dépensé`,
              end: money(monthly),
            }}
          />
          <Tiles>
            <Tile icon={ArrowUpRight} label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile icon={ArrowDownLeft} label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile icon={FileText} label="Opérations" value={entries.length} note="ce mois-ci" />
          </Tiles>
          <Card title="Dernières opérations" link={{ label: "Tout voir", href: "#operations" }}>
            <EntryList limit={5} />
          </Card>
        </Screen>

        <Screen id="operations" title="Opérations">
          <Tiles>
            <Tile label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile label="Opérations" value={entries.length} note="ce mois-ci" />
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
              <p className="text-center py-4 text-muted">Aucune dépense ce mois-ci.</p>
            )}
          </Card>
        </Screen>

        <Screen id="reglages" title="Réglages">
          <Card title="Mon budget" level={3}>
            <Settings>
              <Setting name="Budget du mois" note="ce que je peux dépenser ce mois-ci">
                <MoneyInput label="Budget du mois" value={monthly} onChange={(value) => useBudget.setState({ monthly: value })} />
              </Setting>
            </Settings>
          </Card>
          <Card title="Relevés bancaires" level={3}>
            <p className="mb-3">Importez un fichier CSV de votre banque (colonnes Date;Libellé;Montant, séparateur point-virgule). Les doublons (même date, libellé, montant) sont ignorés.</p>
            <div className="grid gap-2.5">
              <ButtonRow>
                <Button small icon={Download} onClick={exportCsv}>Exporter (copie)</Button>
                <Button
                  small
                  icon={Upload}
                  onClick={() => {
                    setImporting(true);
                    pickCsv();
                    setTimeout(() => setImporting(false), 1000);
                  }}
                  disabled={importing}
                >
                  {importing ? <Loader2 className="animate-spin h-4 w-4" /> : <>Importer CSV</>}
                </Button>
              </ButtonRow>
            </div>
          </Card>
          <Card title="Mes données" level={3}>
            <p className="mb-3">Elles restent sur ce téléphone. Gardez-en une copie de temps en temps.</p>
            <div className="grid gap-2.5">
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
