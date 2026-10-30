// L'appli budget : import relevés bancaires, catégorisation auto, solde mensuel et dépenses par catégorie.

import { useMemo, useState } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  Chips,
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
  Segmented,
  Setting,
  Settings,
  Tile,
  Tiles,
  daysLeft,
  exportCsv,
  filterKinds,
  getAllCategories,
  getBudgetCategories,
  getFilterCategories,
  money,
  openEntrySheet,
  persistentStore,
  pickBankCsv,
  seedOnce,
  toast,
  useBudget,
  useEntries,
  useFilter,
  useMonthEntries,
  useMonthTotals,
  type Category,
  type NewEntry,
} from "./kit";
import { ArrowDownCircle, ArrowRightLeft, Bus, Calendar, ChartColumn, Download, Gamepad2, HeartPulse, Home, List as ListIcon, Receipt, Search as SearchIcon, Settings as SettingsIcon, ShoppingBag, ShoppingCart, Tag, Trash2, Upload, Utensils, Wallet, X, AlertTriangle, AlertCircle } from "lucide-react";
import { MonthCalendar } from "./kit";

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
  const allEntries = useEntries((state) => state.entries);
  const { income, spending, balance } = useMonthTotals();
  const filter = useFilter();
  const { budgets, getOverBudget, getNearBudget, setBudget, getBudget } = useBudget();
  const [confirm, setConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const entry of entries) {
      if (entry.amount < 0) {
        sums.set(entry.category, (sums.get(entry.category) ?? 0) - entry.amount);
      }
    }
    return [...sums].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const overBudget = useMemo(() => getOverBudget(allEntries, month), [allEntries, month, getOverBudget]);
  const nearBudget = useMemo(() => getNearBudget(allEntries, month), [allEntries, month, getNearBudget]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    filter.setQuery(value);
  };

  const handleSearchClear = () => {
    setSearchQuery("");
    filter.setQuery("");
    filter.setCategory("");
    filter.setKind("");
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetCategory && budgetAmount) {
      const amount = parseFloat(budgetAmount.replace(",", "."));
      if (amount > 0) {
        setBudget(budgetCategory, amount);
        setBudgetCategory("");
        setBudgetAmount("");
        toast(`Budget ${budgetCategory} fixé à ${money(amount)}`);
      }
    }
  };

  const handleBudgetRemove = (category: string) => {
    setBudget(category, null);
    toast(`Budget ${category} supprimé`);
  };

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
          {(overBudget.length > 0 || nearBudget.length > 0) && (
            <Card title="Alertes budget" level={3}>
              {overBudget.map(({ category, overspend }) => (
                <div key={category} className="alert alert--error mb-2">
                  <AlertCircle size={18} className="alert__icon" />
                  <div>
                    <b>{category}</b> dépasse le budget de {money(overspend)}
                  </div>
                </div>
              ))}
              {nearBudget.map(({ category, percent }) => (
                <div key={category} className="alert alert--warn mb-2">
                  <AlertTriangle size={18} className="alert__icon" />
                  <div>
                    <b>{category}</b> à {Math.round(percent * 100)}% du budget
                  </div>
                </div>
              ))}
            </Card>
          )}
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
            <div className="mb-3">
              <label className="visually-hidden" htmlFor="search-input">Rechercher</label>
              <div className="search-input">
                <SearchIcon className="search-input__icon" />
                <input
                  id="search-input"
                  type="search"
                  placeholder="Rechercher une opération…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {(searchQuery || filter.category || filter.kind) && (
                  <button
                    type="button"
                    className="search-input__clear"
                    onClick={handleSearchClear}
                    aria-label="Effacer la recherche"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            {searchFocused || filter.category || filter.kind ? (
              <div className="filter-chips mb-3">
                <Chips
                  options={filterKinds}
                  value={filter.kind}
                  onChange={filter.setKind}
                  label="Type"
                />
                <Chips
                  options={getFilterCategories()}
                  value={filter.category}
                  onChange={filter.setCategory}
                  label="Catégorie"
                />
              </div>
            ) : null}
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
          <Card title="Calendrier" level={3}>
            <MonthCalendar month={month} />
          </Card>
        </Screen>

        <Screen id="reglages" title="Réglages">
          <Card title="Importer un relevé bancaire" level={3}>
            <p className="text-muted text-sm mb-3">Sélectionnez le fichier CSV exporté par votre banque (colonnes Date;Libellé;Montant, séparateur point-virgule).</p>
            <Button block icon={Upload} onClick={pickBankCsv}>Importer un relevé</Button>
          </Card>
          <Card title="Budgets mensuels par catégorie" level={3}>
            <form onSubmit={handleBudgetSubmit} className="budget-form mb-3">
              <div className="field">
                <label htmlFor="budget-category" className="field__label">Catégorie</label>
                <select
                  id="budget-category"
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="field__input"
                  required
                >
                  <option value="">Catégorie…</option>
                  {getBudgetCategories().map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="budget-amount" className="field__label">Montant (€)</label>
                <input
                  id="budget-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="Montant (€)"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="field__input"
                  required
                />
              </div>
              <Button type="submit" icon={AlertTriangle}>Définir</Button>
            </form>
            {Object.keys(budgets).length > 0 && (
              <div>
                <p className="text-sm text-muted mb-2">Budgets actuels :</p>
                {Object.entries(budgets).map(([category, amount]) => (
                  <div key={category} className="budget-item flex items-center justify-between py-2 border-t">
                    <span>{category}</span>
                    <div className="flex items-center gap-2">
                      <b>{money(amount)}</b>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleBudgetRemove(category)}
                        aria-label={`Supprimer le budget ${category}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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