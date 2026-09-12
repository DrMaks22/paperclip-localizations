# Contributing

[Русская главная страница](README.md#добавить-язык-или-исправить-перевод) · [English overview](README.en.md#add-a-language-or-fix-a-translation)

По-русски: исправляйте строки в `locales/ru.json`. Для нового языка добавьте вложенный JSON-каталог `locales/<BCP47>.json` по структуре `locales/en.json`. Запустите `npm test` и `npm run validate`, приложите результаты проверки перевода и основных экранов. Можно писать задачи и пул-реквесты по-русски.

## Before changing a catalog

Read [AGENTS.md](AGENTS.md) and the relevant release's `manifest.json`. English is the source catalog. Localize visible interface text while preserving the meaning, severity, and ownership of each action. Keep product names, identifiers, paths, URLs, protocol values, and user or agent content intact.

New languages target `main` (beta development). The current stable channel preserves a separately reviewed EN/RU runtime and needs an explicit backport to enable additional languages. State the channel and supported upstream revision in compatibility fixes; do not mix stable and master integrations. See [release channels](docs/RELEASES.md).

Keep pull requests focused: a translation correction, a new language, or a compatibility update should be understandable on its own. Report existing unrelated problems separately.

## Correct an existing translation

Edit the relevant string in `locales/<BCP47>.json`. Include its key, the English source, what was wrong, and the replacement's intended meaning. For a short or ambiguous label, include the screen and the surrounding action. Screenshots should contain only synthetic or redacted data.

Translate as a native technical writer. Preserve negation, limits such as “only” and “all,” failure and deletion warnings, and recovery instructions. For Russian, use neutral language, sentence case, natural verb aspect, and concise infinitives on action buttons. Avoid literal English word order and bureaucratic phrases.

## Add a language

1. Create **only the raw nested catalog** at `locales/<BCP47>.json`, using `locales/en.json` as the reference. Use a well-formed BCP 47 tag with the necessary language, script, and region, such as `de`, `pt-BR`, or `zh-Hant`.
2. Translate the complete catalog. Do not submit an English scaffold as a completed translation. Brand names and intentional source-language terms may remain unchanged, but explain ambiguous cases in the pull request.
3. Preserve the nested structure and interpolation variables. Plural families must satisfy the target language's CLDR rules; the English number of forms is not a template for every language. Keep count variables attached to the correct grammatical form.
4. Preserve structural markup, rich-text tags, link destinations, code, and any control syntax. Translate visible labels around these structures. Report a source ambiguity before guessing at behavior.
5. Run the checks below and complete the review steps. Project tooling derives the native display name and generates the runtime integration. Do not hand-edit the language switcher or generated release patch in a catalog pull request.

If automatic language naming or a validator cannot handle a valid locale, open an issue with the tag and the failing output. Adding an exception needs a reviewed tooling change; bypassing validation is not a localization fix.

README translations are welcome too: add `README.<BCP47>.md` and link it from the language navigation in each existing README. Keep Russian as the default `README.md` and English at `README.en.md`. Translating documentation is optional and does not replace translating the interface catalog.

## Validate and review

Run from the localization repository with Node.js 24:

```bash
npm test
npm run validate
```

Include the command results and identify any checks you could not run. Automated checks cover structure and translation invariants; passing them does not prove the text reads naturally or fits the interface.

Every changed language needs these distinct reviews before merging:

- **Native fluency:** read the target text independently, including short labels, errors, empty states, and plural forms. Record who or what performed the review.
- **Bilingual accuracy:** compare with English for missing constraints, changed warnings, negation, placeholders, and the scope of actions. Keep this separate from the fluency pass.
- **Main screens:** inspect the isolated Paperclip build on the supported revision. Cover navigation, onboarding, settings, task and agent views, forms, dialogs, errors, and narrow layouts. Check clipping, wrapping, fallback text, and dynamic catalogs touched by the change.
- **Right-to-left layout, when applicable:** audit direction, alignment, mixed Latin text, icons, navigation, inputs, and narrow layouts. Correct strings alone do not establish RTL support.

Reviewers may use agents. Identify agent-assisted checks honestly and distinguish them from a native speaker's review. Do not describe any review as human unless a person actually performed it.

## Generated artifacts and runtime changes

Maintainers regenerate release artifacts from the approved catalogs, audited runtime overlay, and explicit upstream object IDs using the repository's release builder. Generated output must be reproducible; do not repair the patch by hand or use fuzzy application.

Runtime changes also require targeted application tests, type checking, a production build, and browser checks in an isolated checkout. A catalog-only contribution still needs its interface review before inclusion in a release. See [MAINTENANCE.md](docs/MAINTENANCE.md) for the complete release gate.

## Credit and licensing

Contributions are distributed under this repository's [MIT license](LICENSE). Preserve existing copyright and attribution notices. Keep the original localization authors' credit and any valid `Co-authored-by` trailers when carrying work forward. Describe your own changes and review accurately.

Never include credentials, account data, private logs, deployment configuration, or real user content in an issue, fixture, screenshot, or pull request.
