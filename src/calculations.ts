// Logique de calcul pour le partage de dépenses
// Tout est calculé en centimes (entiers) pour éviter les erreurs d'arrondi

import type { Participant, Expense, Balance, Settlement, TripData } from "./types";

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Date d'aujourd'hui au format ISO (YYYY-MM-DD)
 */
export function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalise un nom pour la comparaison (insensible à la casse, sans espaces, NFC)
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

/**
 * Vérifie si un nom de participant est déjà pris (insensible à la casse)
 */
export function isNameTaken(participants: Participant[], name: string, excludeId?: string): boolean {
  const normalized = normalizeName(name);
  return participants.some(
    (p) => p.id !== excludeId && normalizeName(p.name) === normalized
  );
}

/**
 * Parse un montant en euros (ex: "12,50" ou "12.50") en centimes (entier)
 */
export function parseAmountToCents(input: string): number {
  if (!input || typeof input !== "string") return 0;

  const text = input.replace(/€|eur/gi, "").trim();
  if (/[a-zA-Z]/.test(text)) return 0;

  // Compter les séparateurs dans le texte original (avant suppression espaces)
  const commaCount = (text.match(/,/g) || []).length;
  const dotCount = (text.match(/\./g) || []).length;

  // On garde seulement chiffres, virgules, points, signe, espaces
  const cleaned = text.replace(/[^\d,.+ \-]/g, "");
  // Supprimer les espaces (séparateurs de milliers possibles)
  const digits = cleaned.replace(/\s/g, "");

  if (!digits) return 0;

  // Détecter le séparateur décimal : le dernier , ou .
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const last = Math.max(lastComma, lastDot);

  let decimalSep = -1;
  let decimalDigits = "";

  // Compter les séparateurs dans les digits (sans espaces)
  const commaCountDigits = (digits.match(/,/g) || []).length;
  const dotCountDigits = (digits.match(/\./g) || []).length;

  // Si plus d'un séparateur du même type -> invalide (ex: "12,50,30" ou "1.2.3")
  if (commaCountDigits > 1 || dotCountDigits > 1) {
    return 0;
  }

  if (lastComma >= 0 && lastDot >= 0) {
    // Les deux présents : celui qui est à la fin est le décimal si 1-2 chiffres après
    const afterComma = digits.slice(lastComma + 1);
    const afterDot = digits.slice(lastDot + 1);

    if (/^\d{1,2}$/.test(afterComma) && !/^\d{1,2}$/.test(afterDot)) {
      decimalSep = lastComma;
      decimalDigits = afterComma;
    } else if (/^\d{1,2}$/.test(afterDot) && !/^\d{1,2}$/.test(afterComma)) {
      decimalSep = lastDot;
      decimalDigits = afterDot;
    } else {
      // Ambigu ou invalide (ex: 1,234,56 ou 1.234.56)
      return 0;
    }
  } else if (lastComma >= 0) {
    const afterComma = digits.slice(lastComma + 1);
    if (/^\d{1,2}$/.test(afterComma)) {
      decimalSep = lastComma;
      decimalDigits = afterComma;
    }
  } else if (lastDot >= 0) {
    const afterDot = digits.slice(lastDot + 1);
    if (/^\d{1,2}$/.test(afterDot)) {
      decimalSep = lastDot;
      decimalDigits = afterDot;
    }
  }

  let value: number;
  if (decimalSep >= 0) {
    // Il y a une partie décimale valide (1-2 chiffres)
    const whole = digits.slice(0, decimalSep).replace(/[,.]/g, "");
    decimalDigits = decimalDigits.padEnd(2, "0").slice(0, 2);
    value = Number(`${whole}.${decimalDigits}`);
  } else {
    // Pas de décimales détectées (1-2 chiffres après le dernier séparateur)
    if (last >= 0) {
      const afterLast = digits.slice(last + 1);
      const separatorCount = commaCountDigits + dotCountDigits;
      
      if (separatorCount === 1 && afterLast.length >= 3) {
        // Un seul séparateur dans le texte original, avec 3+ chiffres après
        // En convention française : virgule = décimal, point = milliers
        // Mais on ne sait pas si c'est "2,665" (2.665€) ou "1.234" (1234€)
        // Heuristique : si c'est une virgule et 3 chiffres -> décimal avec arrondi
        // Si c'est un point et 3 chiffres -> séparateur de milliers
        if (lastComma >= 0 && afterLast.length === 3) {
          // "2,665" -> 2.665 euros, arrondi HALF_UP
          const whole = digits.slice(0, last).replace(/[,.]/g, "");
          const decimal = afterLast;
          const decimalValue = Number(`0.${decimal}`);
          const roundedDecimal = Math.round(decimalValue * 100) / 100;
          value = Number(whole) + roundedDecimal;
        } else {
          // Point avec 3 chiffres ou virgule avec >3 chiffres -> milliers
          value = Number(digits.replace(/[,.]/g, ""));
        }
      } else if (/^\d{3}$/.test(afterLast)) {
        // 3 chiffres exactement après le séparateur -> séparateur de milliers
        value = Number(digits.replace(/[,.]/g, ""));
      } else {
        // Plusieurs séparateurs sans décimal clair -> invalide
        return 0;
      }
    } else {
      // Pas de séparateur du tout
      value = Number(digits);
    }
  }

  if (!Number.isFinite(value)) return 0;

  // Arrondir au centime près (HALF_UP) - value est en euros, on multiplie par 100
  return Math.round(value * 100);
}

/**
 * Formate des centimes en string euros (ex: 1250 -> "12,50 €")
 */
export function formatCents(cents: number): string {
  const euros = Math.abs(cents) / 100;
  const sign = cents < 0 ? "\u2212" : "";
  const formatted = euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Remplacer l'espace insécable fin par un espace normal pour la cohérence
  return `${sign}${formatted.replace(/\u202f/g, " ")} \u20ac`;
}

/**
 * Formate des centimes en string euros signé (ex: 1250 -> "+12,50 €", -800 -> "−8,00 €")
 */
export function formatSignedCents(cents: number): string {
  const euros = cents / 100;
  const formatted = euros.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    signDisplay: "exceptZero",
  });
  // Remplacer l'espace insécable fin par un espace normal, et le signe moins par le vrai signe moins
  return formatted
    .replace(/\u202f/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/^-/, "\u2212");
}

/**
 * Calcule les soldes de tous les participants
 * La somme des soldes doit toujours faire 0
 */
export function computeBalances(trip: TripData): Balance[] {
  const { participants, expenses } = trip;

  // Initialiser les compteurs
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  participants.forEach((p) => {
    paidMap.set(p.id, 0);
    shareMap.set(p.id, 0);
  });

  // Calculer ce que chacun a payé
  expenses.forEach((expense) => {
    const currentPaid = paidMap.get(expense.paidBy) ?? 0;
    paidMap.set(expense.paidBy, currentPaid + expense.amount);

    // Déterminer qui partage cette dépense
    const sharers = expense.sharedWith.length > 0
      ? expense.sharedWith
      : participants.map((p) => p.id);

    const shareCount = sharers.length;
    if (shareCount === 0) return;

    // Répartir à parts égales avec gestion du centime
    const baseShare = Math.floor(expense.amount / shareCount);
    const remainder = expense.amount % shareCount;

    sharers.forEach((participantId, index) => {
      const currentShare = shareMap.get(participantId) ?? 0;
      // Les premiers participants prennent le centime en plus
      const extra = index < remainder ? 1 : 0;
      shareMap.set(participantId, currentShare + baseShare + extra);
    });
  });

  // Construire les soldes
  return participants.map((participant) => {
    const paid = paidMap.get(participant.id) ?? 0;
    const share = shareMap.get(participant.id) ?? 0;
    return {
      participantId: participant.id,
      participantName: participant.name,
      paid,
      share,
      balance: paid - share,
    };
  });
}

/**
 * Calcule les remboursements optimaux (minimum de transactions)
 * Algorithme glouton : celui qui doit le plus paie celui à qui on doit le plus
 */
export function computeSettlements(balances: Balance[]): Settlement[] {
  // Créer des copies mutables triées
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, remaining: -b.balance }))
    .sort((a, b) => a.remaining - b.remaining); // Celui qui doit le plus en premier

  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining); // Celui à qui on doit le plus en premier

  const settlements: Settlement[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      settlements.push({
        from: debtor.participantId,
        fromName: debtor.participantName,
        to: creditor.participantId,
        toName: creditor.participantName,
        amount,
      });

      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }

    if (debtor.remaining === 0) debtorIndex++;
    if (creditor.remaining === 0) creditorIndex++;
  }

  return settlements;
}

/**
 * Vérifie que la somme des soldes fait 0
 */
export function validateBalances(balances: Balance[]): boolean {
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  return sum === 0;
}

/**
 * Calcule le total des dépenses
 */
export function computeTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Calcule les dépenses par participant (ce qu'il a payé)
 */
export function computePaidByParticipant(expenses: Expense[], participants: Participant[]): Map<string, number> {
  const map = new Map<string, number>();
  participants.forEach((p) => map.set(p.id, 0));
  expenses.forEach((e) => {
    const current = map.get(e.paidBy) ?? 0;
    map.set(e.paidBy, current + e.amount);
  });
  return map;
}