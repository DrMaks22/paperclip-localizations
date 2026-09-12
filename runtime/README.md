# Community runtime integration

Contributors add complete, reviewed `locales/<canonical-BCP47>.json` files. The
builder generates explicit imports for those files. It does not discover or
enable Paperclip's preexisting scaffold catalogs. Language names use
`Intl.DisplayNames` in each language; the English and Russian selector labels
retain their existing translated labels. i18next supplies direction and the
existing provider manages persistence, browser matching, document language and
English fallback. Switching languages never replaces or keys the app tree.

`locale-validation.mjs` adapts the MIT-licensed validator and CLDR helpers from
Paperclip source `9cf846bbf6f174d0d394c4faf08c18d77f54bd38`. The loader adds strict
UTF-8/JSON parsing, duplicate and prototype-key rejection, canonical filenames,
supported ICU locales, nesting/size limits, and symlink rejection. Validation
checks full structural coverage, CLDR forms, interpolation multiplicity, rich
text structure, URLs, and length. Passing these checks cannot prove translation
quality or distinguish a full English copy from a reviewed translation. Review
and publication remain the maintainer's responsibility.

## Exports and builder contract

- `scripts/catalogs.mjs`: `loadCatalogs(root)` returns `{ locale, messages }[]`,
  with English first and the remaining locales in stable filename order.
- `scripts/prepare-locales.mjs`: `prepareLocales({ target, root? })` returns
  `{ locales, paths }`; `renderLocaleRegistry(template, catalogs)` generates the
  registry; `RUNTIME_OVERLAY_PATHS` lists the fixed runtime/test targets.
- `runtime/overlays.mjs` is the exact list of source hashes and counted edits.

Run `node scripts/prepare-locales.mjs --target ABSOLUTE_DISPOSABLE_CHECKOUT`
only after applying the base localization patch. Resolve symlinked temporary
roots first (on macOS, use `/private/var`, not its `/var` alias). All paths and
source hashes are preflighted before writing. Runtime source drift, symlinks,
hard-linked write targets, and a preexisting generated test are rejected.
The command writes only the reported paths; it does not remove scaffold files.
Use a fresh disposable checkout for another run. This is a build helper, not
the end-user installer and not a transactional writer for a running instance.

| Overlay | Purpose |
| --- | --- |
| `ui/src/i18n/locales.ts` | Explicit registration, autonyms, invariant plural expansion |
| `ui/src/components/LocaleSwitcher.tsx` | JSON-driven selector, per-language direction, wrapping layout |
| `ui/src/components/task-chat/task-chat-display.ts` | Selected-language timestamps, tokens and durations |
| `ui/src/components/task-chat/task-chat-phase-summary-display.ts` | Translate the existing finite generated summary grammar |
| `ui/src/components/CodexSubscriptionPanel.tsx` | Selected-language quota numbers |
| `ui/src/components/ClaudeSubscriptionPanel.tsx` | Selected-language quota numbers |
| `ui/src/lib/attention.ts` | Selected-language budget numbers |
| `ui/src/lib/pipeline-breakdown.ts` | English plural suffix only for English user nouns |
| `ui/src/pages/apps/connection-owner.tsx` | English possessive punctuation only for English |
| `ui/src/i18n/locale-sync.test.ts` | Adapt fixed EN/RU and unsupported-language assumptions while retaining semantic/plural checks |
| `ui/src/i18n/community-locales.test.tsx` | Native integration tests for every enabled language |

Registered catalogs are copied to `ui/src/i18n/locales/<locale>.json` in addition
to the fixed paths above. Russian quotation marks and Russian phrase casing
remain specific to Russian. Other languages may need further typography/layout
work during their native and visual reviews. The generalized display helpers
retain opaque/provider/user strings and only handle the existing generated
grammar; they do not translate canonical model fields.

## Focused verification

```bash
node --test tests/catalogs.test.mjs
PAPERCLIP_REVIEWED_SOURCE=/absolute/path/to/reviewed/source node --test tests/catalogs.test.mjs
node runtime/verify-three-locales.mjs --source /absolute/path/to/reviewed/source
```

The second command also checks preparation against copies of the audited source
files; without the environment variable that one source integration test is
explicitly skipped. The third command requires already-installed Paperclip test
dependencies. It builds a temporary three-language fixture using English,
Russian and a deliberately synthetic Arabic catalog, then runs real React and
i18next tests for selection, fallback, RTL direction, stable unsent drafts and
generated chat formatting. The fixture is removed afterward and never enters
the distributed catalog directory. It is a functional test, not an Arabic
translation or an RTL visual certification.

The smoke check also runs the original synchronization suite with its reviewed
test adaptation. The generated community suite embeds the exact validated
catalog list independently of the runtime registry, so accidentally enabling
upstream scaffolds still fails. An incomplete French scaffold is also retained
in the temporary target to exercise that exclusion. Existing English/Russian semantic and plural
assertions remain intact; reserved `zz-ZZ` replaces the assumption that Arabic
and French must always be unsupported.

These focused tests supplement the complete patched application's targeted
tests, typecheck, production build, token gates and browser review.
