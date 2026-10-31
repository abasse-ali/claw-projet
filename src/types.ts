// Types pour l'application liste de courses

export type Product = {
  id: string;
  name: string;
  price: number; // en euros (ex: 1.50)
  quantity: number; // entier >= 1
  checked: boolean;
  category: string;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: string; // Distance calculée depuis la position utilisateur
};

export type StoreNote = {
  id: string;
  storeId: string;
  html: string;
  updatedAt: string;
};

export type ShoppingData = {
  products: Product[];
  budget: number;
  stores: Store[];
  notes: StoreNote[];
};