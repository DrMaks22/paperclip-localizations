/** Audited presentation and test adaptations of the integration recorded in source-lock.json.
 * Exact source hashes and replacement counts deliberately fail on drift.
 * Canonical data, prompts, user text, routes and the i18n provider are untouched.
 */
import { createHash } from "node:crypto";

export const TEMPLATE_TARGETS = [
  { template: "locales.ts.template", path: "ui/src/i18n/locales.ts", sha256: "a20d86d14a6b584e0415631a9cde23e4a5df881a1525c8082dd58ce66c4b5400" },
  { template: "LocaleSwitcher.tsx", path: "ui/src/components/LocaleSwitcher.tsx", sha256: "8398c378dc7265553ab65b8b5b8ef5577310f45ef51dd95a374d2ef7410d858f" },
];
// The reviewed source includes the presentation adaptations below. Keep
// their hashes as preflight guards, with no repeated text transformations.
export const EXACT_EDITS = [
  {
    path: "ui/src/components/task-chat/task-chat-display.ts",
    sha256: "864fe36ff159ce3b4bd8db24ba9f4f334729ed1d2bb54e0c9b3f9041b78a5402",
    replacements: [],
    reason: "Preserve selected-locale formatting, exact English fallback, full-match marker guards and canonical AI-account markers. October 19 adds four finite display labels and two exact generated remedies; provider diagnostics, model values and retry-control markers stay raw.",
  },
  {
    path: "ui/src/components/task-chat/task-chat-phase-summary-display.ts",
    sha256: "0df9efe3fbe4d821423fed3d30dc81171e32da4812491fdf505f51b4e60fe503",
    replacements: [],
    reason: "The source already translates generated grammar in all non-English languages. Its remaining Russian condition protects phrase casing and must not be replaced.",
  },
  ...[
    ["ui/src/components/CodexSubscriptionPanel.tsx", "5076c741299cc5e1751b8c45f6e580f6a504737fd7ebefe124f7b0d42a7f9d36"],
    ["ui/src/components/ClaudeSubscriptionPanel.tsx", "0b176111d8761efe9b207dfbc0e66684ae7687e635ca231d08b291f720838bca"],
  ].map(([path, sha256]) => ({
    path, sha256,
    replacements: [],
    reason: "Preserve selected-language quota formatting and English numeric display. October 19 retains upstream safe unavailable-status messages instead of exposing raw provider errors, and localizes the revised quota descriptions.",
  })),
  {
    path: "ui/src/lib/attention.ts",
    sha256: "779298e7af4e04caea3cc78d5d518c34ebe7abfa859a518186c98f238b6ca872",
    replacements: [],
    reason: "Preserve selected-locale budget numbers and Russian-specific quotation conventions. October 26 adds the exact upstream search/filter implementation; its function body is unchanged from the pinned master and does not alter the existing presentation adaptations.",
  },
  {
    path: "ui/src/pages/apps/connection-owner.tsx",
    sha256: "f7c0fb89a682730279c569d98cea80d0fc5039b8727b0960eafeeb880b9f6a8f",
    replacements: [],
    reason: "Preserve English-only possessive punctuation and unmodified given names in other languages. October 19 applies the same display-only owner naming to assistant connections; OAuth client identity, customized names, provider emails and tenant hostnames remain intact.",
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
