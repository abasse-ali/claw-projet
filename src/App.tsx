// L'appli : suivi de budget à partir des relevés bancaires
// - Import CSV bancaire (format français : Date;Libellé;Montant)
// - Catégorisation automatique d'après le libellé
// - Solde du mois en cours et dépenses par catégorie
// - Déduplication si on importe deux relevés qui se chevauchent
// - Données persistées dans localStorage

import {
  ArrowDownUp,
  ArrowUpDown,
  BarChart2,
  CreditCard,
  Download,
  FileText,
  Home,
  List,
  Loader2,
  Settings as SettingsIcon,
  ShoppingCart,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  Badge,
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
  seedOnce,
  toast,
  useEntries,
  useMonthEntries,
  useMonthTotals,
  type Category,
  type Entry,
  type NewEntry,
} from "./kit";
import { categorizeEntries, CATEGORY_RULES } from "./kit/categorize";

// Catégories pour la saisie manuelle (avec icônes Lucide)
const CATEGORIES: Category[] = [
  { name: "Courses", icon: ShoppingCart },
  { name: "Transport", icon: CreditCard },
  { name: "Factures", icon: FileText },
  { name: "Shopping", icon: ShoppingCart },
  { name: "Sorties", icon: Wallet },
  { name: "Santé", icon: CreditCard },
  { name: "Loisirs", icon: Wallet },
  { name: "Cadeaux", icon: Wallet },
  { name: "Revenus", icon: ArrowUpDown },
  { name: "Transferts", icon: ArrowDownUp },
  { name: "Banque", icon: CreditCard },
  { name: "Autre", icon: Wallet },
];

const TABS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "operations", label: "Opérations", icon: List },
  { id: "bilan", label: "Bilan", icon: BarChart2 },
  { id: "import", label: "Import", icon: Upload },
  { id: "reglages", label: "Réglages", icon: SettingsIcon },
];

const STORE_KEY = "budget-tracker";

export default function App() {
  const useBudget = persistentStore("budget", { monthly: 0 });
  const budget = useBudget((state) => state.monthly);
  const month = useEntries((state) => state.month);
  const clear = useEntries((state) => state.clear);
  const entries = useMonthEntries();
  const { income, spending, balance } = useMonthTotals();
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);

  const left = budget - spending;
  const days = daysLeft(month);
  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) {
      if (entry.amount < 0) {
        const cat = entry.category || "Autre";
        sums.set(cat, (sums.get(cat) ?? 0) - entry.amount);
      }
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Fonction pour importer un CSV avec catégorisation
  const handleImportCsv = async (file: File) => {
    setImporting(true);
    try {
      const { importCsv } = await import("./kit/csv");
      const count = await importCsv(file);
      if (count > 0) {
        toast(`${count} opération${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}`, {
          action: { label: "Annuler", run: () => useEntries.getState().clear() },
        });
      }
    } catch (error) {
      toast("Erreur lors de l'import", { tone: "error" });
    } finally {
      setImporting(false);
    }
  };

  const handlePickCsv = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) handleImportCsv(file);
    });
    input.click();
  };

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
        {/* ACCUEIL */}
        <Screen id="accueil" label="Accueil">
          <Hero
            label={balance >= 0 ? "Solde positif" : "Solde négatif"}
            amount={balance}
            sub={<>Budget du mois : <b>{money(budget)}</b></>}
            pills={[
              { label: "Par jour", value: money(Math.max(0, left) / days), note: `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}` },
              { label: "Dépensé", value: money(spending), note: "ce mois-ci" },
              { label: "Rentrées", value: money(income), note: "ce mois-ci" },
            ]}
            progress={{
              value: budget > 0 ? Math.min(spending / budget, 1) : 0,
              label: "Budget du mois dépensé",
              start: `${budget > 0 ? Math.round(Math.min(spending / budget, 1) * 100) : 0} % du budget`,
              end: money(budget),
            }}
          />
          <Tiles>
            <Tile icon={ArrowUpDown} label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile icon={ArrowDownUp} label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile icon={Wallet} label="Solde" value={money(balance)} note={balance >= 0 ? "excédent" : "déficit"} />
            <Tile icon={List} label="Opérations" value={entries.length} note="ce mois-ci" />
          </Tiles>
          <Card title="Dernières opérations" link={{ label: "Tout voir", href: "#operations" }}>
            <EntryList limit={5} />
          </Card>
        </Screen>

        {/* OPÉRATIONS */}
        <Screen id="operations" title="Opérations">
          <Tiles>
            <Tile label="Dépenses" value={money(spending)} note="ce mois-ci" />
            <Tile label="Rentrées" value={money(income)} note="ce mois-ci" />
            <Tile label="Solde" value={money(balance)} note={balance >= 0 ? "excédent" : "déficit"} />
          </Tiles>
          <Card>
            <EntryList label="Opérations du mois" />
          </Card>
        </Screen>

        {/* BILAN */}
        <Screen id="bilan" title="Bilan">
          <Card title="Rentrées et dépenses" meta="6 derniers mois" level={3}>
            <MonthsChart months={6} />
          </Card>
          <Card title="Dépenses par catégorie" level={3}>
            {byCategory.length ? (
              <Meters>
                {byCategory.map(([name, sum]) => (
                  <Meter
                    key={name}
                    name={name}
                    value={spending ? sum / spending : 0}
                    valueText={money(sum)}
                    tone="out"
                  />
                ))}
              </Meters>
            ) : (
              <p className="text-muted text-center py-4">Aucune dépense ce mois-ci.</p>
            )}
          </Card>
          <Card title="Répartition des rentrées" level={3}>
            {income > 0 ? (
              <Meters>
                {Array.from(
                  entries
                    .filter((e) => e.amount > 0)
                    .reduce((acc, e) => {
                      const cat = e.category || "Autre";
                      acc.set(cat, (acc.get(cat) ?? 0) + e.amount);
                      return acc;
                    }, new Map<string, number>())
                    .entries()
                ).map(([name, sum]) => (
                  <Meter
                    key={name}
                    name={name}
                    value={income ? sum / income : 0}
                    valueText={money(sum)}
                    tone="in"
                  />
                ))}
              </Meters>
            ) : (
              <p className="text-muted text-center py-4">Aucune rentrée ce mois-ci.</p>
            )}
          </Card>
        </Screen>

        {/* IMPORT */}
        <Screen id="import" title="Import CSV">
          <Card title="Importer un relevé bancaire" level={3}>
            <p className="text-muted mb-4">
              Sélectionnez le fichier CSV exporté depuis votre espace bancaire.
              Format attendu : <code className="px-1.5 py-0.5 bg-surface rounded text-xs">Date;Libellé;Montant</code>
              (séparateur point-virgule, date JJ/MM/AAAA, montant avec virgule).
            </p>
            <div className="space-y-3">
              <Button
                block
                icon={Upload}
                onClick={handlePickCsv}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Import en cours...
                  </>
                ) : (
                  "Choisir un fichier CSV"
                )}
              </Button>
              <p className="text-xs text-muted text-center">
                Les doublons sont détectés automatiquement (même date, libellé, montant).
                Les catégories existantes sont conservées.
              </p>
            </div>
          </Card>

          <Card title="Règles de catégorisation" level={3}>
            <p className="text-muted mb-3">
              Les opérations sont classées automatiquement d'après leur libellé.
              Vous pouvez modifier la catégorie de chaque opération manuellement.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_RULES.map((rule) => (
                <Badge
                  key={rule.category}
                  tone={rule.positiveOnly ? "in" : rule.negativeOnly ? "out" : "accent"}
                >
                  {rule.category}
                </Badge>
              ))}
            </div>
          </Card>

          <Card title="Export / Sauvegarde" level={3}>
            <p className="text-muted mb-3">Gardez une copie de vos données.</p>
            <ButtonRow>
              <Button small icon={Download} onClick={exportCsv}>Exporter CSV</Button>
              <Button small icon={Trash2} variant="danger" onClick={() => setConfirm(true)}>Tout effacer</Button>
            </ButtonRow>
          </Card>
        </Screen>

        {/* RÉGLAGES */}
        <Screen id="reglages" title="Réglages">
          <Card title="Budget mensuel" level={3}>
            <Settings>
              <Setting name="Budget du mois" note="Ce que vous pouvez dépenser ce mois-ci">
                <MoneyInput
                  label="Budget du mois"
                  value={budget}
                  onChange={(value) => useBudget.setState({ monthly: value })}
                />
              </Setting>
            </Settings>
          </Card>

          <Card title="Mois affiché" level={3}>
            <Settings>
              <Setting name="Mois courant" note="Changez le mois pour voir un autre historique">
                <p className="text-muted font-mono">{month}</p>
              </Setting>
            </Settings>
          </Card>

          <Card title="Mes données" level={3}>
            <p className="text-muted mb-3">
              Elles restent sur ce téléphone (localStorage). Gardez-en une copie de temps en temps
              avec le bouton « Exporter CSV » dans l'onglet Import.
            </p>
            <ButtonRow>
              <Button small icon={Download} onClick={exportCsv}>Copie</Button>
              <Button small icon={Upload} onClick={handlePickCsv}>Reprendre</Button>
            </ButtonRow>
            <Button small block variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>
              Tout effacer
            </Button>
          </Card>

          <Card title="À propos" level={3}>
            <p className="text-muted text-sm">
              Budget Tracker - Suivi de budget à partir des relevés bancaires.
              Données stockées localement, aucune donnée n'est envoyée sur internet.
            </p>
          </Card>
        </Screen>
      </AppShell>

      <EntrySheet categories={CATEGORIES} />
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Tout effacer ?"
        text="Les opérations de tous les mois seront effacées de ce téléphone. Cette action est irréversible."
        confirmLabel="Effacer"
        onConfirm={() => {
          const undo = clear();
          toast("Toutes les opérations sont effacées", { action: { label: "Annuler", run: undo } });
        }}
      />
    </>
  );
}