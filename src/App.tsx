// Budget Tracker - Application de suivi budgétaire à partir des relevés bancaires

import {
  ArrowUpDown,
  Baby,
  Brain,
  Building2,
  Coffee,
  CreditCard,
  Download,
  FilePlus,
  FileText,
  Gamepad,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  LayoutDashboard,
  List,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Train,
  Trash2,
  Upload,
  Users,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  Badge,
  Button,
  ButtonRow,
  Card,
  Chips,
  ConfirmModal,
  EntryList,
  EntrySheet,
  Hero,
  IconButton,
  List as ListBlock,
  Meter,
  Meters,
  MoneyInput,
  MonthBar,
  Row,
  Screen,
  Segmented,
  Setting,
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
import { importBankCsv, pickBankCsv } from "./lib/bank-csv";
import { DEFAULT_CATEGORIES, categorize, getCategoryIcon, isValidCategory, type CategoryRule } from "./lib/categorize";

// Catégories pour l'application
const ICON_MAP: Record<string, typeof Tag> = {
  ShoppingCart, Train, Home, HeartPulse, Utensils, Coffee, ShoppingBag,
  Gamepad, Sparkles, Shield, GraduationCap, Baby, Gift, FileText,
  Wallet, Tag, Users, Package, Building2, CreditCard, Zap, Brain,
};

const APP_CATEGORIES: Category[] = DEFAULT_CATEGORIES.map(c => ({ 
  name: c.name, 
  icon: ICON_MAP[c.icon] || Tag 
}));

// Règles de catégorisation persistées
const useCategoryRules = persistentStore<{ rules: CategoryRule[] }>("category-rules", { rules: DEFAULT_CATEGORIES });

// Mois affiché
const useViewMonth = persistentStore<{ month: string }>("view-month", { month: "" });

function getIconComponent(name: string) {
  return ICON_MAP[name] || Tag;
}

const TABS = [
  { id: "accueil", label: "Accueil", icon: LayoutDashboard },
  { id: "operations", label: "Operations", icon: List },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "import", label: "Import", icon: FilePlus },
  { id: "reglages", label: "Reglages", icon: SettingsIcon },
];

export default function App() {
  const month = useEntries((state) => state.month);
  const viewMonth = useViewMonth((state) => state.month) || month;
  const entries = useMonthEntries(viewMonth);
  const { income, spending, balance } = useMonthTotals(viewMonth);
  const categoryRules = useCategoryRules((state) => state.rules);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Depenses par categorie pour le mois affiche
  const spendingByCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) {
      if (entry.amount < 0) {
        sums.set(entry.category, (sums.get(entry.category) ?? 0) - entry.amount);
      }
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Solde du mois en cours
  const currentMonth = month;
  const currentEntries = useMonthEntries(currentMonth);
  const { income: currentIncome, spending: currentSpending, balance: currentBalance } = useMonthTotals(currentMonth);
  const days = daysLeft(currentMonth);

  return (
    <>
      <AppShell
        bar={
          <MonthBar>
            <IconButton
              icon={SettingsIcon}
              label="Reglages"
              href="#reglages"
            />
          </MonthBar>
        }
        tabs={TABS}
        onAdd={() => openEntrySheet()}
        addLabel="Ajouter une operation"
      >
        {/* ACCUEIL */}
        <Screen id="accueil" label="Accueil">
          <Hero
            label="Solde du mois"
            amount={currentBalance}
            sub={<>Budget : <b>{money(currentIncome - currentSpending + currentBalance)}</b></>}
            pills={[
              { label: "Par jour", value: money(Math.max(0, currentBalance) / days), note: `${days} jours restants` },
              { label: "Depense", value: money(currentSpending), note: "ce mois-ci" },
            ]}
            progress={{
              value: currentIncome > 0 ? currentSpending / currentIncome : 0,
              label: "Part du budget depensee",
              start: `${currentIncome > 0 ? Math.round((currentSpending / currentIncome) * 100) : 0} %`,
              end: money(currentIncome),
            }}
          />

          <Tiles>
            <Tile icon={Wallet} label="Rentrees" value={money(currentIncome)} note="ce mois-ci" />
            <Tile icon={CreditCard} label="Depenses" value={money(currentSpending)} note="ce mois-ci" />
            <Tile icon={FileText} label="Operations" value={currentEntries.length} note="ce mois-ci" />
          </Tiles>

          <Card title="Dernieres operations" link={{ label: "Tout voir", href: "#operations" }}>
            <EntryList limit={5} emptyText="Aucune operation ce mois-ci. Importez un releve ou ajoutez-en une." />
          </Card>

          {spendingByCategory.length > 0 && (
            <Card title="Depenses par categorie" level={3}>
              <Meters>
                {spendingByCategory.map(([name, sum]) => (
                  <Meter
                    key={name}
                    name={name}
                    value={currentSpending ? sum / currentSpending : 0}
                    valueText={money(sum)}
                    tone="out"
                  />
                ))}
              </Meters>
            </Card>
          )}
        </Screen>

        {/* OPERATIONS */}
        <Screen id="operations" title="Operations">
          <Tiles>
            <Tile label="Depenses" value={money(spending)} note={viewMonth === month ? "ce mois-ci" : "ce mois-la"} />
            <Tile label="Rentrees" value={money(income)} note={viewMonth === month ? "ce mois-ci" : "ce mois-la"} />
            <Tile label="Solde" value={money(balance)} note={viewMonth === month ? "ce mois-ci" : "ce mois-la"} />
          </Tiles>

          <Card>
            <EntryList
              label={`Operations ${viewMonth === month ? "du mois" : "de " + new Date(viewMonth + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`}
              emptyText="Aucune operation. Importez un releve bancaire."
            />
          </Card>
        </Screen>

        {/* CATEGORIES */}
        <Screen id="categories" title="Categories">
          <Card title="Depenses par categorie" level={3}>
            {spendingByCategory.length ? (
              <Meters>
                {spendingByCategory.map(([name, sum]) => (
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
              <p className="text-center text-muted py-4">Aucune depense pour ce mois.</p>
            )}
          </Card>

          <Card title="Toutes les categories" level={3}>
            <ListBlock>
              {categoryRules.map((cat) => (
                <Row
                  key={cat.name}
                  icon={getIconComponent(cat.icon)}
                  tone={cat.name === "Salaire/Revenus" ? "in" : "out"}
                  title={cat.name}
                  sub={`${cat.keywords.length} mots-cles`}
                  end={cat.name === "Autre" ? (
                    <Badge tone="accent">Par defaut</Badge>
                  ) : null}
                  action={{
                    icon: ArrowUpDown,
                    label: `Voir les mots-cles de "${cat.name}"`,
                    onClick: () => setSelectedCategory(cat.name),
                  }}
                />
              ))}
            </ListBlock>
          </Card>

          {selectedCategory && (
            <CategoryEditor
              categoryName={selectedCategory}
              rules={categoryRules}
              onSave={(updated) => useCategoryRules.setState({ rules: updated })}
              onClose={() => setSelectedCategory(null)}
            />
          )}
        </Screen>

        {/* IMPORT */}
        <Screen id="import" title="Importer un releve">
          <Card title="Importer un fichier CSV bancaire" level={3}>
            <div className="space-y-4">
              <div className="p-4 bg-surface rounded-lg border border-line text-center">
                <Upload className="mx-auto text-muted mb-2" size={32} />
                <p className="text-ink">Glissez-deposez votre fichier CSV ici</p>
                <p className="text-sm text-muted mt-1">ou cliquez pour choisir</p>
                <Button
                  block
                  icon={Upload}
                  onClick={pickBankCsv}
                  disabled={importing}
                >
                  {importing ? <Loader2 className="animate-spin" size={16} /> : "Choisir un fichier CSV"}
                </Button>
              </div>

              <div className="text-sm text-muted space-y-1">
                <p><strong>Format attendu :</strong> Date;Libelle;Montant (separes par des points-virgules)</p>
                <p><strong>Date :</strong> JJ/MM/AAAA (ex: 28/10/2026)</p>
                <p><strong>Montant :</strong> virgule pour les decimales, espace pour les milliers, negatif pour les depenses (ex: -1 234,56)</p>
                <p><strong>Exemple :</strong> <code className="bg-faint px-1 rounded">28/10/2026;CARREFOUR MARKET;-45,67</code></p>
              </div>

              <div className="grid gap-2">
                <ButtonRow>
                  <Button variant="plain" icon={RotateCcw} onClick={() => pickCsv()} small>
                    Reprendre une sauvegarde
                  </Button>
                  <Button variant="plain" icon={Download} onClick={exportCsv} small>
                    Exporter mes donnees
                  </Button>
                </ButtonRow>
              </div>
            </div>
          </Card>

          <Card title="Comment ca marche" level={3}>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Brain className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium">Categorisation automatique</p>
                  <p className="text-muted">Chaque operation est classee selon son libelle (CARREFOUR - Courses, SNCF - Transport...)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Shield className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium">Pas de doublons</p>
                  <p className="text-muted">Si vous importez deux releves qui se chevauchent, les operations identiques ne sont pas comptees deux fois</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Users className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium">Modification manuelle</p>
                  <p className="text-muted">Vous pouvez changer la categorie de n'importe quelle operation depuis la liste</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Package className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium">Donnees locales</p>
                  <p className="text-muted">Tout reste sur votre telephone, rien n'est envoye sur internet</p>
                </div>
              </div>
            </div>
          </Card>
        </Screen>

        {/* REGLAGES */}
        <Screen id="reglages" title="Reglages">
          <Card title="Mes donnees" level={3}>
            <p className="text-muted mb-4">Elles restent sur ce telephone. Gardez-en une copie de temps en temps.</p>
            <div className="grid gap-2.5">
              <ButtonRow>
                <Button small icon={Download} onClick={exportCsv}>Copie (CSV)</Button>
                <Button small icon={Upload} onClick={pickCsv}>Reprendre une copie</Button>
              </ButtonRow>
              <ButtonRow>
                <Button small icon={FilePlus} onClick={pickBankCsv}>Importer un releve bancaire</Button>
              </ButtonRow>
              <Button small block variant="danger" icon={Trash2} onClick={() => setConfirmClear(true)}>
                Tout effacer
              </Button>
            </div>
          </Card>

          <Card title="Regles de categorisation" level={3}>
            <p className="text-muted mb-3">Les mots-cles utilises pour classer automatiquement vos operations. Vous pouvez les modifier dans l'onglet Categories.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categoryRules.map((cat) => {
                const IconComponent = getIconComponent(cat.icon);
                return (
                <div key={cat.name} className="p-2 bg-surface rounded border border-line">
                  <div className="flex items-center gap-2 mb-1">
                    <IconComponent className="text-accent" size={16} />
                    <span className="font-medium">{cat.name}</span>
                    {cat.name !== "Autre" && (
                      <Badge tone="accent">{cat.keywords.length} mots-cles</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">{cat.keywords.slice(0, 10).join(", ")}{cat.keywords.length > 10 ? "..." : ""}</p>
                </div>
                );
              })}
            </div>
          </Card>
        </Screen>
      </AppShell>

      <EntrySheet
        categories={APP_CATEGORIES}
      />

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Les operations de tous les mois seront effacees de ce telephone. Cette action est irreversible."
        confirmLabel="Effacer"
        onConfirm={() => {
          const undo = useEntries.getState().clear();
          toast("Toutes les operations sont effacees", { action: { label: "Annuler", run: undo } });
        }}
      />
    </>
  );
}



// Composant pour editer une categorie (mots-cles)
function CategoryEditor({
  categoryName,
  rules,
  onSave,
  onClose,
}: {
  categoryName: string;
  rules: CategoryRule[];
  onSave: (rules: CategoryRule[]) => void;
  onClose: () => void;
}) {
  const category = rules.find(c => c.name === categoryName);
  if (!category) return null;

  const [keywords, setKeywords] = useState(category.keywords.join(", "));
  const [newKeyword, setNewKeyword] = useState("");

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !category.keywords.includes(kw)) {
      setKeywords([...category.keywords, kw].join(", "));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(category.keywords.filter(k => k !== kw).join(", "));
  };

  const handleSave = () => {
    const updatedRules = rules.map(c =>
      c.name === categoryName ? { ...c, keywords: keywords.split(",").map(k => k.trim()).filter(Boolean) } : c
    );
    onSave(updatedRules);
    onClose();
    toast(`Categorie "${categoryName}" mise a jour`);
  };

  const IconComponent = getIconComponent(category.icon);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 mb-4 md:mb-0 bg-paper rounded-t-2xl md:rounded-xl shadow-xl p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconComponent className="text-accent" size={24} />
            <h2 className="text-lg font-semibold">"{categoryName}"</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-surface" aria-label="Fermer">x</button>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {category.keywords.map((kw) => (
            <div key={kw} className="flex items-center justify-between p-2 bg-surface rounded border border-line">
              <span className="text-sm font-mono">{kw}</span>
              <button
                onClick={() => handleRemoveKeyword(kw)}
                className="p-1 text-muted hover:text-error hover:bg-error/10 rounded"
                aria-label={`Supprimer "${kw}"`}
              >
                x
              </button>
            </div>
          ))}
          {category.keywords.length === 0 && categoryName !== "Autre" && (
            <p className="text-sm text-muted text-center py-4">Aucun mot-cle pour l'instant.</p>
          )}
        </div>

        {categoryName !== "Autre" && (
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              placeholder="Ajouter un mot-cle..."
              className="flex-1 px-3 py-2 bg-surface border border-line rounded-lg text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <Button onClick={handleAddKeyword} icon={Plus}>Ajouter</Button>
          </div>
        )}

        <ButtonRow>
          <Button variant="plain" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </ButtonRow>
      </div>
    </div>
  );
}