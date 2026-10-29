// Catégorisation automatique des opérations d'après leur libellé.

/** Normalise une chaîne : minuscules, sans accents, sans espaces, & devient et. */
function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "et").replace(/\s+/g, "");
}

/** Mots-clés pour la catégorisation automatique.
 *  L'ordre compte : le premier qui matche gagne. */
export const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: "Santé", keywords: ["pharmacie", "medecin", "docteur", "dentiste", "kine", "osteo", "opticien", "lunettes", "mutuelle", "sante", "securitesociale", "cpam", "hopital", "clinique", "laboratoire", "analyse", "radio", "irm", "scanner"] },
  { category: "Restauration", keywords: ["restaurant", "bistro", "brasserie", "pizzeria", "kebab", "burger", "mcdo", "mcdonald", "quick", "kfc", "subway", "fiveguys", "pomme", "sushi", "wok", "livraison", "ubereats", "deliveroo", "justeat", "cafe", "bar", "pub", "bistrot"] },
  { category: "Logement", keywords: ["loyer", "edf", "engie", "totalenergies", "eau", "veolia", "suez", "internet", "orange", "sfr", "bouygues", "free", "box", "assurancehabitation", "gaz", "electricite", "chauffage"] },
  { category: "Virements", keywords: ["virementrecu", "virementemis", "virementinstantane", "virementsepa", "remboursement", "remise"] },
  { category: "Salaire", keywords: ["salaire", "payroll", "remuneration", "indemnite", "prime", "13eme", "congespayes", "chomage", "poleemploi", "allocation", "allocations", "rsa", "aah", "pension", "retraite"] },
  { category: "Courses", keywords: ["carrefour", "leclerc", "auchan", "intermarche", "monoprix", "franprix", "casino", "superu", "hyperu", "cora", "match", "simply", "aldi", "lidl", "netto", "picard", "grandfrais", "biocoop", "naturalia", "courses", "drive"] },
  { category: "Transport", keywords: ["sncf", "ter", "tgv", "ouigo", "transilien", "ratp", "metro", "velib", "lime", "tier", "bolt", "kapten", "heetch", "taxi", "parking", "autoroute", "peage", "essence", "totalenergies", "shell", "esso", "bp", "avril", "carburant", "ubertrip"] },
  { category: "Shopping", keywords: ["amazon", "cdiscount", "fnac", "darty", "boulanger", "but", "conforama", "ikea", "maisonsdumonde", "zara", "hm", "hetm", "primark", "uniqlo", "mango", "pullbear", "bershka", "stradivarius", "oemine", "sephora", "marionnaud", "nocibe", "decathlon", "gosport", "intersport", "sport2000", "vinted", "leboncoin", "ebay"] },
  { category: "Loisirs", keywords: ["cinema", "gaumont", "pathe", "ugc", "mk2", "theatre", "concert", "festival", "billetterie", "fnacspectacle", "ticketmaster", "netflix", "spotify", "deezer", "disney+", "amazonprime", "canal+", "steam", "playstation", "xbox", "nintendo", "jeux", "bowling", "laser", "escape", "piscine", "salledesport", "fitness", "basicfit", "keepcool", "neoness"] },
  { category: "Banque", keywords: ["fraisbancaire", "cotisationcarte", "assurancecarte", "prelevement", "rejet", "agios", "interet", "epargne", "livret", "pel", "cel", "assurancevie", "bourse", "crypto", "bitcoin", "ethereum", "coinbase", "kraken", "binance"] },
];

/** Catégorie par défaut pour les opérations non reconnues. */
export const DEFAULT_CATEGORY = "Autre";

/** Trouve la catégorie d'un libellé.
 *  Retourne la catégorie correspondante ou "Autre". */
export function categorize(label: string): string {
  const lower = norm(label);
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(norm(keyword))) {
        return rule.category;
      }
    }
  }
  return DEFAULT_CATEGORY;
}

/** Liste de toutes les catégories disponibles (pour l'UI). */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const rule of CATEGORY_RULES) {
    categories.add(rule.category);
  }
  categories.add(DEFAULT_CATEGORY);
  return [...categories].sort();
}

/** Icône pour une catégorie (nom de l'icône Lucide). */
export function categoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Courses: "ShoppingCart",
    Transport: "Bus",
    Logement: "Home",
    Santé: "HeartPulse",
    Restauration: "Utensils",
    Shopping: "ShoppingBag",
    Loisirs: "Gamepad2",
    Banque: "Wallet",
    Salaire: "ArrowDownCircle",
    Virements: "ArrowRightLeft",
    Autre: "Tag",
  };
  return icons[category] || "Tag";
}