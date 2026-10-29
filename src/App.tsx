// L'appli : suivi de budget à partir des relevés bancaires.
// Importe les fichiers CSV de la banque, catégorise automatiquement, déduit les doublons.

import {
  Banknote,
  ChartColumn,
  Download,
  FileText,
  HeartPulse,
  House,
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
import { CATEGORY_KEYWORDS } from "./kit/categories";

// Les catégories disponibles dans l'appli
const CATEGORIES: Category[] = [
  { name: "Courses", icon: ShoppingCart },
  { name: "Transport", icon: Wallet }, // Using Wallet as transport icon for variety
  { name: "Logement", icon: House },
  { name: "Santé", icon: HeartPulse },
  { name: "Loisirs", icon: Utensils },
  { name: "Shopping", icon: ShoppingBag },
  { name: "Restaurants", icon: Utensils },
  { name: "Banque", icon: Banknote },
  { name: "Autre", icon: Tag },
];

const TABS = [
  { id: "accueil", label: "Accueil", icon: House },
  { id: "operations", label: "Opérations", icon: ListIcon },
  { id: "bilan", label: "Bilan", icon: ChartColumn },
  { id: "reglages", label: "Réglages", icon: SettingsIcon },
];

export default function App() {
  const monthly = persistentStore("budget", { monthly: 0 });
  const budget = monthly((state) => state.monthly);
  const setBudget = monthly((state) => state.setState);
  const month = useEntries((state) => state.month);
  const clear = useEntries((state) => state.clear);
  const entries = useMonthEntries();
  const { income, spending } = useMonthTotals();
  const [confirm, setConfirm] = useState(false);

  const left = budget - spending;
  const days = daysLeft(month);
  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) if (entry.amount < 0) sums.set(entry.category, (sums.get(entry.category) ?? 0) - entry.amount);
    return [...sums].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <>
      <AppShell
        bar={
          <MonthBar>
            <IconButton icon={SettingsIcon} label="Réglages" href="#reglages" />
          </MonthBar>
        }
        tabs={TABS}
        onAdd={() => openEntrySheet()}
        addLabel="Ajouter une opération"
      >
        <Screen id="accueil" label="Accueil">
          <Hero
            label="Reste à dépenser"
            amount={left}
            sub={<>Budget du mois : <b>{money(budget)}</b></>}
            pills={[
              { label: "Par jour", value: money(Math.max(0, left) / days), note: `${days} jours restants` },
              { label: "Dépensé", value: money(spending), note: "ce mois-ci" },
            ]}
            progress={{
              value: budget > 0 ? spending / budget : 0,
              label: "Budget du mois déjà dépensé",
              start: `${budget > 0 ? Math.round((spending / budget) * 100) : 0} % du budget dépensé`,
              end: money(budget),
            }}
          />
          <Tiles>
            <Tile icon={Wallet} label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile icon={Receipt} label="Opérations" value={entries.length} note="ce mois-ci" />
          </Tiles>
          <Card title="Dernières opérations" link={{ label: "Tout voir", href: "#operations" }}>
            <EntryList limit={4} />
          </Card>
          <Card title="Importer un relevé" level={3}>
            <p className="text-sm text-muted mb-3">
              Sélectionnez le fichier CSV exporté par votre banque (colonnes Date;Libellé;Montant, séparées par des points-virgules).
            </p>
            <ButtonRow>
              <Button icon={FileText} onClick={pickCsv} block>Importer un relevé</Button>
            </ButtonRow>
            <p className="text-xs text-muted mt-2">
              Les opérations sont classées automatiquement (CARREFOUR → Courses, SNCF → Transport…).
              Vous pouvez changer la catégorie à tout moment en modifiant l'opération.
            </p>
          </Card>
        </Screen>

        <Screen id="operations" title="Opérations">
          <Tiles>
            <Tile label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile label="Rentrées" value={money(income)} note="ce mois-ci" />
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
              <p>Aucune dépense ce mois-ci.</p>
            )}
          </Card>
        </Screen>

        <Screen id="reglages" title="Réglages">
          <Card title="Mon budget" level={3}>
            <Settings>
              <Setting name="Budget du mois" note="ce que je peux dépenser ce mois-ci">
                <MoneyInput label="Budget du mois" value={budget} onChange={(value) => setBudget({ monthly: value })} />
              </Setting>
            </Settings>
          </Card>
          <Card title="Catégories" level={3}>
            <p className="text-sm text-muted mb-3">
              Les opérations sont classées automatiquement d'après leur libellé. Voici les mots-clés utilisés :
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => (
                <div key={category} className="text-sm">
                  <span className="font-medium text-accent">{category}</span>
                  <span className="text-muted ml-2">{keywords.slice(0, 8).join(", ")}{keywords.length > 8 ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Mes données" level={3}>
            <p>Elles restent sur ce téléphone. Gardez-en une copie de temps en temps.</p>
            <div className="mt-3 grid gap-2.5">
              <ButtonRow>
                <Button small icon={Download} onClick={exportCsv}>Copie (CSV)</Button>
                <Button small icon={Upload} onClick={pickCsv}>Reprendre une copie</Button>
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