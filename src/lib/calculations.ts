// Types et logique de calcul pour le partage de dépenses
// Utilise des centimes (entiers) pour éviter les problèmes de précision

export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  label: string;
  amount: number; // en centimes
  paidBy: string; // participant id
  forWhom: string[]; // participant ids, empty = everyone
  date: string; // ISO date
}

export interface Balance {
  participantId: string;
  participantName: string;
  paid: number; // ce qu'il a payé (centimes)
  share: number; // sa part (centimes)
  balance: number; // payé - part (positif = on lui doit, négatif = il doit)
}

export interface Transfer {
  from: string; // participant id qui paie
  to: string; // participant id qui reçoit
  amount: number; // en centimes
}

/**
 * Calcule les soldes de chaque participant
 * La somme des soldes doit toujours faire 0
 */
export function calculateBalances(
  participants: Participant[],
  expenses: Expense[]
): Balance[] {
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  // Initialiser à 0
  for (const p of participants) {
    paidMap.set(p.id, 0);
    shareMap.set(p.id, 0);
  }

  // Calculer ce que chacun a payé et sa part
  for (const expense of expenses) {
    const paidById = expense.paidBy;
    const forWhom = expense.forWhom.length > 0 ? expense.forWhom : participants.map(p => p.id);
    const shareCount = forWhom.length;
    const sharePerPerson = Math.floor(expense.amount / shareCount);
    const remainder = expense.amount % shareCount;

    // Celui qui a payé
    paidMap.set(paidById, (paidMap.get(paidById) || 0) + expense.amount);

    // Répartir la part
    for (let i = 0; i < forWhom.length; i++) {
      const participantId = forWhom[i];
      // Le reste (centimes qui ne se divisent pas) est réparti sur les premiers participants
      const extra = i < remainder ? 1 : 0;
      const share = sharePerPerson + extra;
      shareMap.set(participantId, (shareMap.get(participantId) || 0) + share);
    }
  }

  // Construire les soldes
  const balances: Balance[] = [];
  for (const p of participants) {
    const paid = paidMap.get(p.id) || 0;
    const share = shareMap.get(p.id) || 0;
    balances.push({
      participantId: p.id,
      participantName: p.name,
      paid,
      share,
      balance: paid - share,
    });
  }

  // Vérification : la somme des soldes doit être 0
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);
  if (totalBalance !== 0) {
    console.warn(`Somme des soldes non nulle: ${totalBalance} centimes`);
  }

  return balances;
}

/**
 * Calcule les remboursements minimaux pour équilibrer tout
 * Algorithme glouton : ceux qui doivent paient ceux à qui on doit
 * en partant des montants les plus élevés
 */
export function calculateTransfers(balances: Balance[]): Transfer[] {
  // Séparer créanciers (balance > 0) et débiteurs (balance < 0)
  const creditors = balances
    .filter(b => b.balance > 0)
    .map(b => ({ id: b.participantId, name: b.participantName, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount); // plus gros créanciers d'abord

  const debtors = balances
    .filter(b => b.balance < 0)
    .map(b => ({ id: b.participantId, name: b.participantName, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount); // plus gros débiteurs d'abord

  const transfers: Transfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const transferAmount = Math.min(creditor.amount, debtor.amount);

    transfers.push({
      from: debtor.id,
      to: creditor.id,
      amount: transferAmount,
    });

    creditor.amount -= transferAmount;
    debtor.amount -= transferAmount;

    if (creditor.amount === 0) creditorIndex++;
    if (debtor.amount === 0) debtorIndex++;
  }

  return transfers;
}

/**
 * Vérifie qu'un nom de participant n'existe pas déjà (insensible à la casse et espaces)
 */
export function isDuplicateName(participants: Participant[], name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return participants.some(p => p.name.trim().toLowerCase() === normalized);
}

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Formate un montant en centimes vers string euros pour l'affichage
 */
export function formatCents(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

/**
 * Parse un montant string (ex: "12,50" ou "12.50") vers centimes
 */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}