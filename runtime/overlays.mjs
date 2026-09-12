/** Audited presentation and test adaptations of source commit 9cf846bbf6f174d0d394c4faf08c18d77f54bd38.
 * Exact source hashes and replacement counts deliberately fail on drift.
 * Canonical data, prompts, user text, routes and the i18n provider are untouched.
 */
import { createHash } from "node:crypto";

export const TEMPLATE_TARGETS = [
  { template: "locales.ts.template", path: "ui/src/i18n/locales.ts", sha256: "a20d86d14a6b584e0415631a9cde23e4a5df881a1525c8082dd58ce66c4b5400" },
  { template: "LocaleSwitcher.tsx", path: "ui/src/components/LocaleSwitcher.tsx", sha256: "76be368ee80382776c6ed2b0fc720bf0cfc93ebcc7028465a23ee6086ffb6a57" },
];
const RUSSIAN_GATE = '!i18n.resolvedLanguage?.startsWith("ru")';
const ENGLISH_GATE = '(i18n.resolvedLanguage ?? "en").split("-")[0] === "en"';
const RUSSIAN_CONDITION = 'i18n.resolvedLanguage?.startsWith("ru")';
const NON_ENGLISH_CONDITION = '(i18n.resolvedLanguage ?? "en").split("-")[0] !== "en"';

export const EXACT_EDITS = [
  {
    path: "ui/src/components/task-chat/task-chat-display.ts",
    sha256: "896b003e3dfb672edb1bb70332bfe4bc41837f27d7d78637224dd34a7ebd7b75",
    replacements: [{ before: RUSSIAN_GATE, after: ENGLISH_GATE, count: 3 }],
    reason: "Use selected-locale time, token and duration formatting; preserve exact English upstream fallback.",
  },
  {
    path: "ui/src/components/task-chat/task-chat-phase-summary-display.ts",
    sha256: "4202fbf69142d1a3cd6bc3c94b946133ff87a30ed67dcad19544cb99f7f606fe",
    replacements: [
      { before: RUSSIAN_GATE, after: ENGLISH_GATE, count: 1 },
      { before: 'translated.push(index === 0 ? label : label.replace(/^[А-ЯЁ]/, (letter) => letter.toLowerCase()));', after: 'translated.push(index === 0 || !i18n.resolvedLanguage?.startsWith("ru") ? label : label.replace(/^[А-ЯЁ]/, (letter) => letter.toLowerCase()));', count: 1 },
    ],
    reason: "Translate only the existing finite generated grammar in all non-English languages; retain Russian-specific casing only for Russian.",
  },
  ...[
    ["ui/src/components/CodexSubscriptionPanel.tsx", "63d818ebb628ca780778aba9b551a2a01d9971df45265c076c5c374aecb76576"],
    ["ui/src/components/ClaudeSubscriptionPanel.tsx", "876f0a0001cf555a0164a7e66eadd9c517e9674f5afcaa717febac7e95e5f232"],
  ].map(([path, sha256]) => ({
    path, sha256,
    replacements: [{ before: RUSSIAN_CONDITION, after: NON_ENGLISH_CONDITION, count: 1 }],
    reason: "Format quota percentages using the selected language while retaining English numeric display.",
  })),
  {
    path: "ui/src/lib/attention.ts",
    sha256: "32349d8c789cb7c522bc2a5eec23c2791a91fd59c74e9dc7b2306dabb48ad21f",
    replacements: [{ before: `const number = (value: number | string) => ${RUSSIAN_CONDITION}`, after: `const number = (value: number | string) => ${NON_ENGLISH_CONDITION}`, count: 1 }],
    reason: "Use selected-locale budget numbers; Russian quotation conventions remain Russian-specific.",
  },
  {
    path: "ui/src/lib/pipeline-breakdown.ts",
    sha256: "49489f41d6614e1099a1a646d7a8360ee9ab5916c1ec8ed41fe1f0cc9235df71",
    replacements: [{ before: RUSSIAN_CONDITION, after: NON_ENGLISH_CONDITION, count: 1 }],
    reason: "Append English plural s only in English; preserve custom user nouns in other languages.",
  },
  {
    path: "ui/src/pages/apps/connection-owner.tsx",
    sha256: "f165a5afc485aa2913bac5ae442d5d80561cd6f3d236f6f824008fb26bf0ea85",
    replacements: [{ before: 'i18n.resolvedLanguage === "ru"', after: NON_ENGLISH_CONDITION, count: 1 }],
    reason: "Add English possessive punctuation only in English; translators receive the unmodified given name elsewhere.",
  },
  {
    path: "ui/src/i18n/locale-sync.test.ts",
    sha256: "1d1750baae83f333042bec31ac05c500447d1e8b4b5cba0cc7d7be9741807efb",
    replacements: [
      {
        before: '  it("exposes only explicitly supported catalogs, not unfinished seed locales", () => {\n    expect(supportedLocales).toEqual(["en", "ru"]);\n    expect(Object.keys(localeMessages)).toEqual(["en", "ru"]);\n  });',
        after: '  it("matches the explicit community registry and retains English/Russian", () => {\n    // The generated community suite independently checks the exact prepared\n    // catalog list, including that upstream scaffold files stay unregistered.\n    expect(Object.keys(localeMessages)).toEqual([...supportedLocales]);\n    expect(supportedLocales).toEqual(expect.arrayContaining(["en", "ru"]));\n  });',
        count: 1,
      },
      { before: '    setLocale("ar");', after: '    setLocale("zz-ZZ"); // Reserved unsupported probe; Arabic may be a reviewed catalog.', count: 1 },
      {
        before: '    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR"]);',
        after: '    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["zz-ZZ"]);\n    vi.spyOn(window.navigator, "language", "get").mockReturnValue("zz-ZZ");',
        count: 1,
      },
    ],
    reason: "Adapt the fixed two-language test assumptions for JSON-only contributions. Keep semantic/plural assertions intact; the separately generated expected catalog list still rejects scaffold auto-registration.",
  },
];

export const GENERATED_TEST_TARGET = "ui/src/i18n/community-locales.test.tsx";
export const RUNTIME_OVERLAY_PATHS = [
  ...TEMPLATE_TARGETS.map(({ path }) => path),
  ...EXACT_EDITS.map(({ path }) => path),
  GENERATED_TEST_TARGET,
];

export function assertSourceHash(source, overlay) {
  if (createHash("sha256").update(source).digest("hex") !== overlay.sha256) {
    throw new Error(`Audited runtime source differs: ${overlay.path}. Review and update its overlay explicitly.`);
  }
}
export function applyExactOverlay(source, overlay) {
  assertSourceHash(source, overlay);
  for (const { before, after, count } of overlay.replacements) {
    const matches = source.split(before).length - 1;
    if (matches !== count) throw new Error(`Runtime overlay expected ${count} matches in ${overlay.path}; found ${matches}`);
    source = source.split(before).join(after);
  }
  return source;
}
