// Store de l'application liste de courses (IndexedDB via zustand persist)

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type Product, type Store, type StoreNote, type ShoppingData } from "./types";

let productCounter = 0;
let storeCounter = 0;
let noteCounter = 0;

const newProductId = () => `p-${Date.now().toString(36)}-${(productCounter++).toString(36)}`;
const newStoreId = () => `s-${Date.now().toString(36)}-${(storeCounter++).toString(36)}`;
const newNoteId = () => `n-${Date.now().toString(36)}-${(noteCounter++).toString(36)}`;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function cleanProduct(product: Omit<Product, "id">, id = newProductId()): Product {
  return {
    id,
    name: product.name.trim(),
    price: Number.isFinite(product.price) ? Math.round(product.price * 100) / 100 : 0,
    quantity: Math.max(1, Math.floor(product.quantity)),
    checked: Boolean(product.checked),
    category: product.category.trim() || "Autre",
  };
}

function cleanStore(store: Omit<Store, "id">, id = newStoreId()): Store {
  return {
    id,
    name: store.name.trim(),
    address: store.address.trim(),
    lat: Number(store.lat),
    lng: Number(store.lng),
  };
}

function cleanNote(note: Omit<StoreNote, "id">, id = newNoteId()): StoreNote {
  return {
    id,
    storeId: note.storeId,
    html: note.html,
    updatedAt: new Date().toISOString(),
  };
}

// Storage adapter pour les tests (utilise localStorage mock)
function getTestStorage() {
  return createJSONStorage(() => ({
    getItem: (name: string) => {
      try {
        // Check at call time, not module load time
        const isTest = typeof globalThis !== "undefined" && (globalThis as any).__vitest__ !== undefined;
        if (!isTest) {
          return localStorage.getItem(name);
        }
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      try {
        // Check at call time, not module load time
        const isTest = typeof globalThis !== "undefined" && (globalThis as any).__vitest__ !== undefined;
        if (!isTest) {
          localStorage.setItem(name, value);
          return;
        }
        localStorage.setItem(name, value);
      } catch {
        // Ignore errors in tests
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // Ignore errors
      }
    },
  }));
}

type ShoppingState = {
  products: Product[];
  budget: number;
  stores: Store[];
  notes: StoreNote[];
  // Actions produits
  addProduct: (product: Omit<Product, "id">) => { success: boolean; error?: string; product?: Product };
  updateProduct: (id: string, fields: Partial<Omit<Product, "id">>) => void;
  removeProduct: (id: string) => () => void;
  toggleChecked: (id: string) => void;
  incrementQuantity: (id: string) => void;
  decrementQuantity: (id: string) => void;
  // Actions budget
  setBudget: (budget: number) => void;
  // Actions magasins
  addStore: (store: Omit<Store, "id">) => Store;
  updateStore: (id: string, fields: Partial<Omit<Store, "id">>) => void;
  removeStore: (id: string) => () => void;
  // Actions notes
  getNote: (storeId: string) => StoreNote | undefined;
  saveNote: (storeId: string, html: string) => void;
  // Calculs
  getCartTotal: () => number;
  getPlannedTotal: () => number;
  getCheckedCount: () => number;
  getUncheckedCount: () => number;
  // Export/Import
  exportData: () => ShoppingData;
  importData: (data: ShoppingData) => { added: number; skipped: number; errors: string[] };
  // Clear
  clear: () => () => void;
};

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      products: [],
      budget: 120,
      stores: [],
      notes: [],

      addProduct: (product) => {
        const normalized = normalizeName(product.name);
        const exists = get().products.some((p) => normalizeName(p.name) === normalized);
        if (exists) {
          return { success: false, error: "Ce produit existe déjà dans la liste." };
        }
        const cleaned = cleanProduct(product);
        set({ products: [...get().products, cleaned] });
        return { success: true, product: cleaned };
      },

      updateProduct: (id, fields) =>
        set({
          products: get().products.map((p) =>
            p.id === id ? cleanProduct({ ...p, ...fields }, id) : p
          ),
        }),

      removeProduct: (id) => {
        const before = get().products;
        const index = before.findIndex((p) => p.id === id);
        if (index < 0) return () => {};
        const removed = before[index];
        set({ products: before.filter((p) => p.id !== id) });
        return () => set({ products: [...before.slice(0, index), removed, ...before.slice(index)] });
      },

      toggleChecked: (id) =>
        set({
          products: get().products.map((p) =>
            p.id === id ? { ...p, checked: !p.checked } : p
          ),
        }),

      incrementQuantity: (id) =>
        set({
          products: get().products.map((p) =>
            p.id === id ? { ...p, quantity: p.quantity + 1 } : p
          ),
        }),

      decrementQuantity: (id) =>
        set({
          products: get().products.map((p) =>
            p.id === id && p.quantity > 1 ? { ...p, quantity: p.quantity - 1 } : p
          ),
        }),

      setBudget: (budget) => set({ budget: Math.max(0, budget) }),

      addStore: (store) => {
        const cleaned = cleanStore(store);
        set({ stores: [...get().stores, cleaned] });
        return cleaned;
      },

      updateStore: (id, fields) =>
        set({
          stores: get().stores.map((s) =>
            s.id === id ? cleanStore({ ...s, ...fields }, id) : s
          ),
        }),

      removeStore: (id) => {
        const before = get().stores;
        const index = before.findIndex((s) => s.id === id);
        if (index < 0) return () => {};
        const removed = before[index];
        set({ stores: before.filter((s) => s.id !== id) });
        return () => set({ stores: [...before.slice(0, index), removed, ...before.slice(index)] });
      },

      getNote: (storeId) => get().notes.find((n) => n.storeId === storeId),

      saveNote: (storeId, html) =>
        set((state) => {
          const existingIndex = state.notes.findIndex((n) => n.storeId === storeId);
          if (existingIndex >= 0) {
            const newNotes = [...state.notes];
            newNotes[existingIndex] = { ...newNotes[existingIndex], html, updatedAt: new Date().toISOString() };
            return { notes: newNotes };
          } else {
            return { notes: [...state.notes, { id: newNoteId(), storeId, html, updatedAt: new Date().toISOString() }] };
          }
        }),

      getCartTotal: () =>
        get().products
          .filter((p) => p.checked)
          .reduce((sum, p) => sum + p.price * p.quantity, 0),

      getPlannedTotal: () =>
        get().products.reduce((sum, p) => sum + p.price * p.quantity, 0),

      getCheckedCount: () => get().products.filter((p) => p.checked).length,

      getUncheckedCount: () => get().products.filter((p) => !p.checked).length,

      clear: () => {
        const before = {
          products: get().products,
          budget: get().budget,
          stores: get().stores,
          notes: get().notes,
        };
        set({ products: [], budget: 120, stores: [], notes: [] });
        return () => set(before);
      },

      exportData: () => ({
        products: get().products,
        budget: get().budget,
        stores: get().stores,
        notes: get().notes,
      }),

      importData: (data) => {
        const errors: string[] = [];
        let added = 0;
        let skipped = 0;

        // Import produits (dedup par nom normalisé)
        const existingNames = new Set(get().products.map((p) => normalizeName(p.name)));
        for (const product of data.products ?? []) {
          const normalized = normalizeName(product.name);
          if (existingNames.has(normalized)) {
            skipped++;
            continue;
          }
          const cleaned = cleanProduct(product);
          set({ products: [...get().products, cleaned] });
          existingNames.add(normalized);
          added++;
        }

        // Import budget
        if (typeof data.budget === "number" && data.budget >= 0) {
          set({ budget: data.budget });
        }

        // Import magasins
        for (const store of data.stores ?? []) {
          const cleaned = cleanStore(store);
          set({ stores: [...get().stores, cleaned] });
        }

        // Import notes
        for (const note of data.notes ?? []) {
          set({ notes: [...get().notes, { ...note, id: newNoteId() }] });
        }

        return { added, skipped, errors };
      },
    }),
    {
      name: "shopping-app",
      storage: getTestStorage(),
      partialize: (state) => ({
        products: state.products,
        budget: state.budget,
        stores: state.stores,
        notes: state.notes,
      }),
      version: 1,
    }
  )
);

// Seed data au premier lancement
export function seedShoppingData(): void {
  const marker = "shopping-app:seeded";
  try {
    if (localStorage.getItem(marker)) return;
    localStorage.setItem(marker, "1");
  } catch {
    // Navigation privée
  }

  const state = useShoppingStore.getState();
  if (state.products.length > 0) return;

  const seedProducts: Omit<Product, "id">[] = [
    { name: "Pommes bio", price: 1.5, quantity: 2, checked: true, category: "Fruits & Légumes" },
    { name: "Lait entier 1L", price: 1.2, quantity: 3, checked: true, category: "Produits laitiers" },
    { name: "Pain au levain", price: 2.8, quantity: 1, checked: false, category: "Boulangerie" },
    { name: "Café en grain", price: 6.5, quantity: 1, checked: false, category: "Épicerie" },
    { name: "Beurre doux", price: 2.4, quantity: 2, checked: false, category: "Produits laitiers" },
  ];

  const seedStores: Omit<Store, "id">[] = [
    { name: "Bio C' Bon", address: "12 Rue de la Paix", lat: 48.8566, lng: 2.3522 },
    { name: "Super U", address: "88 Avenue des Champs", lat: 48.8606, lng: 2.3376 },
  ];

  const seedNotes: Omit<StoreNote, "id">[] = [
    {
      storeId: "", // Sera remplacé après création des stores
      html: "<p><strong>Horaires et promos du vendredi</strong></p><ul><li data-checked=\"true\">Horaires : 08h30 - 20h00</li><li data-checked=\"true\">Rayon promos : Fruits bio à -20% en tête de gondole</li><li data-checked=\"false\">Vérifier rayon frais pour le lait d'amande</li></ul>",
      updatedAt: new Date().toISOString(),
    },
    {
      storeId: "",
      html: "<p><strong>Notes Super U</strong></p><ul><li data-checked=\"true\">Ouvert jusqu'à 20h</li><li data-checked=\"false\">Rayon bio au fond à gauche</li></ul>",
      updatedAt: new Date().toISOString(),
    },
  ];

  const addedStores = seedStores.map((s) => state.addStore(s));
  seedNotes[0].storeId = addedStores[0].id;
  seedNotes[1].storeId = addedStores[1].id;

  for (const product of seedProducts) {
    state.addProduct(product);
  }
  for (const note of seedNotes) {
    state.saveNote(note.storeId, note.html);
  }
}