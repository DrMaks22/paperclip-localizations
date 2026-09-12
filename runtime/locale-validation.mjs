/**
 * Dependency-free adaptation of Paperclip locale-structure.ts and
 * locale-validation.ts at 9cf846bbf6f174d0d394c4faf08c18d77f54bd38 (MIT).
 * Preserves CLDR, interpolation, rich-text, URL, and length contracts.
 * JSON structure/duplicate-key safety is checked separately by the loader.
 */
const MAX_STRING_LENGTH = 2_000;

export function pluralBase(key, reference) {
  const match = /^(.*)_(zero|one|two|few|many|other)$/.exec(key);
  return match && Object.hasOwn(reference, `${match[1]}_other`)
    && typeof reference[`${match[1]}_other`] === "string" ? match[1] : null;
}

export function localeKeyReferences(reference, locale) {
  const expected = new Map();
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  const groups = new Set();
  for (const key of Object.keys(reference)) {
    const base = pluralBase(key, reference);
    if (base === null) expected.set(key, key);
    else groups.add(base);
  }
  for (const base of groups) {
    const inflected = Object.keys(reference).some((key) =>
      key !== `${base}_other` && pluralBase(key, reference) === base);
    for (const category of inflected ? categories : ["other"]) {
      const key = `${base}_${category}`;
      expected.set(key, typeof reference[key] === "string" ? key : `${base}_other`);
    }
    if (typeof reference[`${base}_zero`] === "string") expected.set(`${base}_zero`, `${base}_zero`);
  }
  return expected;
}

export function localeReferenceKey(key, reference) {
  if (Object.hasOwn(reference, key)) return key;
  const base = pluralBase(key, reference);
  return base === null ? null : `${base}_other`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function formatPath(path) { return path.length ? path.join(".") : "<root>"; }
function placeholders(value) {
  return Array.from(value.matchAll(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g), (match) => match[1]).sort();
}
function malformedInterpolation(value) {
  return /{{|}}/.test(value.replace(/{{\s*[A-Za-z0-9_.-]+\s*}}/g, ""));
}
function hasRawHtml(value) { return /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^>]*)?>/.test(value); }
function hasEventHandlerAttribute(value) { return /\son[A-Za-z]+\s*=/i.test(value); }
function markupStructure(value) {
  const tokens = [];
  const stack = [];
  let balanced = true;
  for (const match of value.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9:.-]*|\d+)(\s[^<>]*?)?\s*(\/?)>/g)) {
    const [, closing, name, attributes = "", explicitSelfClosing] = match;
    const selfClosing = Boolean(explicitSelfClosing) || /^(br|hr|img|input|wbr)$/i.test(name);
    tokens.push(`${closing ? "/" : ""}${name}${attributes.trim() ? ` ${attributes.trim()}` : ""}${selfClosing ? "/" : ""}`);
    if (closing) { if (stack.pop() !== name) balanced = false; }
    else if (!selfClosing) stack.push(name);
  }
  return { tokens: tokens.sort(), balanced: balanced && stack.length === 0 };
}
function urlsIn(value) {
  return Array.from(value.matchAll(/\bhttps?:\/\/[^\s<>"'»”‘’）)]+/gi), (match) => match[0].replace(/[.,;:!?]+$/, ""))
    .filter((url) => !/^https?:\/\/$/i.test(url)).sort();
}
function blockedData(value, english) {
  const checks = [
    [/<script\b/i.test(value), /<script\b/i.test(english), "<script"],
    [hasEventHandlerAttribute(value), hasEventHandlerAttribute(english), "event-handler attribute"],
    [/\bjavascript\s*:/i.test(value), /\bjavascript\s*:/i.test(english), "javascript:"],
    [/\bdata\s*:/i.test(value), /\bdata\s*:/i.test(english), "data:"],
    [hasRawHtml(value), hasRawHtml(english), "raw HTML tag"],
  ];
  const blocked = checks.filter(([candidateHas, englishHas]) => candidateHas && !englishHas).map(([, , label]) => label);
  const englishUrls = new Set(urlsIn(english));
  if (urlsIn(value).some((url) => !englishUrls.has(url))) blocked.push("unexpected URL");
  return blocked;
}
function validateString(path, value, english, errors) {
  const candidatePlaceholders = placeholders(value);
  const englishPlaceholders = placeholders(english);
  if (candidatePlaceholders.join("\u0000") !== englishPlaceholders.join("\u0000")) {
    errors.push(`${formatPath(path)} interpolation placeholders must match English exactly: expected ${JSON.stringify(englishPlaceholders)}, received ${JSON.stringify(candidatePlaceholders)}`);
  }
  if (malformedInterpolation(value) && !malformedInterpolation(english)) {
    errors.push(`${formatPath(path)} contains malformed interpolation`);
  }
  for (const label of blockedData(value, english)) errors.push(`${formatPath(path)} contains disallowed ${label}`);
  const referenceMarkup = markupStructure(english);
  const candidateMarkup = markupStructure(value);
  // Unpaired examples such as <folder name> are plain text in the source.
  if (referenceMarkup.balanced && referenceMarkup.tokens.join("\u0000") !== candidateMarkup.tokens.join("\u0000")) {
    errors.push(`${formatPath(path)} markup tags and attributes must match English exactly`);
  } else if (referenceMarkup.balanced && !candidateMarkup.balanced) {
    errors.push(`${formatPath(path)} markup must remain balanced`);
  }
  const limit = Math.min(MAX_STRING_LENGTH, Math.max(english.length * 4 + 64, english.length + 128));
  if (value.length > limit) errors.push(`${formatPath(path)} is too long: ${value.length} characters exceeds ${limit}`);
}
function validateNode(path, candidate, reference, errors, locale) {
  if (typeof reference === "string") {
    if (typeof candidate !== "string") errors.push(`${formatPath(path)} must be a string`);
    else validateString(path, candidate, reference, errors);
    return;
  }
  if (!isPlainObject(reference)) { errors.push(`${formatPath(path)} has unsupported English reference type`); return; }
  if (!isPlainObject(candidate)) { errors.push(`${formatPath(path)} must be an object`); return; }
  const required = localeKeyReferences(reference, locale);
  for (const key of required.keys()) {
    if (!Object.hasOwn(candidate, key)) errors.push(`${formatPath([...path, key])} is missing`);
  }
  for (const key of Object.keys(candidate).sort()) {
    const referenceKey = localeReferenceKey(key, reference);
    if (referenceKey === null) errors.push(`${formatPath([...path, key])} is not defined in English`);
    else validateNode([...path, key], candidate[key], reference[referenceKey], errors, locale);
  }
}
export function validateLocaleMessages(candidate, englishReference, locale = "en") {
  const errors = [];
  validateNode([], candidate, englishReference, errors, locale);
  return errors;
}
export function assertValidLocaleMessages(candidate, englishReference, locale = "en") {
  const errors = validateLocaleMessages(candidate, englishReference, locale);
  if (errors.length) throw new Error(`Invalid ${locale} locale messages:\n${errors.join("\n")}`);
}
