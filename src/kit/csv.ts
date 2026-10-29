// Import/export CSV pour les relevés bancaires (format : Date;Libellé;Montant, point-virgule,
// date JJ/MM/AAAA, montant avec virgule décimale et espace pour les milliers, négatif = dépense).
// Détection des doublons par (date, libellé, montant).

import { parseAmount, today } from "./format";
import { STORE_KEY, useEntries, type Entry } from "./store";
import { toast } from "./toast";
import { categorize } from "./categories";

const cell = (value: unknown) => {
  const text = String(value ?? "");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Enregistre la copie sur le téléphone (« appli-2026-10-28.csv »). */
export function exportCsv(): void {
  const entries = useEntries.getState().entries;
  const lines = entries.map((entry) => [entry.date, entry.label, String(entry.amount).replace(".", ","), entry.category, entry.id].map(cell).join(";"));
  const blob = new Blob([`\uFEFF${["date;libellé;montant;catégorie;id", ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${STORE_KEY}-${today()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast(`Copie enregistrée : ${link.download}`);
}

function parse(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, "");
  const first = body.split(/\r?\n/, 1)[0];
  const separator = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
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
    else if (char === separator) { cells.push(value); value = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[index + 1] === "\n") index += 1;
      cells.push(value); rows.push(cells); cells = []; value = "";
    } else value += char;
  }
  if (value || cells.length) { cells.push(value); rows.push(cells); }
  return rows.filter((line) => line.some((text) => text.trim()));
}

/** Parseur CSV exporté pour les tests */
export { parse };

/** Détecte si c'est un format banque (colonnes Date;Libellé;Montant uniquement, pas d'id ni catégorie) */
function isBankFormat(head: string[]): boolean {
  if (!head || head.length === 0) return false;
  const lower = head.map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  // Format banque pur : seulement date, libellé, montant (3 colonnes)
  // Format export appli : a aussi categorie et id (5 colonnes)
  const hasDate = lower.includes("date");
  const hasLibelle = lower.includes("libelle");
  const hasMontant = lower.includes("montant");
  const hasCategorie = lower.includes("categorie");
  const hasId = lower.includes("id");
  return hasDate && hasLibelle && hasMontant && !hasCategorie && !hasId;
}

/** Convertit une date JJ/MM/AAAA en AAAA-MM-JJ */
function parseDateFr(dateStr: string): string {
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // Si déjà au format ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
  return today();
}

/** Crée une clé unique pour détecter les doublons (date, libellé, montant) */
function makeDedupKey(entry: { date: string; label: string; amount: number }): string {
  return `${entry.date}|${entry.label.trim().toLowerCase()}|${entry.amount}`;
}

/** Importe un fichier CSV de relevé bancaire. */
export async function importCsv(file: File): Promise<{ imported: number; duplicates: number }> {
  const [head, ...lines] = parse(await file.text());
  const lowerHead = (head || []).map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  
  // Détecte le format banque
  const isBank = isBankFormat(head);
  
  let found: Entry[] = [];
  
  if (isBank) {
    // Format banque : Date;Libellé;Montant
    const dateIdx = lowerHead.indexOf("date");
    const labelIdx = lowerHead.indexOf("libelle");
    const amountIdx = lowerHead.indexOf("montant");
    
    found = lines
      .map((cells) => ({
        date: cells[dateIdx]?.trim() || "",
        label: cells[labelIdx]?.trim() || "",
        amount: cells[amountIdx]?.trim() || "",
      }))
      .filter((line) => line.label && line.date && Number.isFinite(parseAmount(line.amount)))
      .map((line): Entry => ({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        label: line.label,
        amount: Math.round(parseAmount(line.amount) * 100) / 100,
        category: categorize(line.label),
        date: parseDateFr(line.date),
      }));
  } else {
    // Format générique (export de l'appli)
    const names: Record<string, keyof Entry> = { date: "date", libelle: "label", label: "label", montant: "amount", amount: "amount", categorie: "category", category: "category", id: "id" };
    const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const fields = (head || []).map((title) => names[plain(title)]);
    
    found = lines
      .map((cells) => Object.fromEntries(fields.map((field, index) => [field, (cells[index] || "").trim()])) as Record<string, string>)
      .filter((line) => line.label && Number.isFinite(parseAmount(line.amount)))
      .map((line): Entry => ({
        id: line.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        label: line.label,
        amount: Math.round(parseAmount(line.amount) * 100) / 100,
        category: line.category || categorize(line.label),
        date: /^\d{4}-\d{2}-\d{2}$/.test(line.date || "") ? line.date : today(),
      }));
  }
  
  if (!found.length) {
    toast("Ce fichier ne contient aucune opération lisible.", { tone: "error" });
    return { imported: 0, duplicates: 0 };
  }
  
  const before = useEntries.getState().entries;
  const existingKeys = new Set(before.map(makeDedupKey));
  
  let imported = 0;
  let duplicates = 0;
  const newEntries: Entry[] = [];
  
  for (const entry of found) {
    const key = makeDedupKey(entry);
    if (existingKeys.has(key)) {
      duplicates++;
    } else {
      existingKeys.add(key);
      newEntries.push(entry);
      imported++;
    }
  }
  
  if (imported > 0) {
    useEntries.setState({ entries: [...before, ...newEntries] });
  }
  
  let message = "";
  if (imported > 0) message += `${imported} ${imported > 1 ? "opérations importées" : "opération importée"}`;
  if (duplicates > 0) message += `${imported > 0 ? ", " : ""}${duplicates} ${duplicates > 1 ? "doublons ignorés" : "doublon ignoré"}`;
  
  toast(message || "Aucune nouvelle opération.", {
    action: imported > 0 ? { label: "Annuler", run: () => useEntries.setState({ entries: before }) } : undefined,
  });
  
  return { imported, duplicates };
}

/** Ouvre le choix d'un fichier, puis importe le relevé choisi. */
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