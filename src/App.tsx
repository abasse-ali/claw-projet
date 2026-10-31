// L'appli liste de courses : produits, budget, magasins, notes, partage QR
// Composée avec le kit de Claw

import {
  Apple,
  Camera,
  Check,
  Coffee,
  Edit,
  MapPin,
  Milk,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Square,
  Store,
  Wheat,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppShell,
  Button,
  ButtonRow,
  Card,
  ConfirmModal,
  Empty,
  Gauge,
  Hero,
  IconButton,
  List,
  Meters,
  Meter,
  QRCode,
  QRScanner,
  Row,
  Screen,
  Settings as SettingsComp,
  Setting,
  Tile,
  Tiles,
  Toaster,
  toast,
  money,
} from "./kit";
import { MapView, LocateButton, PlaceSearch, distanceKm, formatDistance } from "./kit";
import { NoteEditor, useNotes, noteTitle } from "./kit";
import { useShoppingStore, seedShoppingData } from "./store";
import { useGeolocation } from "./kit";

// Seed au démarrage
seedShoppingData();

const TABS = [
  { id: "courses", label: "Courses", icon: ShoppingCart },
  { id: "magasins", label: "Magasins", icon: Store },
  { id: "partage", label: "Partage", icon: ShoppingBag },
  { id: "budget", label: "Budget", icon: Settings },
];

const CATEGORIES = [
  { name: "Fruits & Légumes", icon: Apple },
  { name: "Produits laitiers", icon: Milk },
  { name: "Boulangerie", icon: Wheat },
  { name: "Épicerie", icon: Package },
  { name: "Boissons", icon: Coffee },
  { name: "Viandes & Poissons", icon: ShoppingBag },
  { name: "Surgelés", icon: Package },
  { name: "Hygiène & Maison", icon: Store },
];

export default function App() {
  const {
    products,
    budget,
    stores,
    addProduct,
    updateProduct,
    removeProduct,
    toggleChecked,
    incrementQuantity,
    decrementQuantity,
    setBudget,
    addStore,
    updateStore,
    removeStore,
    getCartTotal,
    getPlannedTotal,
    getCheckedCount,
    getUncheckedCount,
    exportData,
    importData,
    getNote,
    saveNote,
  } = useShoppingStore();

  const cartTotal = getCartTotal();
  const plannedTotal = getPlannedTotal();
  const checkedCount = getCheckedCount();
  const uncheckedCount = getUncheckedCount();
  const budgetPercent = budget > 0 ? (cartTotal / budget) * 100 : 0;
  const budgetPercentFormatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(budgetPercent);
  const isOverBudget = cartTotal > budget;

  const checkedProducts = useMemo(() => products.filter((p) => p.checked), [products]);
  const uncheckedProducts = useMemo(() => products.filter((p) => !p.checked), [products]);

  const { position: userPosition, locate } = useGeolocation();

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStore, setShowAddStore] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof products[0] | null>(null);
  const [editingStore, setEditingStore] = useState<typeof stores[0] | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmClearStores, setConfirmClearStores] = useState(false);

  const handleAddProduct = (name: string, price: number, quantity: number, category: string) => {
    const result = addProduct({ name, price, quantity, checked: false, category });
    if (!result.success) {
      toast(result.error || "Erreur", { tone: "error" });
    } else {
      toast(`${name} ajouté à la liste`);
    }
    setShowAddProduct(false);
  };

  const handleAddStore = (name: string, address: string, lat: number, lng: number) => {
    addStore({ name, address, lat, lng });
    toast(`${name} ajouté`);
    setShowAddStore(false);
  };

  const handleImportQR = (text: string) => {
    try {
      const data = JSON.parse(text);
      const result = importData(data);
      toast(
        `Importé : ${result.added} produits, ${result.skipped} ignorés (doublons)`,
        result.errors.length ? { tone: "error" } : {}
      );
      setQrScannerOpen(false);
    } catch {
      toast("Ce code QR ne contient pas une liste valide", { tone: "error" });
    }
  };

  const remaining = budget - cartTotal;
  const distanceLabel = useMemo(() => {
    if (!userPosition) return stores.map((s) => ({ ...s, distance: " - " }));
    return stores.map((s) => ({
      ...s,
      distance: formatDistance(distanceKm(userPosition, { lat: s.lat, lng: s.lng })),
    }));
  }, [stores, userPosition]);

  return (
    <>
      <AppShell
        bar={
          <>
            <IconButton icon={Settings} label="Réglages" href="#budget" />
          </>
        }
        tabs={TABS}
        onAdd={() => {
          // Le bouton + change selon l'onglet actif
        }}
        addLabel="Ajouter"
      >
        {/* === ONGLET COURSES === */}
        <Screen id="courses" label="Courses">
          <Hero
            label="Panier actuel"
            amount={cartTotal}
            sub={<>Total prévu : {money(plannedTotal)} · Budget : {money(budget)}</>}
            pills={[
              { label: "Cochés", value: `${checkedCount} / ${products.length}`, note: `${products.length ? Math.round((checkedCount / products.length) * 100) : 0}% de la liste` },
              { label: "Reste à cocher", value: money(plannedTotal - cartTotal), note: `${uncheckedCount} articles` },
            ]}
            progress={{
              value: budget > 0 ? Math.min(cartTotal / budget, 1) : 0,
              label: "Part du budget dépensée",
              start: `${budgetPercentFormatted} % du budget`,
              end: money(budget),
            }}
          />

          <Meter
            name="Part du budget dépensée"
            value={budget > 0 ? cartTotal / budget : 0}
            valueText={`${money(cartTotal)} sur ${money(budget)}`}
            tone={isOverBudget ? "out" : "in"}
            note={isOverBudget ? "Budget dépassé !" : ""}
          />

          {checkedProducts.length > 0 && (
            <Card title={`Dans le chariot (${checkedProducts.length})`} level={3}>
              <List>
                {checkedProducts.map((product) => (
                  <Row
                    key={product.id}
                    icon={iconForCategory(product.category)}
                    tone="in"
                    title={product.name}
                    sub={`${money(product.price)} × ${product.quantity}`}
                    amount={product.price * product.quantity}
                    end={
                      <>
                        <button className="icon-btn" aria-label={`Diminuer ${product.name}`} onClick={() => decrementQuantity(product.id)}>
                          <span className="icon-btn__icon">−</span>
                        </button>
                        <output className="qty-display">{product.quantity}</output>
                        <button className="icon-btn" aria-label={`Augmenter ${product.name}`} onClick={() => incrementQuantity(product.id)}>
                          <span className="icon-btn__icon">+</span>
                        </button>
                      </>
                    }
                    action={{
                      icon: product.checked ? Check : Square,
                      label: product.checked ? "Décocher" : "Cocher",
                      onClick: () => toggleChecked(product.id),
                    }}
                  />
                ))}
              </List>
            </Card>
          )}

          {uncheckedProducts.length > 0 && (
            <Card title={`À prendre dans le rayon (${uncheckedProducts.length})`} level={3}>
              <List>
                {uncheckedProducts.map((product) => (
                  <Row
                    key={product.id}
                    icon={iconForCategory(product.category)}
                    tone="out"
                    title={product.name}
                    sub={`${money(product.price)} × ${product.quantity}`}
                    amount={product.price * product.quantity}
                    end={
                      <>
                        <button className="icon-btn" aria-label={`Diminuer ${product.name}`} onClick={() => decrementQuantity(product.id)}>
                          <span className="icon-btn__icon">−</span>
                        </button>
                        <output className="qty-display">{product.quantity}</output>
                        <button className="icon-btn" aria-label={`Augmenter ${product.name}`} onClick={() => incrementQuantity(product.id)}>
                          <span className="icon-btn__icon">+</span>
                        </button>
                      </>
                    }
                    action={{
                      icon: Square,
                      label: product.checked ? "Décocher" : "Cocher",
                      onClick: () => toggleChecked(product.id),
                    }}
                  />
                ))}
              </List>
            </Card>
          )}

          {!products.length && (
            <Empty
              icon={ShoppingCart}
              text="Votre liste de courses est vide."
              action={{ label: "Ajouter un produit", onClick: () => setShowAddProduct(true) }}
            />
          )}
        </Screen>

        {/* === ONGLET MAGASINS === */}
        <Screen id="magasins" label="Magasins">
          <Card title="Carte et distances" level={3}>
            <MapView
              center={userPosition ?? { lat: 48.8566, lng: 2.3522 }}
              markers={distanceLabel.map((s) => ({
                id: s.id,
                lat: s.lat,
                lng: s.lng,
                label: s.name,
                note: `${s.address} · ${s.distance}`,
                tone: "accent" as const,
              }))}
              onPick={(place) => {
                setShowAddStore(true);
                // Pré-remplir avec la position choisie
                (window as any).__pendingStoreLocation = place;
              }}
              height={300}
              label="Carte des magasins"
            />
            <div className="mt-3">
              <LocateButton onLocate={(place) => {}} label="Ma position" />
            </div>
          </Card>

          <Card title="Mes magasins" level={3}>
            {stores.length === 0 ? (
              <Empty icon={Store} text="Aucun magasin enregistré." action={{ label: "Ajouter un magasin", onClick: () => setShowAddStore(true) }} />
            ) : (
              <List>
                {distanceLabel.map((store) => (
                  <Row
                    key={store.id}
                    icon={Store}
                    tone="accent"
                    title={store.name}
                    sub={`${store.address} · ${store.distance}`}
                    amount={useShoppingStore.getState().notes.filter((n) => n.storeId === store.id).length}
                    action={{
                      icon: Edit,
                      label: `Modifier ${store.name}`,
                      onClick: () => setEditingStore(store),
                    }}
                    compact={true}
                  />
                ))}
              </List>
            )}
          </Card>

          {selectedStoreId && (
            <Card title={`Notes : ${stores.find((s) => s.id === selectedStoreId)?.name || "Magasin"}`} level={3}>
              <NoteEditor
                value={getNote(selectedStoreId)?.html || ""}
                onChange={(html) => saveNote(selectedStoreId, html)}
                placeholder="Horaires, rayon promos, etc."
                label="Note du magasin"
                autofocus
              />
            </Card>
          )}
        </Screen>

        {/* === ONGLET PARTAGE === */}
        <Screen id="partage" label="Partage">
          <Card title="Partager ma liste" level={3}>
            <QRCode
              value={JSON.stringify(exportData())}
              label="Ma liste de courses"
              size={240}
            />
            <p className="mt-3 text-muted text-sm">Faites scanner ce code pour partager la liste</p>
          </Card>

          <Card title="Importer une liste" level={3}>
            <QRScanner onScan={handleImportQR} label="Scanner un code QR" />
          </Card>

          <SettingsComp>
            <Setting name="Sauvegarde automatique" note="Données conservées dans le navigateur">
              <span className="badge badge--success">Actif</span>
            </Setting>
          </SettingsComp>
        </Screen>

        {/* === ONGLET BUDGET === */}
        <Screen id="budget" label="Budget">
          <Hero
            label="Plafond du budget de courses"
            amount={budget}
            sub="Ajustez votre budget mensuel"
          />

          <Meter
            name="Budget utilisé"
            value={budget > 0 ? cartTotal / budget : 0}
            valueText={`${money(cartTotal)} / ${money(budget)}`}
            tone={isOverBudget ? "out" : "in"}
            note={isOverBudget ? `Dépassé de ${money(cartTotal - budget)}` : `Marge : ${money(remaining)}`}
          />

          <SettingsComp>
            <Setting name="Budget mensuel" note="Plafond pour les courses">
              <label htmlFor="budget-input" className="visually-hidden">Budget mensuel en euros</label>
              <input
                id="budget-input"
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                className="input input--money"
                style={{ width: "100%" }}
              />
            </Setting>
          </SettingsComp>

          <Card title="Mes données" level={3}>
            <p className="text-muted mb-3">Elles restent sur ce téléphone. Gardez-en une copie de temps en temps.</p>
            <div className="grid gap-2.5">
              <ButtonRow>
                <Button small icon={Camera} onClick={() => {
                  const data = exportData();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `liste-courses-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  Exporter JSON
                </Button>
                <Button small icon={Camera} variant="plain" onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const data = JSON.parse(reader.result as string);
                          importData(data);
                          toast("Liste importée");
                        } catch {
                          toast("Fichier invalide", { tone: "error" });
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}>
                  Importer JSON
                </Button>
              </ButtonRow>
              <Button small block variant="danger" icon={Package} onClick={() => setConfirmClear(true)}>
                Tout effacer
              </Button>
            </div>
          </Card>
        </Screen>
      </AppShell>

      {/* Feuilles d'ajout/modification */}
      {showAddProduct && (
        <ProductSheet
          categories={CATEGORIES}
          onSubmit={handleAddProduct}
          onClose={() => setShowAddProduct(false)}
          title="Ajouter un produit"
        />
      )}

      {editingProduct && (
        <ProductSheet
          categories={CATEGORIES}
          initial={editingProduct}
          onSubmit={(name, price, quantity, category) => {
            updateProduct(editingProduct.id, { name, price, quantity, category });
            toast(`${name} modifié`);
            setEditingProduct(null);
          }}
          onClose={() => setEditingProduct(null)}
          title="Modifier le produit"
        />
      )}

      {showAddStore && (
        <StoreSheet
          initial={(window as any).__pendingStoreLocation ? { name: "", address: "", lat: (window as any).__pendingStoreLocation.lat, lng: (window as any).__pendingStoreLocation.lng } : undefined}
          onSubmit={handleAddStore}
          onClose={() => { setShowAddStore(false); delete (window as any).__pendingStoreLocation; }}
          title="Ajouter un magasin"
        />
      )}

      {editingStore && (
        <StoreSheet
          initial={editingStore}
          onSubmit={(name, address, lat, lng) => {
            updateStore(editingStore.id, { name, address, lat, lng });
            toast(`${name} modifié`);
            setEditingStore(null);
          }}
          onClose={() => setEditingStore(null)}
          title="Modifier le magasin"
        />
      )}

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Tout effacer ?"
        text="Tous les produits, magasins et notes seront effacés de ce téléphone."
        confirmLabel="Effacer"
        onConfirm={() => {
          const undo = useShoppingStore.getState().clear();
          toast("Tout effacé", { action: { label: "Annuler", run: undo } });
        }}
      />

      <Toaster />
    </>
  );
}

// Helpers
function iconForCategory(category: string) {
  switch (category) {
    case "Fruits & Légumes": return Apple;
    case "Produits laitiers": return Milk;
    case "Boulangerie": return Wheat;
    case "Épicerie": return Package;
    case "Boissons": return Coffee;
    case "Viandes & Poissons": return ShoppingBag;
    case "Surgelés": return Package;
    case "Hygiène & Maison": return Store;
    default: return Package;
  }
}

// Composants de feuille (Sheet) pour ajout/modification
function ProductSheet({ categories, initial, onSubmit, onClose, title }: {
  categories: { name: string; icon: any }[];
  initial?: { name: string; price: number; quantity: number; category: string };
  onSubmit: (name: string, price: number, quantity: number, category: string) => void;
  onClose: () => void;
  title: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [quantity, setQuantity] = useState(initial?.quantity || 1);
  const [category, setCategory] = useState(initial?.category || categories[0].name);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Nom requis"); return; }
    const priceNum = parseFloat(String(price).replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError("Prix invalide"); return; }
    if (quantity < 1) { setError("Quantité minimum 1"); return; }
    onSubmit(name.trim(), priceNum, quantity, category);
  };

  return (
    <dialog className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <header className="sheet__head">
        <h2 id="sheet-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
      </header>
      <form onSubmit={handleSubmit} className="sheet__body">
        {error && <p className="sheet__error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="product-name">Nom</label>
          <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pommes bio" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="product-price">Prix (€)</label>
          <input id="product-price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1,50" inputMode="decimal" />
        </div>
        <div className="field">
          <label>Quantité</label>
          <div className="qty-input">
            <button type="button" className="icon-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuer">−</button>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
            <button type="button" className="icon-btn" onClick={() => setQuantity(quantity + 1)} aria-label="Augmenter">+</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="product-category">Catégorie</label>
          <select id="product-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="sheet__actions">
          <Button block variant="plain" type="button" onClick={onClose}>Annuler</Button>
          <Button block type="submit">{initial ? "Enregistrer" : "Ajouter"}</Button>
        </div>
      </form>
    </dialog>
  );
}

function StoreSheet({ initial, onSubmit, onClose, title }: {
  initial?: { name: string; address: string; lat: number; lng: number };
  onSubmit: (name: string, address: string, lat: number, lng: number) => void;
  onClose: () => void;
  title: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [lat, setLat] = useState(initial?.lat || 48.8566);
  const [lng, setLng] = useState(initial?.lng || 2.3522);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Nom requis"); return; }
    if (!address.trim()) { setError("Adresse requise"); return; }
    onSubmit(name.trim(), address.trim(), lat, lng);
  };

  return (
    <dialog className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <header className="sheet__head">
        <h2 id="sheet-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
      </header>
      <form onSubmit={handleSubmit} className="sheet__body">
        {error && <p className="sheet__error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="store-name">Nom</label>
          <input id="store-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bio C' Bon" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="store-address">Adresse</label>
          <input id="store-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Rue de la Paix" />
        </div>
        <PlaceSearch onPick={(place) => { setAddress(place.label); setLat(place.lat); setLng(place.lng); }} />
        <div className="field">
          <label>Position (lat, lng)</label>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} placeholder="Lat" />
            <input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value))} placeholder="Lng" />
          </div>
        </div>
        <div className="sheet__actions">
          <Button block variant="plain" type="button" onClick={onClose}>Annuler</Button>
          <Button block type="submit">{initial ? "Enregistrer" : "Ajouter"}</Button>
        </div>
      </form>
    </dialog>
  );
}