// Logique métier pour le partage de dépenses d'un voyage
// Tous les montants sont en centimes (entiers) pour éviter les erreurs de virgule flottante

export type Participant = {
  id: string;
  firstName: string;
};

export type Expense = {
  id: string;
  label: string;
  amountCents: number; // positif
  paidBy: string; // participant id
  forWhom: string[]; // participant ids (tous par défaut)
  date: string; // ISO "YYYY-MM-DD"
};

export type TripData = {
  participants: Participant[];
  expenses: Expense[];
};

export type Balance = {
  participantId: string;
  firstName: string;
  paidCents: number; // ce qu'il a payé au total
  shareCents: number; // sa part au total
  balanceCents: number; // paid - share (positif = on lui doit, négatif = il doit)
};

export type Settlement = {
  from: string; // participant id qui paie
  to: string; // participant id qui reçoit
  amountCents: number; // montant en centimes
};

/**
 * Normalise un prénom pour la comparaison (unicité)
 * Enlève les espaces, met en minuscules, normalise Unicode
 */
export function normalizeFirstName(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

/**
 * Vérifie si un prénom est déjà pris (insensible à la casse et aux espaces)
 */
export function isFirstNameTaken(participants: Participant[], firstName: string, excludeId?: string): boolean {
  const normalized = normalizeFirstName(firstName);
  return participants.some(
    (p) => p.id !== excludeId && normalizeFirstName(p.firstName) === normalized
  );
}

/**
 * Calcule les soldes de chaque participant
 * balance = paid - share
 * La somme des balances doit toujours faire 0
 */
export function computeBalances(participants: Participant[], expenses: Expense[]): Balance[] {
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  // Initialiser à 0
  for (const p of participants) {
    paidMap.set(p.id, 0);
    shareMap.set(p.id, 0);
  }

  // Calculer ce que chacun a payé
  for (const expense of expenses) {
    const currentPaid = paidMap.get(expense.paidBy) || 0;
    paidMap.set(expense.paidBy, currentPaid + expense.amountCents);

    // Répartir la dépense entre les concernés
    const shareCount = expense.forWhom.length;
    if (shareCount === 0) continue;

    const sharePerPerson = Math.floor(expense.amountCents / shareCount);
    const remainder = expense.amountCents % shareCount;

    // Trouver l'index du payeur dans forWhom (s'il y est), sinon premier
    const payerIndex = expense.forWhom.indexOf(expense.paidBy);
    const remainderIndex = payerIndex >= 0 ? payerIndex : 0;

    for (let i = 0; i < shareCount; i++) {
      const participantId = expense.forWhom[i];
      const currentShare = shareMap.get(participantId) || 0;
      // Le participant à remainderIndex prend le reste pour que la somme des parts = montant total
      const extra = i === remainderIndex ? remainder : 0;
      shareMap.set(participantId, currentShare + sharePerPerson + extra);
    }
  }

  // Construire les balances
  const balances: Balance[] = [];
  for (const p of participants) {
    const paidCents = paidMap.get(p.id) || 0;
    const shareCents = shareMap.get(p.id) || 0;
    balances.push({
      participantId: p.id,
      firstName: p.firstName,
      paidCents,
      shareCents,
      balanceCents: paidCents - shareCents,
    });
  }

  return balances;
}

/**
 * Vérifie que la somme des balances fait 0
 */
export function validateBalancesSumZero(balances: Balance[]): boolean {
  const sum = balances.reduce((acc, b) => acc + b.balanceCents, 0);
  return sum === 0;
}

/**
 * Calcule les remboursements minimaux (algorithme glouton)
 * Retourne la liste des virements qui équilibrent tout
 */
export function computeSettlements(balances: Balance[]): Settlement[] {
  // Créer des copies mutables triées
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balanceCents - a.balanceCents); // Plus gros créanciers d'abord

  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ ...b, balanceCents: -b.balanceCents })) // Montant positif = ce qu'ils doivent
    .sort((a, b) => b.balanceCents - a.balanceCents); // Plus gros débiteurs d'abord

  const settlements: Settlement[] = [];
  let i = 0; // index créanciers
  let j = 0; // index débiteurs

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(creditor.balanceCents, debtor.balanceCents);

    settlements.push({
      from: debtor.participantId,
      to: creditor.participantId,
      amountCents: amount,
    });

    creditor.balanceCents -= amount;
    debtor.balanceCents -= amount;

    if (creditor.balanceCents === 0) i++;
    if (debtor.balanceCents === 0) j++;
  }

  return settlements;
}

/**
 * Formate un montant en centimes vers "12,50 €"
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absCents = Math.abs(cents);
  const euros = Math.floor(absCents / 100);
  const centimes = absCents % 100;
  return `${sign}${euros},${String(centimes).padStart(2, "0")} €`;
}

/**
 * Parse un montant saisi ("12,50" ou "12.50") vers centimes
 */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Date d'aujourd'hui en ISO
 */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Vérifie si un participant peut être supprimé (pas dans une dépense)
 */
export function canDeleteParticipant(participantId: string, expenses: Expense[]): boolean {
  return !expenses.some(
    (e) => e.paidBy === participantId || e.forWhom.includes(participantId)
  );
}

/**
 * Crée les données initiales vides
 */
export function createEmptyTrip(): TripData {
  return { participants: [], expenses: [] };
}