import { describe, it, expect, beforeEach, vi } from "vitest";
import { useShoppingStore } from "./store";

// Mock localStorage for tests
const mockStorage: Record<string, string> = {};
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); },
  },
  writable: true,
});

describe("Shopping Store", () => {
  beforeEach(() => {
    // Reset store before each test
    useShoppingStore.setState({
      products: [],
      budget: 120,
      stores: [],
      notes: [],
    });
    localStorage.removeItem("shopping-app");
    localStorage.removeItem("shopping-app:seeded");
  });

  describe("Total calculations", () => {
    it("calculates cart total correctly (price × quantity for checked items only)", () => {
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: true, category: "Fruits" });
      useShoppingStore.getState().addProduct({ name: "Lait", price: 1.2, quantity: 3, checked: true, category: "Lait" });
      useShoppingStore.getState().addProduct({ name: "Pain", price: 2.8, quantity: 1, checked: false, category: "Pain" });

      const cartTotal = useShoppingStore.getState().getCartTotal();
      const plannedTotal = useShoppingStore.getState().getPlannedTotal();

      expect(cartTotal).toBeCloseTo(1.5 * 2 + 1.2 * 3); // 3.0 + 3.6 = 6.6
      expect(plannedTotal).toBeCloseTo(1.5 * 2 + 1.2 * 3 + 2.8 * 1); // 6.6 + 2.8 = 9.4
    });

    it("updates total when quantity changes", () => {
      const { product } = useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: true, category: "Fruits" });
      if (!product) throw new Error("Product not added");

      expect(useShoppingStore.getState().getCartTotal()).toBeCloseTo(3.0);

      useShoppingStore.getState().incrementQuantity(product.id);
      expect(useShoppingStore.getState().getCartTotal()).toBeCloseTo(4.5);

      useShoppingStore.getState().decrementQuantity(product.id);
      expect(useShoppingStore.getState().getCartTotal()).toBeCloseTo(3.0);
    });

    it("updates total when check status changes", () => {
      const { product } = useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: false, category: "Fruits" });
      if (!product) throw new Error("Product not added");

      expect(useShoppingStore.getState().getCartTotal()).toBe(0);

      useShoppingStore.getState().toggleChecked(product.id);
      expect(useShoppingStore.getState().getCartTotal()).toBeCloseTo(3.0);

      useShoppingStore.getState().toggleChecked(product.id);
      expect(useShoppingStore.getState().getCartTotal()).toBe(0);
    });
  });

  describe("Budget gauge", () => {
    it("shows correct percentage when under budget", () => {
      useShoppingStore.getState().setBudget(100);
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 10, quantity: 2, checked: true, category: "Fruits" });

      const cartTotal = useShoppingStore.getState().getCartTotal();
      const budget = useShoppingStore.getState().budget;
      const percent = (cartTotal / budget) * 100;

      expect(percent).toBe(20); // 20/100 = 20%
    });

    it("detects over budget correctly", () => {
      useShoppingStore.getState().setBudget(10);
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 15, quantity: 1, checked: true, category: "Fruits" });

      const cartTotal = useShoppingStore.getState().getCartTotal();
      const budget = useShoppingStore.getState().budget;
      const isOverBudget = cartTotal > budget;

      expect(isOverBudget).toBe(true);
    });

    it("handles zero budget", () => {
      useShoppingStore.getState().setBudget(0);
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 10, quantity: 1, checked: true, category: "Fruits" });

      const cartTotal = useShoppingStore.getState().getCartTotal();
      const budget = useShoppingStore.getState().budget;
      const percent = budget > 0 ? (cartTotal / budget) * 100 : 0;

      expect(percent).toBe(0);
    });
  });

  describe("Duplicate prevention", () => {
    it("rejects product with same name (case insensitive)", () => {
      const result1 = useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: false, category: "Fruits" });
      const result2 = useShoppingStore.getState().addProduct({ name: "pommes", price: 2.0, quantity: 1, checked: false, category: "Fruits" });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Ce produit existe déjà dans la liste.");
      expect(useShoppingStore.getState().products.length).toBe(1);
    });

    it("rejects product with same name (trimmed)", () => {
      const result1 = useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: false, category: "Fruits" });
      const result2 = useShoppingStore.getState().addProduct({ name: "  Pommes  ", price: 2.0, quantity: 1, checked: false, category: "Fruits" });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(useShoppingStore.getState().products.length).toBe(1);
    });

    it("allows different products", () => {
      const result1 = useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: false, category: "Fruits" });
      const result2 = useShoppingStore.getState().addProduct({ name: "Poires", price: 2.0, quantity: 1, checked: false, category: "Fruits" });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(useShoppingStore.getState().products.length).toBe(2);
    });
  });

  describe("Import/Export", () => {
    it("exports and imports data correctly", () => {
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: true, category: "Fruits" });
      useShoppingStore.getState().setBudget(100);
      const store = useShoppingStore.getState().addStore({ name: "Bio C' Bon", address: "12 Rue de la Paix", lat: 48.8566, lng: 2.3522 });
      useShoppingStore.getState().saveNote(store.id, "<p>Test note</p>");

      const exported = useShoppingStore.getState().exportData();
      expect(exported.products.length).toBe(1);
      expect(exported.budget).toBe(100);
      expect(exported.stores.length).toBe(1);
      expect(exported.notes.length).toBe(1);

      // Reset and import
      useShoppingStore.setState({ products: [], budget: 120, stores: [], notes: [] });
      const result = useShoppingStore.getState().importData(exported);

      expect(result.added).toBe(1);
      expect(useShoppingStore.getState().products.length).toBe(1);
      expect(useShoppingStore.getState().budget).toBe(100);
      expect(useShoppingStore.getState().stores.length).toBe(1);
    });

    it("skips duplicates on import", () => {
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: false, category: "Fruits" });

      const data = {
        products: [{ name: "Pommes", price: 2.0, quantity: 1, checked: false, category: "Fruits", id: "1" }],
        budget: 120,
        stores: [],
        notes: [],
      };

      const result = useShoppingStore.getState().importData(data);
      expect(result.skipped).toBe(1);
      expect(result.added).toBe(0);
      expect(useShoppingStore.getState().products.length).toBe(1);
    });
  });

  describe("Persistence", () => {
    it("persists data to localStorage", () => {
      useShoppingStore.getState().addProduct({ name: "Pommes", price: 1.5, quantity: 2, checked: true, category: "Fruits" });
      useShoppingStore.getState().setBudget(100);

      // Force persist by calling setState (zustand persist triggers on setState)
      // Verify data is stored in localStorage by checking the mock directly
      const stored = localStorage.getItem("shopping-app");
      console.log("Stored value:", stored);
      console.log("localStorage keys:", Object.keys(localStorage));
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.products.length).toBe(1);
      expect(parsed.state.budget).toBe(100);
    });
  });
});