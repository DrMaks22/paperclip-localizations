# Installation

[Overview](../README.en.md) · [Русский](INSTALL.ru.md) · [Install with an agent](AGENT-INSTALL.md)

The patch applies to the source of one specific Paperclip revision. The selected release's `manifest.json` identifies the supported commit. The installer requires Node.js 24 and Git; use that Paperclip revision's documentation for build requirements.

## Obtain and review the release

Clone the localization repository **outside** the original Paperclip repository. This example pins release `v2026.9.12.1`:

```bash
git clone --branch v2026.9.12.1 --depth 1 https://github.com/DrMaks22/paperclip-localizations.git
cd paperclip-localizations
node --version
shasum -a 256 -c SHA256SUMS
```

On Linux, you can use `sha256sum` instead of `shasum -a 256`. Check the release's provenance and read `manifest.json`, `apply.mjs`, and `paperclip-localizations.patch` before running the installer. Checksums help detect damaged files; they do not independently establish trust in the publisher.

## Prepare a separate worktree

Replace the absolute paths below with your own. The new `paperclip-localized` directory must not already exist. The original repository must contain the `baseCommit` object; if Git cannot find it, obtain that revision from the trusted upstream and retry.

```bash
paperclip_base=$(node -p 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8")).baseCommit')
git -C /absolute/path/to/paperclip worktree add --detach /absolute/path/to/paperclip-localized "$paperclip_base"
node apply.mjs --repo /absolute/path/to/paperclip-localized --check
node apply.mjs --repo /absolute/path/to/paperclip-localized --apply
```

The installer requires an exact commit match and a clean working tree. Unsupported revisions, local edits, or a partially applied patch cause it to refuse. Do not bypass that refusal with a forced patch, fuzzy matching, discarded changes, or a downgrade of a running instance.

The installer works offline and does not install dependencies, access the database, or deploy anything. After applying the patch, install dependencies and run tests, type checking, and a production build according to the **pinned Paperclip revision's** instructions. These separate steps may require network access. Review the main screens in the selected language using test data. Deploy the verified build through your existing procedure.

## Select Russian

In the built app, open the profile menu at the bottom of the sidebar. Under **Language / Язык**, choose **Russian / Русский**. Your choice is saved in this browser; no server restart is needed. On first visit, the first supported language in the browser's preferences is selected, with English as the fallback when none match. Verify that switching back to English works and that the selection survives a page reload.

## An existing Paperclip instance

For an existing instance, first back up the database and configuration using your established procedure and prepare a separate build. Keep backups and secrets outside this localization repository. Account for database schema compatibility: a patch for an older commit is not a reason to run old application code against a newer database.

| Installation | How to use the localization |
| --- | --- |
| Git repository | Create a separate worktree at the supported commit, then build and verify. |
| Global npm package | Prepare a build from compatible source; the patch does not install over the global package. |
| Prebuilt Docker image | Build a separate image from compatible source through your usual procedure; the patch does not alter a prebuilt image. |

If the supported revision is unsuitable for your instance, wait for a compatible localization release or prepare a reviewed patch update. Do not edit `baseCommit` to bypass compatibility checks.

## Updating and removing the patch

Do not apply the patch twice. Forward `--check` tests whether **clean source** is ready for installation and refuses after application. Use the installer from the **same release** to verify the exact installed state and then remove its patch:

```bash
node apply.mjs --repo /absolute/path/to/paperclip-localized --reverse --check
node apply.mjs --repo /absolute/path/to/paperclip-localized --reverse --apply
```

Additional edits or a partial patch block removal. Preserve your work separately and inspect the differences; forced application is not supported. Removal changes source files but does not roll back an already deployed build or database.

For a new localization release, prefer a **fresh worktree** at its `manifest.baseCommit`. Review the new release and repeat installation and build checks. Alternatively, first remove the old patch with its old installer in the exact old checkout, then move to the supported commit through your normal Git workflow. Do not layer a new patch over an old one.

## If a check fails

Compare `git rev-parse HEAD` with `manifest.baseCommit`, inspect `git status --short` in the target worktree, and recheck the release checksums. Confirm that you selected the correct check direction. A useful report includes the Node.js version, localization release, Paperclip commit, command, and a redacted error message: [report an installation problem](https://github.com/DrMaks22/paperclip-localizations/issues/new?template=installation.yml).
