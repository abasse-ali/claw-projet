/**
 * Catégorisation automatique des opérations bancaires d'après leur libellé.
 * Règles : correspondance partielle insensible à la casse et aux accents.
 */

export type CategoryRule = {
  name: string;
  icon: string; // Nom de l'icône Lucide
  keywords: string[];
};

export const DEFAULT_CATEGORIES: CategoryRule[] = [
  { name: "Courses", icon: "ShoppingCart", keywords: ["carrefour", "leclerc", "auchan", "intermarché", "super u", "casino", "monoprix", "franprix", "lidl", "aldi", "picard", "bio c", "naturalia", "la vie claire"] },
  { name: "Transport", icon: "Train", keywords: ["sncf", "oui.sncf", "train", "ter ", "tgv", "ouigo", "eurostar", "thales", "ratp", "metro", "bus ", "velib", "lime", "uber", "bolt", "heetch", "freemobility", "parking", "peage", "autoroute", "essence", "total", "shell", "esso", "bp ", "avita", "carburant"] },
  { name: "Logement", icon: "Home", keywords: ["loyer", "edf", "engie", "totalenergies", "eau ", "veolia", "suez", "syndic", "fonciere", "immobilier", "assurance habitation", "taxe fonciere", "taxe habitation", "internet", "freebox", "bbox", "sfr", "orange", "red by sfr", "mobile", "forfait"] },
  { name: "Santé", icon: "HeartPulse", keywords: ["pharmacie", "pharmacy", "medecin", "docteur", "dentiste", "ophtalmo", "kiné", "ostheo", "infirmier", "laboratoire", "analyse", "radiologie", "hopital", "clinique", "mutuelle", "sante", "cpam", "ameli", "opticien", "lunettes", "lentilles"] },
  { name: "Restaurants", icon: "Utensils", keywords: ["restaurant", "bistro", "brasserie", "pizzeria", "kebab", "macdonald", "mcdo", "quick", "burger king", "kfc", "subway", "five guys", "deliveroo", "uber eats", "just eat", "resto", "cantine", "cafeteria"] },
  { name: "Cafés", icon: "Coffee", keywords: ["cafe", "starbucks", "colombus", "coutume", "fragments", "kb ", "café", "expresso", "cappuccino", "latte", "boulangerie", "patisserie", "paul ", "brioche doree", "marie blachere"] },
  { name: "Shopping", icon: "ShoppingBag", keywords: ["amazon", "cdiscount", "fnac", "darty", "boulanger", "ldlc", "rueducommerce", "zalando", "asos", "vinted", "leboncoin", "ebay", "etsy", "she in", "tem", "wish", "aliexpress", "decathlon", "go sport", "intersport", "intersport", "zara", "h&m", "uniqlo", "celio", "jules", "promod", "kiabi", "la halle", "camaieu", "etam", "cache cache", "bonobo", "maje", "sandro", "claudie pierlot"] },
  { name: "Loisirs", icon: "Gamepad2", keywords: ["cinema", "pathe", "gaumont", "ugc", "mk2", "netflix", "disney", "prime video", "canal+", "spotify", "deezer", "apple music", "youtube premium", "steam", "playstation", "xbox", "nintendo", "epic games", "gog", "itch.io", "bowling", "laser game", "escape game", "parc attraction", "disneyland", "parc asterix", "futuroscope", "concert", "spectacle", "theatre", "opera", "museum", "musee", "exposition"] },
  { name: "Beauté", icon: "Sparkles", keywords: ["coiffeur", "coiffure", "barbier", "beaute", "esthetique", "institut", "spa", "massage", "manucure", "pedicure", "ongles", "epilation", "laser", "sephora", "marionnaud", "nichee", "l'occitane", "yves rocher", "the body shop", "rituals", "kiko", "nyx", "mac cosmetics", "bobbi brown", "clinique", "estee lauder", "lancome", "dior", "chanel", "guerlain", "clarins", "biotherm", "vichy", "la roche posay", "avene", "uriage", "bioderma", "nuxe", "weleda", "dr hauschka"] },
  { name: "Banque/Assurance", icon: "Shield", keywords: ["assurance", "axa", "allianz", "generali", "maif", "matmut", "macif", "groupama", "gmf", "credit agricole", "banque populaire", "caisse epargne", "credit mutuel", "bnp paribas", "societe generale", "credit lyonnais", "lcl", "hsbc", "ing", "bourso", "hello bank", "fortuneo", "bforbank", "monabanq", "orange bank", "n26", "revolut", "lydia", "pumpkin", "paypal", "carte bleue", "cb ", "visa", "mastercard", "cotisation", "frais bancaire", "agios", "interet"] },
  { name: "Éducation", icon: "GraduationCap", keywords: ["ecole", "college", "lycee", "universite", "faculte", "formation", "cour", "cours", "langue", "anglais", "espagnol", "allemand", "chinois", "japonais", "conservatoire", "musique", "piano", "guitare", "violon", "danse", "theatre", "sport", "club", "licence", "master", "doctorat", "thèse", "mémoire", "stage", "apprentissage", "alternance", "cpf", "pole emploi", "france travail"] },
  { name: "Enfants", icon: "Baby", keywords: ["creche", "garderie", "nounou", "assistante maternelle", "baby sitting", "babysitting", "école maternelle", "école primaire", "centre aere", "centre de loisirs", "colonie", "vacances enfants", "jouet", "lego", "playmobil", "poupee", "velo enfant", "trottinette", "piscine", "natation", "gym", "judo", "karate", "foot", "rugby", "tennis", "danse", "poney", "equitation"] },
  { name: "Cadeaux/Dons", icon: "Gift", keywords: ["cadeau", "anniversaire", "noel", "fete", "mariage", "bapteme", "communion", "depart retraite", "pot de depart", "cagnotte", "le pot commun", "lydia", "paypal", "don", "association", "fondation", "secours populaire", "restos du coeur", "croix rouge", "unicef", "msf", "amnesty", "greenpeace", "wwf", "fondation abbé pierre", "emmaus", "petits frères des pauvres"] },
  { name: "Impôts/Administratif", icon: "FileText", keywords: ["impot", "tresor public", "dgfip", "cfp", "taxe", "amende", "pv ", "contravention", "radar", "stationnement", "prefecture", "sous-prefecture", "mairie", "etat civil", "passeport", "carte identite", "permis", "carte grise", "immatriculation", "controle technique", "assurance auto", "assurance moto", "assurance scooter"] },
  { name: "Salaire/Revenus", icon: "Wallet", keywords: ["salaire", "paie", "remuneration", "virement", "prelevement", "allocat", "caf ", "pajemploi", "rsa", "aah", "are", "chomage", "pole emploi", "france travail", "indemnite", "prime", "treizieme mois", "quatorzieme mois", "participation", "interessement", "dividende", "interet", "livret a", "ldds", "lep", "pel", "cel", "pea", "assurance vie", "retraite", "pension", "reversion"] },
  { name: "Autre", icon: "Tag", keywords: [] },
];

/**
 * Normalise une chaîne : minuscules, sans accents, espaces réduits.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trouve la catégorie correspondant à un libellé.
 * Retourne "Autre" si aucune correspondance.
 */
export function categorize(label: string, categories: CategoryRule[] = DEFAULT_CATEGORIES): string {
  const normalized = normalize(label);
  
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (normalized.includes(normalize(keyword))) {
        return category.name;
      }
    }
  }
  
  return "Autre";
}

/**
 * Retourne l'icône associée à une catégorie.
 */
export function getCategoryIcon(categoryName: string, categories: CategoryRule[] = DEFAULT_CATEGORIES): string {
  const category = categories.find(c => c.name === categoryName);
  return category?.icon || "Tag";
}

/**
 * Vérifie si une catégorie existe dans la liste.
 */
export function isValidCategory(categoryName: string, categories: CategoryRule[] = DEFAULT_CATEGORIES): boolean {
  return categories.some(c => c.name === categoryName);
}