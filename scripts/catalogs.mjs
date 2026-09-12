import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidLocaleMessages } from "../runtime/locale-validation.mjs";

export const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAX_CATALOG_BYTES = 4 * 1024 * 1024;
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/** Reject symlinks in every component, including ancestors of the supplied root. */
export async function assertSafePath(filename, { allowMissing = false, directory = false, writable = false } = {}) {
  if (!path.isAbsolute(filename)) throw new Error(`Path must be absolute: ${filename}`);
  const normalized = path.resolve(filename);
  const base = path.parse(normalized).root;
  const parts = normalized.slice(base.length).split(path.sep).filter(Boolean);
  let current = base;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = await lstat(current); }
    catch (error) { if (error.code === "ENOENT" && allowMissing) return; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`Symlink path is not allowed: ${current}`);
    if (index < parts.length - 1 || directory) {
      if (!stat.isDirectory()) throw new Error(`Expected directory: ${current}`);
    } else {
      if (!stat.isFile()) throw new Error(`Expected regular file: ${current}`);
      if (writable && stat.nlink !== 1) throw new Error(`Hard-linked write target is not allowed: ${current}`);
    }
  }
}

/** Strict, small JSON parser: messages may contain only nonempty objects/strings.
 * JSON.parse alone silently accepts duplicate object keys and prototype payloads.
 */
export function parseCatalogJson(text, label = "catalog") {
  let index = 0;
  function fail(message) { throw new Error(`${label}: ${message} at offset ${index}`); }
  function whitespace() { while (/[\t\n\r ]/.test(text[index] ?? "\0")) index++; }
  function string() {
    const start = index++;
    while (index < text.length) {
      const char = text[index++];
      if (char === "\\") { index++; continue; }
      if (char === '"') {
        try { return JSON.parse(text.slice(start, index)); }
        catch { fail("invalid JSON string"); }
      }
    }
    fail("unterminated JSON string");
  }
  function value(depth) {
    if (depth > 32) fail("catalog exceeds nesting limit");
    whitespace();
    if (text[index] === '"') {
      const result = string();
      if (!result.trim()) fail("empty translation string");
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result)) fail("control character in translation");
      if (/\p{Surrogate}/u.test(result)) fail("unpaired Unicode surrogate");
      return result;
    }
    if (text[index++] !== "{") fail("messages must be nested objects with string leaves");
    const result = Object.create(null);
    whitespace();
    if (text[index] === "}") fail("empty message object");
    while (index < text.length) {
      whitespace();
      if (text[index] !== '"') fail("expected JSON object key");
      const key = string();
      if (!key || /[\u0000-\u001F\u007F]/.test(key) || /\p{Surrogate}/u.test(key) || UNSAFE_KEYS.has(key)) fail("unsafe message key");
      if (Object.hasOwn(result, key)) fail(`duplicate message key ${JSON.stringify(key)}`);
      whitespace();
      if (text[index++] !== ":") fail("expected colon");
      result[key] = value(depth + 1);
      whitespace();
      if (text[index] === "}") { index++; return result; }
      if (text[index++] !== ",") fail("expected comma or closing brace");
    }
    fail("unterminated JSON object");
  }
  const messages = value(0);
  whitespace();
  if (index !== text.length) fail("unexpected trailing JSON content");
  if (typeof messages === "string") fail("catalog root must be an object");
  return messages;
}

export function canonicalLocale(filename) {
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*\.json$/.test(filename)) {
    throw new Error(`Catalog filename must be a canonical BCP 47 locale followed by .json: ${filename}`);
  }
  const locale = filename.slice(0, -5);
  let canonical;
  try { [canonical] = Intl.getCanonicalLocales(locale); }
  catch { throw new Error(`Invalid BCP 47 locale filename: ${filename}`); }
  if (locale !== canonical) throw new Error(`Noncanonical locale filename ${filename}; use ${canonical}.json`);
  if (new Intl.Locale(locale).baseName !== locale) throw new Error(`Locale extensions are not catalog languages: ${filename}`);
  if (!Intl.PluralRules.supportedLocalesOf([locale]).length || !Intl.DisplayNames.supportedLocalesOf([locale]).length) {
    throw new Error(`Locale is not supported by this Node/ICU runtime: ${filename}`);
  }
  return locale;
}

/** Technical validation does not certify linguistic completeness or review. */
export async function loadCatalogs(root = REPOSITORY_ROOT) {
  if (!path.isAbsolute(root)) throw new Error("Catalog repository root must be absolute");
  const directory = path.join(root, "locales");
  await assertSafePath(directory, { directory: true });
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1);
  const catalogs = [];
  const seen = new Set();
  for (const entry of entries) {
    const locale = canonicalLocale(entry.name);
    if (seen.has(locale.toLowerCase())) throw new Error(`Duplicate locale: ${locale}`);
    seen.add(locale.toLowerCase());
    const filename = path.join(directory, entry.name);
    await assertSafePath(filename);
    const stat = await lstat(filename);
    if (stat.size > MAX_CATALOG_BYTES) throw new Error(`${entry.name}: catalog exceeds 4 MiB`);
    const bytes = await readFile(filename);
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    catalogs.push({ locale, messages: parseCatalogJson(source, entry.name) });
  }
  const english = catalogs.find(({ locale }) => locale === "en");
  if (!english) throw new Error("Missing required English source catalog locales/en.json");
  for (const { locale, messages } of catalogs) assertValidLocaleMessages(messages, english.messages, locale);
  // Stable source-first order, independent of filesystem enumeration or host language.
  return [english, ...catalogs.filter(({ locale }) => locale !== "en")];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("Usage: node scripts/catalogs.mjs");
    const catalogs = await loadCatalogs();
    console.log(`Validated ${catalogs.length} catalogs: ${catalogs.map(({ locale }) => locale).join(", ")}. Language review is still required for publication.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
