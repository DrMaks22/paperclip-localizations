/** Audited presentation and test adaptations of the integration recorded in source-lock.json.
 * Exact source hashes and replacement counts deliberately fail on drift.
 * Canonical data, prompts, user text, routes and the i18n provider are untouched.
 */
import { createHash } from "node:crypto";

export const TEMPLATE_TARGETS = [
  { template: "locales.ts.template", path: "ui/src/i18n/locales.ts", sha256: "a20d86d14a6b584e0415631a9cde23e4a5df881a1525c8082dd58ce66c4b5400" },
  { template: "LocaleSwitcher.tsx", path: "ui/src/components/LocaleSwitcher.tsx", sha256: "76be368ee80382776c6ed2b0fc720bf0cfc93ebcc7028465a23ee6086ffb6a57" },
];
// The reviewed source now includes the seven presentation adaptations. Keep
// their hashes as preflight guards, with no repeated text transformations.
export const EXACT_EDITS = [
  {
    path: "ui/src/components/task-chat/task-chat-display.ts",
    sha256: "cc6259ab809692f01735820851703f29b49f24068b087b7eed59df96366d9838",
    replacements: [],
    reason: "Preserve selected-locale formatting, exact English fallback and AI-account markers. October 7 adds exact generated model/connection notices, first-party feedback-tool captions gated by canonical operation identity, and full-match marker guards. Provider error prefixes, canonical models and unknown diagnostics remain raw.",
  },
  {
    path: "ui/src/components/task-chat/task-chat-phase-summary-display.ts",
    sha256: "0df9efe3fbe4d821423fed3d30dc81171e32da4812491fdf505f51b4e60fe503",
    replacements: [],
    reason: "The source already translates generated grammar in all non-English languages. Its remaining Russian condition protects phrase casing and must not be replaced.",
  },
  ...[
    ["ui/src/components/CodexSubscriptionPanel.tsx", "46be2e6d474b0e865f6997b735184e40d94e1818c84d6e5262a70257a8ff8727"],
    ["ui/src/components/ClaudeSubscriptionPanel.tsx", "6fe04085c069637d3e682b65e9169cbc66738e70127805380f422b66cb1ca150"],
  ].map(([path, sha256]) => ({
    path, sha256,
    replacements: [],
    reason: "Preserve the source's selected-language quota formatting and English numeric display.",
  })),
  {
    path: "ui/src/lib/attention.ts",
    sha256: "674429ed083dcd66b216c0243939497aab055d1b92f1cff789cc05a83181c225",
    replacements: [],
    reason: "Preserve the source's selected-locale budget numbers and Russian-specific quotation conventions.",
  },
  {
    path: "ui/src/lib/pipeline-breakdown.ts",
    sha256: "8182a892b3edde95d2437ba0ac7dde67167a917488612e5f8c73626e1dadc0a9",
    replacements: [],
    reason: "Preserve the source's English-only plural suffix and unchanged custom nouns in other languages.",
  },
  {
    path: "ui/src/pages/apps/connection-owner.tsx",
    sha256: "64f3bbd9065285770ba79943285a4ecc08ee1c5eed52c73b78b8fe72f20001d8",
    replacements: [],
    reason: "Preserve the source's English-only possessive punctuation and unmodified given names in other languages. October 7 separates canonical application identity from its translated display name; customized names, provider email addresses and tenant hostnames remain intact.",
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
