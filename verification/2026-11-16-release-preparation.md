# Release preparation — November 16, 2026

The owner explicitly authorized merging reviewed PRs #13 and #14 and publishing
these two packages. The installed Paperclip must remain unchanged. This approval
does not cover deployment or later releases.

| Channel | Localization tag | Paperclip base | Runtime |
| --- | --- | --- | --- |
| Stable, Latest, not prerelease | `v2026.11.9.1` | Official `v2026.1106.0`, `d69631b01b9c658f80bf8bed389863dce82643e1` | `pinned-en-ru` |
| Beta, prerelease, never Latest | `v2026.11.16.1-beta.1` | Master snapshot `94cb7ad3596e0a73ee6c2ba3276efb12a7139a72` | `community-json` |

The stable package keeps its candidate tag dated November 9; the publication date
is separate. Beta supports only its reviewed snapshot, not arbitrary later master
commits. Both provide English and Russian UI; additional languages are not
certified.

## Approved sources and preserved payloads

- [PR #14](https://github.com/DrMaks22/paperclip-localizations/pull/14): head
  `c2efdabf33266ef9792b51c679c3f7ae59e8ad33`, merged as
  `34800d7ed6de3d532ea211f6c4edea6e14348830` into the separate stable base.
- [PR #13](https://github.com/DrMaks22/paperclip-localizations/pull/13): head
  `12e00312842557770fe380d42a07c80fb67aea26`, merged as
  `aef7ed6a412fbb0f22b4335357af1fa87b343600` into `main`.

Both merges used exact expected-head checks. The three CI jobs passed on each
approved head: [stable](https://github.com/DrMaks22/paperclip-localizations/actions/runs/42585867677)
and [beta](https://github.com/DrMaks22/paperclip-localizations/actions/runs/43829957785).
Publication preparation updates only current documentation, channel indexes,
verification evidence and their checksums. It preserves the respective patch,
foundation, catalogs, runtime, installer, manifest and source-lock bytes.

- Stable patch SHA-256:
  `dbb5e1ba9312c06cb276e4b19a94760e88aee9dca10516ae33904d9d49e10547`.
- Beta patch SHA-256:
  `5758974be0969534f5a00cd10450d5fb1e192349428e7c7620c26c47b8dd9c72`.

The stable report and its synthetic screenshots are copied unchanged into `main`
so the stable installation links resolve. The stable payload is not merged into
beta. Existing dated candidate reports deliberately retain their prepublication
wording; they describe the earlier review stage. GitHub Releases records actual
publication and supplies the immutable download assets.

## Packaging checks

Both packages are revalidated using Node.js 24. Catalog validation, exact
reproduction, forward/reverse installation and Git-metadata preservation pass.
The read-only preparation gate verifies the official stable tag and beta's
ancestry, as well as channel/manifest/source-lock agreement.

The package toolkit rerun passes **118 tests with one optional source fixture
skipped for stable** and **148/148 for beta with the reviewed source fixture**.
The stable runtime is not replaced with the community runtime just to enable that
optional test. The stable exporter is unchanged and is not used in publication;
the previously documented exporter limitation does not alter its reviewed
offline end-user installer.

ZIP archives are built from exact clean Git commits, reproduced byte-for-byte,
and checked file-by-file against Git blobs and executable modes. Extraction
rejects traversal, duplicate entries and unsupported types. Internal checksums
and extracted-package reproduction/rollback are checked again. Archive hashes,
final-head CI and publication metadata are recorded in each GitHub release after
those checks; they are not implied merely by this preparation document.

## Existing application evidence and limits

The application payloads are unchanged, so their reviewed UI evidence remains
applicable; the full application suites are not rerun for documentation edits.

- [Stable review](v2026.11.9.1.md): 11,241 UI tests, 103 final regressions, UI
  typecheck/build, and 40 isolated browser checks. Generic RU lint returned 1
  with 675 heuristic findings; changed-entry findings were reviewed, not
  represented as a passing linter.
- [Beta review](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.11.16.1-beta.1/verification/v2026.11.16.1-beta.1.md):
  15,318 UI tests passed, one existing upstream test skipped; installed runtime
  and synthetic third-locale checks, UI typecheck/build and 34 browser checks.
  Generic RU lint and the machine-specific privacy checker returned nonzero;
  their heuristic/baseline findings are disclosed in that report.
- CI package jobs omit the optional local-source fixture: stable has 118 passes
  and one skip, beta 147 passes and one skip. Beta's omitted fixture passed
  locally. A green CI job is not a claim that every optional test ran.

No full backend, live-provider, whole-app, screen-reader or production test is
claimed. Existing build warnings remain. Agent reviews are not human sign-off.
No server, database, dependency, deployment or upstream PR #12989 branch changes
are part of this publication. Existing released tags and assets stay immutable.

## По-русски

Публикация разрешена владельцем 16 ноября: stable для официального Paperclip
v2026.1106.0 получает метку Latest; отдельный снимок master выпускается как beta.
Проверенные патчи и словари не изменены. Обновлены ссылки установки и сведения
о каналах; исторические отчёты сохраняют описание этапа, на котором были написаны.

Проверки упаковки подтверждают воспроизводимость и возможность снять патч.
Они не гарантируют перевод любого динамического экрана. Пропущенные проверки,
ненулевые результаты линтеров и границы языковой проверки приведены в отчётах
каналов. Установленный Paperclip не обновляется в рамках этой публикации.
