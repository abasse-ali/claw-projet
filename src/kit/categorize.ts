// Catégorisation automatique des opérations d'après leur libellé.

import { type Entry } from "./store";

/** Règle de catégorisation : mots-clés → catégorie. */
export type CategoryRule = {
  category: string;
  /** Mots-clés (insensibles à la casse) qui déclenchent cette catégorie. */
  keywords: string[];
  /** Si vrai, ne s'applique qu'aux montants positifs (rentrées). */
  positiveOnly?: boolean;
  /** Si vrai, ne s'applique qu'aux montants négatifs (dépenses). */
  negativeOnly?: boolean;
};

/** Règles de catégorisation par défaut pour les commerçants français courants. */
export const CATEGORY_RULES: CategoryRule[] = [
  // Courses / Alimentation
  { category: "Courses", keywords: ["CARREFOUR", "LECLERC", "E.LECLERC", "AUCHAN", "INTERMARCHE", "CASINO", "MONOPRIX", "FRANPRIX", "LIDL", "ALDI", "GRAND FRAIS", "NATURA", "BIO C", "PICARD"] },
  // Transport
  { category: "Transport", keywords: ["SNCF", "TER", "INTERCITES", "TGV", "OUIGO", "RENFE", "EUROSTAR", "UBER", "FREE NOW", "KAPTEN", "BOLT", "HEETCH", "TOTAL", "ESSO", "SHELL", "BP ", "AVIA", "ELF"] },
  // Factures / Abonnements
  { category: "Factures", keywords: ["EDF", "ENGIE", "TOTAL ENERGIES", "ENI", "DIRECT ENERGIE", "ORANGE", "SFR", "BOUYGUES", "FREE", "REDSF", "RED BY SFR", "SOSH", "B&YOU", "LA POSTE", "ASSURANCE", "MAIF", "MACIF", "GMF", "MATMUT", "AG2R", "ALLIANZ", "AXA", "GROUPAMA", "MAAF", "CNP", "HARMONIE", "MUTUELLE"] },
  // Shopping
  { category: "Shopping", keywords: ["AMAZON", "AMZN", "CDISCOUNT", "FNAC", "DARTY", "DECATHLON", "IKEA", "LEROY MERLIN", "CASTORAMA", "BRICORAMA", "BUT", "CONFORAMA", "ALINEA", "MAISONS DU MONDE", "ZARA", "H&M", "PRIMARK", "UNIQLO", "MANGO", "SEPHORA", "MARIONNAUD", "NOCIBE", "DOUGLAS"] },
  // Sorties / Restauration
  { category: "Sorties", keywords: ["RESTAURANT", "BISTROT", "BRASSERIE", "PIZZERIA", "MC DONALDS", "MCDONALDS", "KFC", "BURGER KING", "QUICK", "SUBWAY", "PAUL", "BRIOCHE DOREE", "LA BOULANGERIE", "STARBUCKS", "COSTA", "EXKI", "PRET A MANGER", "SUSHI", "KEBAB", "TACOS", "DELIVEROO", "UBER EATS", "JUST EAT"] },
  // Santé
  { category: "Santé", keywords: ["PHARMACIE", "PHARMA", "PARAPHARMACIE", "DOCTOLIB", "MEDECIN", "DENTISTE", "OPHTALMO", "KINE", "OSTEO", "LABO", "LABORATOIRE", "RADIOLOGIE", "CENTRE DE SANTE", "MUTUELLE", "SECURITE SOCIALE", "CARTE VITALE"] },
  // Revenus (montants positifs)
  { category: "Revenus", keywords: ["SALAIRE", "PAIE", "REMUNERATION", "INDEMNITE", "ALLOCATION", "CAF", "POLE EMPLOI", "FRANCE TRAVAIL", "RETRAITE", "PENSION", "VIREMENT"], positiveOnly: true },
  // Transferts (virements sortants)
  { category: "Transferts", keywords: ["VIREMENT", "VIR SEPA", "VIREMENT INSTANTANE", "ORDRE DE VIREMENT"], negativeOnly: true },
  // Loisirs / Culture
  { category: "Loisirs", keywords: ["CINEMA", "GAUMONT", "PATHE", "UGC", "MK2", "THEATRE", "OPERA", "CONCERT", "TICKET", "BILLETTERIE", "FNAC SPECTACLES", "DEEZER", "SPOTIFY", "NETFLIX", "DISNEY", "CANAL", "OCS", "APPLE TV", "GOOGLE PLAY", "MICROSOFT", "STEAM", "PLAYSTATION", "XBOX", "NINTENDO", "GOG", "EPIC GAMES"] },
  // Cadeaux
  { category: "Cadeaux", keywords: ["CADEAU", "ANNIVERSAIRE", "NOEL", "FETE", "MARIAGE", "BAPTEME", "COMMUNION", "CREMANT", "CHAMPAGNE", "FLEURS", "FLORISTE", "INTERFLORA", "123FLEURS"] },
  // Banque / Frais
  { category: "Banque", keywords: ["FRAIS", "COTISATION", "COTIS", "AGIOS", "INTERETS", "COMMISSION", "CARTE BANCAIRE", "ASSURANCE CARTE", "PRELEVEMENT", "REJET", "IMPAYE"] },
];

/** Catégorie par défaut quand aucune règle ne correspond. */
export const DEFAULT_CATEGORY = "Autre";

/** Détermine la catégorie d'une opération d'après son libellé et son montant. */
export function categorizeEntry(entry: Pick<Entry, "label" | "amount">): string {
  const label = entry.label.toUpperCase();
  const isPositive = entry.amount > 0;
  const isNegative = entry.amount < 0;

  for (const rule of CATEGORY_RULES) {
    // Vérifier les contraintes de signe
    if (rule.positiveOnly && !isPositive) continue;
    if (rule.negativeOnly && !isNegative) continue;

    for (const keyword of rule.keywords) {
      if (label.includes(keyword.toUpperCase())) {
        return rule.category;
      }
    }
  }

  return DEFAULT_CATEGORY;
}

/** Catégorise un tableau d'opérations (ne modifie pas l'original). */
export function categorizeEntries(entries: Entry[]): Entry[] {
  return entries.map((entry) => ({
    ...entry,
    category: entry.category || categorizeEntry(entry),
  }));
}