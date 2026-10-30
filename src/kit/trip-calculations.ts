// Logique de calcul pour le partage de dépenses : soldes et remboursements minimaux.
// Tout se fait en centimes (entiers) pour la précision au centime près.

import { useTripStore, type Participant, type Expense } from "./trip-store";

/** Résultat du calcul : solde par participant (en centimes, positif = à recevoir, négatif = à payer). */
export type Balance = {
  participantId: string;
  name: string;
  paid: number; // total payé en centimes
  share: number; // sa part en centimes
  balance: number; // payé - part (positif = créditeur, négatif = débiteur)
};

/** Un remboursement : qui paie qui, combien. */
export type Settlement = {
  from: string; // participant id (débiteur)
  to: string; // participant id (créancier)
  amount: number; // en centimes
  fromName: string;
  toName: string;
};

/**
 * Calcule les soldes de tous les participants.
 * Retourne un tableau de Balance, la somme des balances vaut toujours 0.
 */
export function computeBalances(): Balance[] {
  const { participants, expenses } = useTripStore.getState();

  if (participants.length === 0) return [];

  // Total payé par participant
  const paidBy = new Map<string, number>();
  for (const p of participants) paidBy.set(p.id, 0);

  for (const expense of expenses) {
    const current = paidBy.get(expense.paidBy) ?? 0;
    paidBy.set(expense.paidBy, current + expense.amount);
  }

  // Part de chaque participant (sa quote-part des dépenses)
  const shareBy = new Map<string, number>();
  for (const p of participants) shareBy.set(p.id, 0);

  for (const expense of expenses) {
    const splitAmong = expense.splitAmong.length > 0 ? expense.splitAmong : participants.map((p) => p.id);
    const count = splitAmong.length;
    if (count === 0) continue;

    // Division euclidienne : quotient et reste
    const quotient = Math.floor(expense.amount / count);
    const remainder = expense.amount % count;

    // Chaque participant paie le quotient
    for (const pid of splitAmong) {
      const current = shareBy.get(pid) ?? 0;
      shareBy.set(pid, current + quotient);
    }
    // Le reste (1 centime par participant) est réparti sur les premiers
    for (let i = 0; i < remainder; i++) {
      const pid = splitAmong[i];
      const current = shareBy.get(pid) ?? 0;
      shareBy.set(pid, current + 1);
    }
  }

  // Construire les soldes
  const balances: Balance[] = [];
  for (const p of participants) {
    const paid = paidBy.get(p.id) ?? 0;
    const share = shareBy.get(p.id) ?? 0;
    balances.push({
      participantId: p.id,
      name: p.name,
      paid,
      share,
      balance: paid - share,
    });
  }

  // Vérification : la somme doit être 0
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  if (sum !== 0) {
    console.error("Somme des soldes non nulle:", sum, balances);
  }

  return balances;
}

/**
 * Calcule les remboursements minimaux (algorithme greedy).
 * Retourne la liste des virements à faire pour équilibrer tout le monde.
 * Le nombre de virements est minimal (au plus n-1 pour n participants).
 */
export function computeSettlements(): Settlement[] {
  const balances = computeBalances();

  // Séparer créanciers (balance > 0) et débiteurs (balance < 0)
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, balance: -b.balance })); // montant à payer (positif)

  // Trier pour avoir les plus gros montants en premier (optionnel, mais donne des virements plus "naturels")
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const amount = Math.min(creditor.balance, debtor.balance);

    settlements.push({
      from: debtor.participantId,
      to: creditor.participantId,
      amount,
      fromName: debtor.name,
      toName: creditor.name,
    });

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance === 0) ci++;
    if (debtor.balance === 0) di++;
  }

  return settlements;
}

/**
 * Vérifie que les remboursements équilibrent bien tout.
 * Retourne true si après ces virements, tout le monde est à 0.
 */
export function verifySettlements(settlements: Settlement[]): boolean {
  const balances = computeBalances();
  const finalBalances = new Map<string, number>();

  for (const b of balances) {
    finalBalances.set(b.participantId, b.balance);
  }

  for (const s of settlements) {
    const fromBal = finalBalances.get(s.from) ?? 0;
    const toBal = finalBalances.get(s.to) ?? 0;
    finalBalances.set(s.from, fromBal + s.amount); // débiteur paie, son solde augmente (devient moins négatif)
    finalBalances.set(s.to, toBal - s.amount); // créancier reçoit, son solde diminue
  }

  for (const bal of finalBalances.values()) {
    if (bal !== 0) return false;
  }
  return true;
}

/** Formate un montant en centimes vers "12,34 €" */
export function formatCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  const parts = euros.split(",");
  const withSpaces = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${parts[1]} €`;
}

/** Parse un montant "12,34" ou "12.34" vers centimes (entier) */
export function parseCents(input: string): number | null {
  const text = input.replace(/€|\\beur(os?)?\\b/gi, "").trim();
  if (!text) return null;
  // Remplace la virgule par un point pour parseFloat
  const normalized = text.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return null;
  // Arrondir au centime près (HALF_UP)
  return Math.round(value * 100);
}