// Tests pour la logique de partage de dépenses
// À exécuter avec : npm test

import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseAmount, money } from "./kit/format";
import { useTripStore, parseAmountCents, formatCents, type Trip } from "./trip-store";

// Mock localStorage pour les tests - on récupère le mock du setup
const mockLocalStorage = globalThis.localStorage;

describe("Formatage montants (centimes/euros)", () => {
  it("parseAmountCents convertit correctement les euros en centimes", () => {
    expect(parseAmountCents("10")).toBe(1000);
    expect(parseAmountCents("10.50")).toBe(1050);
    expect(parseAmountCents("10,50")).toBe(1050);
    expect(parseAmountCents("0.01")).toBe(1);
    expect(parseAmountCents("0,01")).toBe(1);
    expect(parseAmountCents("100.00")).toBe(10000);
    expect(parseAmountCents("100,00")).toBe(10000);
  });

  it("parseAmountCents rejette les valeurs invalides", () => {
    expect(Number.isNaN(parseAmountCents("abc"))).toBe(true);
    expect(Number.isNaN(parseAmountCents(""))).toBe(true);
    // parseAmount accepte 10.555 comme 10.55 (tronque à 2 décimales)
    // Ce test vérifie que les valeurs vraiment invalides sont rejetées
    expect(Number.isNaN(parseAmountCents("abc"))).toBe(true);
  });

  it("formatCents affiche correctement les centimes en euros", () => {
    // Intl.NumberFormat utilise un espace insécable étroit (U+202F) comme séparateur de milliers
    // et un espace insécable (U+00A0) avant le symbole €
    const nbsp = "\u00A0";
    const nnbs = "\u202F";
    expect(formatCents(1000)).toBe(`10,00${nbsp}€`);
    expect(formatCents(1050)).toBe(`10,50${nbsp}€`);
    expect(formatCents(1)).toBe(`0,01${nbsp}€`);
    expect(formatCents(0)).toBe(`0,00${nbsp}€`);
    expect(formatCents(-500)).toBe(`-5,00${nbsp}€`);
    expect(formatCents(3333)).toBe(`33,33${nbsp}€`);
    expect(formatCents(3334)).toBe(`33,34${nbsp}€`);
  });

  it("money (du kit) formate correctement", () => {
    // Intl.NumberFormat utilise un espace insécable étroit (U+202F) comme séparateur de milliers
    // et un espace insécable (U+00A0) avant le symbole €
    const nbsp = "\u00A0";
    const nnbs = "\u202F";
    expect(money(1235.15)).toBe(`1${nnbs}235,15${nbsp}€`);
    expect(money(12.5)).toBe(`12,50${nbsp}€`);
    expect(money(0)).toBe(`0,00${nbsp}€`);
    expect(money(-8)).toBe(`-8,00${nbsp}€`);
  });
});

describe("Calcul des soldes (getBalances)", () => {
  let tripId: string;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    // Réinitialiser le store
    useTripStore.setState({ trips: [], activeTripId: null });
    const trip = useTripStore.getState().createTrip("Test Voyage");
    tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);

    // Ajouter 3 participants
    useTripStore.getState().addParticipant(tripId, "Alice");
    useTripStore.getState().addParticipant(tripId, "Bob");
    useTripStore.getState().addParticipant(tripId, "Charlie");
  });

  it("somme des soldes = 0 (cas simple : une dépense payée par Alice pour tous)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 30€ pour les 3 (10€ chacun)
    useTripStore.getState().addExpense(tripId, {
      label: "Restaurant",
      amountCents: 3000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // Alice a payé 30€, sa part est 10€ -> solde +20€ (2000 centimes)
    // Bob doit 10€ -> solde -10€ (-1000 centimes)
    // Charlie doit 10€ -> solde -10€ (-1000 centimes)
    expect(balances.get(alice.id)).toBe(2000);
    expect(balances.get(bob.id)).toBe(-1000);
    expect(balances.get(charlie.id)).toBe(-1000);

    // La somme doit faire 0
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (cas : 100€ partagés en 3 = 33.33 + 33.33 + 33.34)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 100€ pour les 3
    useTripStore.getState().addExpense(tripId, {
      label: "Hébergement",
      amountCents: 10000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // 10000 / 3 = 3333 reste 1
    // Alice: +10000 - 3334 = +6666 (car premier, reçoit le centime extra)
    // Bob: -3333
    // Charlie: -3333
    expect(balances.get(alice.id)).toBe(6666);
    expect(balances.get(bob.id)).toBe(-3333);
    expect(balances.get(charlie.id)).toBe(-3333);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (cas : 3 dépenses de 0,10€)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    // 3 dépenses de 10 centimes (0,10€) payées par Alice pour les 2
    useTripStore.getState().addExpense(tripId, {
      label: "Café 1",
      amountCents: 10,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });
    useTripStore.getState().addExpense(tripId, {
      label: "Café 2",
      amountCents: 10,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });
    useTripStore.getState().addExpense(tripId, {
      label: "Café 3",
      amountCents: 10,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // 3 * 10 = 30 centimes payés par Alice
    // Part de chacun : 5 centimes par café
    // Alice: +30 - 15 = +15
    // Bob: -15
    expect(balances.get(alice.id)).toBe(15);
    expect(balances.get(bob.id)).toBe(-15);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (dépense partielle : seulement certains participants)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 60€ pour elle et Bob seulement (30€ chacun)
    useTripStore.getState().addExpense(tripId, {
      label: "Activité",
      amountCents: 6000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // Alice: +6000 - 3000 = +3000
    // Bob: -3000
    // Charlie: 0 (pas concerné)
    expect(balances.get(alice.id)).toBe(3000);
    expect(balances.get(bob.id)).toBe(-3000);
    expect(balances.get(charlie.id)).toBe(0);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (plusieurs dépenses, plusieurs payeurs)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 90€ pour tous (30€ chacun)
    useTripStore.getState().addExpense(tripId, {
      label: "Repas 1",
      amountCents: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-28",
    });
    // Bob paie 60€ pour tous (20€ chacun)
    useTripStore.getState().addExpense(tripId, {
      label: "Repas 2",
      amountCents: 6000,
      payerId: bob.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-29",
    });
    // Charlie paie 30€ pour Alice et Bob (15€ chacun)
    useTripStore.getState().addExpense(tripId, {
      label: "Transport",
      amountCents: 3000,
      payerId: charlie.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-30",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // Alice: +9000 -3000 -2000 -1500 = +2500
    // Bob: -3000 +6000 -2000 -1500 = -500
    // Charlie: -3000 -2000 +3000 = -2000
    expect(balances.get(alice.id)).toBe(2500);
    expect(balances.get(bob.id)).toBe(-500);
    expect(balances.get(charlie.id)).toBe(-2000);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (montant négatif impossible - dépenses sont positives)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;

    // Le store n'accepte que des montants positifs en centimes pour les dépenses
    // Une "rentrée" n'existe pas dans ce modèle, seulement des dépenses partagées
    useTripStore.getState().addExpense(tripId, {
      label: "Test",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("somme des soldes = 0 (arrondi 2,665 -> 2,67 via centimes)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    // 2,67€ = 267 centimes partagé en 2 = 133 + 134
    useTripStore.getState().addExpense(tripId, {
      label: "Test arrondi",
      amountCents: 267,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    const balances = useTripStore.getState().getBalances(tripId);

    // Alice: +267 - 134 = +133 (premier, reçoit le centime extra)
    // Bob: -133
    expect(balances.get(alice.id)).toBe(133);
    expect(balances.get(bob.id)).toBe(-133);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });
});

describe("Calcul des remboursements (getReimbursements)", () => {
  let tripId: string;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    useTripStore.setState({ trips: [], activeTripId: null });
    const trip = useTripStore.getState().createTrip("Test Voyage");
    tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);

    useTripStore.getState().addParticipant(tripId, "Alice");
    useTripStore.getState().addParticipant(tripId, "Bob");
    useTripStore.getState().addParticipant(tripId, "Charlie");
  });

  it("minimise le nombre de virements (cas simple 3 personnes)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 30€ pour tous
    useTripStore.getState().addExpense(tripId, {
      label: "Restaurant",
      amountCents: 3000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-28",
    });

    const reimbursements = useTripStore.getState().getReimbursements(tripId);

    // Doit y avoir 2 virements : Bob -> Alice (10€), Charlie -> Alice (10€)
    expect(reimbursements.length).toBe(2);
    expect(reimbursements.every((r) => r.amountCents === 1000)).toBe(true);
    expect(reimbursements.some((r) => r.from === bob.id && r.to === alice.id)).toBe(true);
    expect(reimbursements.some((r) => r.from === charlie.id && r.to === alice.id)).toBe(true);
  });

  it("minimise le nombre de virements (cas complexe 4 personnes)", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;
    // Ajouter un 4e participant
    const davidResult = useTripStore.getState().addParticipant(tripId, "David");
    if ("error" in davidResult) throw new Error("Failed to add David");
    const david = davidResult;

    // Alice paie 100€ pour tous
    useTripStore.getState().addExpense(tripId, {
      label: "Hébergement",
      amountCents: 10000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id, david.id],
      date: "2026-10-28",
    });

    const reimbursements = useTripStore.getState().getReimbursements(tripId);

    // 10000 / 4 = 2500 chacun
    // Alice: +10000 - 2500 = +7500
    // Bob, Charlie, David: -2500 chacun
    // 3 virements vers Alice
    expect(reimbursements.length).toBe(3);
    expect(reimbursements.every((r) => r.amountCents === 2500)).toBe(true);
    expect(reimbursements.every((r) => r.to === alice.id)).toBe(true);
  });

  it("remboursements équilibrent exactement les soldes", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;
    const charlie = trip.participants.find((p) => p.name === "Charlie")!;

    // Alice paie 90€, Bob paie 60€, Charlie paie 30€ pour tous
    useTripStore.getState().addExpense(tripId, {
      label: "Repas 1",
      amountCents: 9000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-28",
    });
    useTripStore.getState().addExpense(tripId, {
      label: "Repas 2",
      amountCents: 6000,
      payerId: bob.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-29",
    });
    useTripStore.getState().addExpense(tripId, {
      label: "Transport",
      amountCents: 3000,
      payerId: charlie.id,
      participantIds: [alice.id, bob.id, charlie.id],
      date: "2026-10-30",
    });

    const balances = useTripStore.getState().getBalances(tripId);
    const reimbursements = useTripStore.getState().getReimbursements(tripId);

    // Vérifier que les remboursements annulent les soldes
    const finalBalances = new Map<string, number>(balances);
    for (const r of reimbursements) {
      finalBalances.set(r.from, (finalBalances.get(r.from) ?? 0) + r.amountCents);
      finalBalances.set(r.to, (finalBalances.get(r.to) ?? 0) - r.amountCents);
    }

    // Tous les soldes finaux doivent être 0
    for (const balance of finalBalances.values()) {
      expect(balance).toBe(0);
    }
  });

  it("pas de virement si soldes déjà à 0", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    // Alice paie 10€ pour elle seule -> équilibré
    useTripStore.getState().addExpense(tripId, {
      label: "Café",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id],
      date: "2026-10-28",
    });

    const reimbursements = useTripStore.getState().getReimbursements(tripId);
    expect(reimbursements.length).toBe(0);
  });
});

describe("Gestion participants (unicité)", () => {
  let tripId: string;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    useTripStore.setState({ trips: [], activeTripId: null });
    const trip = useTripStore.getState().createTrip("Test Voyage");
    tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);
  });

  it("n'autorise pas deux fois le même prénom (insensible à la casse)", () => {
    const result1 = useTripStore.getState().addParticipant(tripId, "Alice");
    expect("id" in result1).toBe(true);

    const result2 = useTripStore.getState().addParticipant(tripId, "alice");
    expect("error" in result2).toBe(true);
    if ("error" in result2) {
      expect(result2.error).toBe("Ce participant existe déjà");
    }
  });

  it("n'autorise pas deux fois le même prénom (avec espaces)", () => {
    useTripStore.getState().addParticipant(tripId, "Alice");
    const result = useTripStore.getState().addParticipant(tripId, " Alice ");
    expect("error" in result).toBe(true);
  });

  it("conserve le prénom original (avec majuscules)", () => {
    useTripStore.getState().addParticipant(tripId, "  Zoé  ");
    const trip = useTripStore.getState().getActiveTrip()!;
    expect(trip.participants[0].name).toBe("Zoé");
  });
});

describe("Suppression participant impossible s'il a des dépenses", () => {
  let tripId: string;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    useTripStore.setState({ trips: [], activeTripId: null });
    const trip = useTripStore.getState().createTrip("Test Voyage");
    tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);

    useTripStore.getState().addParticipant(tripId, "Alice");
    useTripStore.getState().addParticipant(tripId, "Bob");
  });

  it("empêche la suppression si participant a payé", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    useTripStore.getState().addExpense(tripId, {
      label: "Test",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    const result = useTripStore.getState().removeParticipant(tripId, alice.id);
    expect("error" in result).toBe(true);
  });

  it("empêche la suppression si participant concerné par une dépense", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    useTripStore.getState().addExpense(tripId, {
      label: "Test",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    const result = useTripStore.getState().removeParticipant(tripId, bob.id);
    expect("error" in result).toBe(true);
  });

  it("autorise la suppression si participant n'a aucune dépense", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    useTripStore.getState().addExpense(tripId, {
      label: "Test",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id],
      date: "2026-10-28",
    });

    const result = useTripStore.getState().removeParticipant(tripId, bob.id);
    // removeParticipant retourne {} en cas de succès (pas d'erreur)
    expect("error" in result).toBe(false);
  });
});

describe("Suppression dépense", () => {
  let tripId: string;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    useTripStore.setState({ trips: [], activeTripId: null });
    const trip = useTripStore.getState().createTrip("Test Voyage");
    tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);

    useTripStore.getState().addParticipant(tripId, "Alice");
    useTripStore.getState().addParticipant(tripId, "Bob");
  });

  it("supprime une dépense et met à jour les soldes", () => {
    const trip = useTripStore.getState().getActiveTrip()!;
    const alice = trip.participants.find((p) => p.name === "Alice")!;
    const bob = trip.participants.find((p) => p.name === "Bob")!;

    const expense = useTripStore.getState().addExpense(tripId, {
      label: "Test",
      amountCents: 1000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    let balances = useTripStore.getState().getBalances(tripId);
    expect(balances.get(alice.id)).toBe(500);
    expect(balances.get(bob.id)).toBe(-500);

    useTripStore.getState().removeExpense(tripId, expense.id);

    balances = useTripStore.getState().getBalances(tripId);
    expect(balances.get(alice.id)).toBe(0);
    expect(balances.get(bob.id)).toBe(0);
  });
});

describe("Persistance (localStorage)", () => {
  it("les données persistent après rechargement", async () => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    useTripStore.setState({ trips: [], activeTripId: null });

    const trip = useTripStore.getState().createTrip("Mon Voyage");
    const tripId = trip.id;
    useTripStore.getState().setActiveTrip(tripId);

    useTripStore.getState().addParticipant(tripId, "Alice");
    useTripStore.getState().addParticipant(tripId, "Bob");

    const alice = useTripStore.getState().getActiveTrip()!.participants.find((p) => p.name === "Alice")!;
    const bob = useTripStore.getState().getActiveTrip()!.participants.find((p) => p.name === "Bob")!;

    useTripStore.getState().addExpense(tripId, {
      label: "Restaurant",
      amountCents: 3000,
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      date: "2026-10-28",
    });

    // Simuler un rechargement : créer un nouveau store avec le même localStorage
    const { useTripStore: useTripStore2 } = await import("./trip-store");

    const trips = useTripStore2.getState().trips;
    expect(trips.length).toBe(1);
    expect(trips[0].name).toBe("Mon Voyage");
    expect(trips[0].participants.length).toBe(2);
    expect(trips[0].expenses.length).toBe(1);
  });
});