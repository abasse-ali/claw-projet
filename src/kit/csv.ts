// Import/export CSV pour les relevés bancaires français :
// - séparateur : point-virgule (;)
// - date : JJ/MM/AAAA
// - montant : virgule pour les décimales, espace (ou espace insécable) pour les milliers, négatif = dépense
// - colonnes : Date;Libellé;Montant
// Déduplication : on ne compte pas deux fois la même opération (même date, libellé, montant)

import { parseAmount, today } from "./format";
import { STORE_KEY, useEntries, type Entry } from "./store";
import { toast } from "./toast";

const cell = (value: unknown) => {
  const text = String(value ?? "");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Enregistre la copie sur le téléphone (« appli-2026-10-28.csv »). */
export function exportCsv(): void {
  const entries = useEntries.getState().entries;
  const lines = entries.map((entry) => [entry.date, entry.label, String(entry.amount).replace(".", ","), entry.category, entry.id].map(cell).join(";"));
  const blob = new Blob([`\ufeff${["date;libellé;montant;catégorie;id", ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${STORE_KEY}-${today()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast(`Copie enregistrée : ${link.download}`);
}

export function parseBankCsv(text: string): string[][] {
  const body = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quoted) {
      if (char === '"' && body[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') { cells.push(value); value = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[index + 1] === "\n") index += 1;
      cells.push(value); rows.push(cells); cells = []; value = "";
    } else value += char;
  }
  if (value || cells.length) { cells.push(value); rows.push(cells); }
  return rows.filter((line) => line.some((text) => text.trim()));
}

export function parseFrenchDate(dateStr: string): string {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return today();
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return today();
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return today();
  // Vérifier que la date est valide (ex: 31/04 n'existe pas)
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return today();
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseFrenchAmount(amountStr: string): number {
  // Supprime espaces, espaces insécables (U+00A0), espaces fines insécables (U+202F)
  const cleaned = amountStr.replace(/[\s\u00A0\u202F]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return isNaN(value) ? NaN : value;
}

export function makeEntryKey(date: string, label: string, amount: number): string {
  return `${date}|${label.trim().toLowerCase()}|${amount.toFixed(2)}`;
}

const names: Record<string, keyof Entry> = { date: "date", libelle: "label", label: "label", montant: "amount", amount: "amount", categorie: "category", category: "category", id: "id" };
const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Reprend un relevé bancaire CSV (format français) ; rend le nombre d'opérations importées (nouvellement ajoutées). */
export async function importCsv(file: File): Promise<number> {
  const rows = parseBankCsv(await file.text());
  if (rows.length === 0) {
    toast("Ce fichier ne contient aucune opération lisible.");
    return 0;
  }

  // Trouver l'en-tête (première ligne non vide)
  let headerIndex = 0;
  while (headerIndex < rows.length && rows[headerIndex].every(c => !c.trim())) {
    headerIndex++;
  }
  if (headerIndex >= rows.length) {
    toast("Ce fichier ne contient aucune opération lisible.");
    return 0;
  }
  const head = rows[headerIndex];
  const lines = rows.slice(headerIndex + 1);

  const fields = (head || []).map((title) => names[plain(title)]);

  const before = useEntries.getState().entries;
  const existingKeys = new Set(before.map(e => makeEntryKey(e.date, e.label, e.amount)));

  const found: Entry[] = [];
  let imported = 0;

  for (const cells of lines) {
    const line = Object.fromEntries(fields.map((field, index) => [field, (cells[index] || "").trim()])) as Record<string, string>;
    
    // Format bancaire : Date;Libellé;Montant
    const dateStr = line.date || "";
    const label = line.label || "";
    const amountStr = line.amount || "";
    const category = line.category || "";

    if (!dateStr || !label || !amountStr) continue;

    const date = parseFrenchDate(dateStr);
    const amount = parseFrenchAmount(amountStr);

    if (!Number.isFinite(amount)) continue;

    // Montant négatif = dépense, positif = rentrée (format banque)
    const entryKey = makeEntryKey(date, label, amount);
    
    if (existingKeys.has(entryKey)) {
      continue; // Déjà importé
    }

    existingKeys.add(entryKey);
    
    found.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      amount: Math.round(amount * 100) / 100,
      category,
      date,
    });
    imported++;
  }

  if (imported === 0) {
    toast("Aucune nouvelle opération à importer (doublons ou format non reconnu).");
    return 0;
  }

  // Catégorisation automatique pour les nouvelles entrées
  const categorized = autoCategorize(found);

  useEntries.setState({ entries: [...before, ...categorized] });
  toast(`${imported} ${imported > 1 ? "opérations importées" : "opération importée"}`, {
    action: { label: "Annuler", run: () => useEntries.setState({ entries: before }) },
  });
  return imported;
}

export function autoCategorize(entries: Entry[]): Entry[] {
  const rules: [RegExp, string][] = [
    [/carrefour|auchan|leclerc|intermarché|supermarché|épicerie|franprix|monoprix|lidl|aldi|casino|cora|match|simply|bio\s*c\s*bon|naturalia/i, "Courses"],
    [/sncf|ter|tgv|ouigo|transilien|ratp|metro|bus|tram|navigo|velib|velo|uber|bolt|free2move|cityscoot/i, "Transport"],
    [/amazon|cdiscount|fnac|darty|ikea|decathlon|sephora|zara|hm|celio|uniqlo|primark|sheIn|asos|vinted/i, "Shopping"],
    [/pharmacie|docteur|medecin|dentiste|opticien|mutuelle|sécurité\s*sociale|cpam|ameli/i, "Santé"],
    [/restaurant|bistro|brasserie|pizza|burger|kebab|sushi|macdo|quick|kfc|subway|deliveroo|uber\s*eats|just\s*eat/i, "Restaurants"],
    [/edf|engie|total|direct\s*energie|énergie|électricité|gaz|eau\s*de\s*paris|veolia|saur/i, "Énergie"],
    [/orange|sfr|bouygues|free|sosh|red\s*by\s*sfr|prixtel|syma|corinis|forfait|internet|box/i, "Télécom"],
    [/loyer|agence|immobilier|foncia|nexity|seloger|bien\s*ici|charges|syndic/i, "Logement"],
    [/assurance|maif|macif|matmut|gmf|groupama|axa|allianz|generali|maaf/i, "Assurance"],
    [/salaire|paie|virement|prélèvement|allocations?|caf|pôle\s*emploi|france\s*travail|indemnités?|retraite|pension/i, "Revenus"],
    [/spotify|netflix|deezer|disney|canal|prime|youtube|apple\s*music|abonnements?/i, "Abonnements"],
    [/cinéma|théâtre|concert|musée|expo|bowling|laser|escape|jeux|steam|playstation|xbox|nintendo/i, "Loisirs"],
    [/cadeau|anniversaire|noël|fête|mariage|baptême/i, "Cadeaux"],
    [/essence|carburant|total|shell|esso|avip|elf|bp|station|autoroute|péage|parking/i, "Carburant"],
    [/banque|frais|commission|agios|intérêts|cotisation|carte/i, "Frais bancaires"],
  ];

  return entries.map(entry => {
    if (entry.category) return entry; // Déjà catégorisée
    
    for (const [pattern, category] of rules) {
      if (pattern.test(entry.label)) {
        return { ...entry, category };
      }
    }
    return { ...entry, category: "Autre" };
  });
}

/** Ouvre le choix d'un fichier, puis reprend la copie choisie. */
export function pickCsv(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void importCsv(file);
  });
  input.click();
}