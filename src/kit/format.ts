// Montants et dates de l'appli, dans la langue de la page (fr) et en euros.

const lang = document.documentElement.lang || "fr";
const currency = document.documentElement.dataset.currency || "EUR";
const moneyFormat = new Intl.NumberFormat(lang, { style: "currency", currency });
const signedFormat = new Intl.NumberFormat(lang, { style: "currency", currency, signDisplay: "exceptZero" });
const dayFormat = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" });
const shortMonthFormat = new Intl.DateTimeFormat(lang, { month: "short" });

const pad = (value: number) => String(value).padStart(2, "0");

/** « 1 235,15 € ». */
export const money = (value: number) => moneyFormat.format(Number.isFinite(value) ? value : 0);

/** « +100,00 € », « −8,00 € ». */
export const signed = (value: number) => signedFormat.format(Number.isFinite(value) ? value : 0);

/** « 1 235,15 € », « 1235.15 », « -8 », « 12,5 » : un nombre, ou NaN. Le dernier séparateur
 * suivi d'un ou deux chiffres est celui des décimales, les autres sont des milliers. */
export function parseAmount(input: string | number): number {
  if (typeof input === "number") return input;
  const text = String(input ?? "").replace(/€|\beur(os?)?\b/gi, "");
  if (/\p{L}/u.test(text)) return NaN;
  const digits = text.replace(/[^\d,.+-]/g, "");
  const last = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
  const decimals = last >= 0 && /^\d{1,2}$/.test(digits.slice(last + 1));
  const whole = (decimals ? digits.slice(0, last) : digits).replace(/[,.]/g, "");
  const value = Number(decimals ? `${whole}.${digits.slice(last + 1)}` : whole);
  return digits && Number.isFinite(value) ? value : NaN;
}

/** Parse un montant au format bancaire français : "1 250,00" ou "1\u00a0250,00" ou "1\u202f250,00"
 *  Retire les espaces (normaux et insécables) avant de parser. */
export function parseBankAmount(input: string | number): number {
  if (typeof input === "number") return input;
  const text = String(input ?? "").replace(/€|\beur(os?)?\b/gi, "");
  if (/\p{L}/u.test(text)) return NaN;
  // Remplace tous les espaces (normaux, insécables U+00A0, U+202F) par rien
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return NaN;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

/** Parse une date au format français JJ/MM/AAAA et retourne YYYY-MM-DD.
 *  Retourne NaN si la date est invalide. */
export function parseBankDate(input: string): string | null {
  const text = String(input ?? "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  // Vérification de la validité de la date
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Aujourd'hui, « 2026-10-28 ». */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Le mois d'une date, « 2026-10 ». */
export const monthOf = (date: string) => date.slice(0, 7);

/** Le mois `step` mois plus tard (ou plus tôt). */
export function shiftMonth(month: string, step: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + step, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** « Octobre 2026 ». */
export function monthName(month: string): string {
  const [year, number] = month.split("-").map(Number);
  const text = monthFormat.format(new Date(year, number - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « oct. ». */
export function shortMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return shortMonthFormat.format(new Date(year, number - 1, 1));
}

/** « 28 oct. ». */
export function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return dayFormat.format(new Date(year, month - 1, day));
}

/** Jours qui restent dans le mois, aujourd'hui compris. */
export function daysLeft(month = monthOf(today())): number {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(year, number, 0).getDate();
  const now = new Date();
  const current = now.getFullYear() === year && now.getMonth() + 1 === number;
  return current ? last - now.getDate() + 1 : last;
}

/** Retourne le texte pour les jours restants (singulier pour 0 et 1). */
export function daysLeftLabel(count: number): string {
  return `${count} jour${count > 1 ? "s" : ""} restant${count > 1 ? "s" : ""}`;
}
