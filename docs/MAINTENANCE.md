# Maintenance and releases

[Русская главная страница](../README.md) · [English overview](../README.en.md) · [Contributing](../CONTRIBUTING.md)

This independent distribution follows Paperclip upstream while keeping compatibility explicit. `manifest.json` is the source of truth for each release; changing it alone cannot make a patch compatible.

## Release channels and naming

- **Stable:** an exact official non-prerelease Paperclip tag. Localization [v2026.9.17.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.17.1) targets `v2026.916.0`, commit `dffc2b3ca1b9e88fa21cb17493083e682dffd1ca`. Localization tags use `vYYYY.M.D.N`. After completing the release gate, publish with `--prerelease=false --latest`. Prepare stable work on a separate `release/stable-<upstream version>` branch; never merge master wholesale into it. The immutable localization tag preserves completed work, so a remote release branch is not required after publication.
- **Beta:** an explicitly reviewed commit from Paperclip master. Localization tags use `vYYYY.M.D.N-beta.N`, for example `v2026.9.13.1-beta.1`. Publish with `--prerelease --latest=false`. `main` is the beta development branch. A green CI run does not turn a master snapshot into a stable Paperclip release.

`source-lock.json` requires `releaseChannel`, `upstreamRef`, and `runtimeProfile`; the builder copies these into `manifest.json` and rejects inconsistent channel/tag/ref metadata. `channels.json` records the selected release in each channel. It is an index, not permission to widen compatibility. The prepublication check resolves the official stable tag to the locked Git commit and refuses upstream prereleases. Tag suffixes, GitHub prerelease flags, titles, README instructions and manifest metadata must agree.

`community-json` applies the audited community runtime integration and supports additional reviewed JSON catalogs. `pinned-en-ru` preserves the historical stable runtime and accepts exactly the English and Russian catalogs. Do not silently attach modern runtime overlays to an older stable patch. Porting new-language registration to stable is separate implementation and verification work.

The immutable [stable `v2026.9.13.1`](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1) remains tied to Paperclip `v2026.831.1` at `65ec059bde30d98c92165b24a30a540800dd1f6f`. The [v2026.9.17.1 report](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.17.1/verification/v2026.9.17.1.md) records results and limitations for the new base separately from historical evidence. Beta remains `v2026.9.13.1-beta.1` on `04e364236bd2f9787e4a5c581751e0b8c6c16383`.

The legacy `v2026.9.12.1` tag was published before channel naming was explicit. Its GitHub release is reclassified as beta, with a prominent correction and successor link. Preserve its tag, assets and checksums. All newly published beta tags must include the beta suffix. Never reuse or move a published tag; fix artifacts in a new release. Editing explanatory release metadata does not authorize replacing download bytes.

## Weekly Codex review

Two complementary schedules are configured for this project:

- **GitHub Actions:** Monday at 06:23 UTC (09:23 Europe/Moscow). The default-branch workflow compares the two channel pins with the latest official stable release and current master separately, and maintains one bot-owned tracking issue. It does not translate, merge, publish, or deploy code.
- **Maintainer's Codex heartbeat:** configured on 2026-09-12 for Monday at 10:00 Europe/Moscow. It examines the drift, prepares necessary updates in an isolated branch, validates them, and creates or updates one maintenance pull request. It remains quiet when there is no actionable change.

The Codex task depends on the maintainer's local Codex environment being available; cloning this repository does not install that task for contributors. GitHub schedules may be delayed, and scheduled workflows in public repositories can be disabled after inactivity. Check the actual Actions history and the maintainer's automation status if a run is missing. These are review schedules, not release or deployment guarantees. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Each run should inspect the latest official stable release and master independently, the status of [PR #12989](https://github.com/paperclipai/paperclip/pull/12989), source catalog changes, and relevant dynamic interface text. Record newly added, removed, and changed keys and any runtime changes affecting localization. Keep stable and beta work in separate branches and, when both need updates, separate pull requests. If there is no actionable change, stay quiet. Notify the maintainer when a reviewed update is ready, verification fails, or a decision is needed.

Prepare changes in an isolated checkout. Select explicit upstream object IDs, reconcile catalogs, and review additions for terminology, natural language, bilingual accuracy, and runtime use. Scheduling does not relax these requirements. Do not publish releases, merge pull requests, or update users' deployments merely because a scheduled run occurred.

## Release gate

1. Lock the upstream base and all source objects used to generate the patch. Review the difference from the previous release, including runtime overlays and dynamic catalogs.
2. Validate every included locale with `npm run validate` and run `npm test`. Complete the independent fluency, bilingual accuracy, and main-screen reviews from [CONTRIBUTING.md](../CONTRIBUTING.md). Identify agent and human reviews accurately; RTL languages need a separate layout audit.
3. Regenerate artifacts with the repository's release builder from the reviewed inputs. Use the builder documented in the current package scripts. Do not hand-edit the generated patch. Regenerate a second time and verify byte-for-byte reproducibility.
4. Verify `manifest.json`, `paperclip-localizations.patch`, and `SHA256SUMS`. Test forward check and apply, verification of the exact patched state with `--reverse --check`, and reverse apply in clean disposable worktrees at the locked base. Confirm that unsupported commits, local edits, partial patches, and repeated forward application refuse.
5. For runtime changes, run targeted upstream tests, type checking, a production build, and browser checks in the isolated patched checkout. A clean patch application alone is not evidence of correct runtime behavior or translation coverage.
6. Review the release documentation, pinned example tag, compatibility statement, provenance, license notices, and contributor credit. Release notes must state the supported base, changes, checks performed, limitations, and upgrade path. Report skipped checks explicitly; do not label an incompletely reviewed language ready.
7. Run `npm run check:release` with network access before publication. This read-only gate checks the channel index, local manifest/lock alignment, upstream release metadata and exact Git ref. Run it again with `-- --published` after publication to verify the GitHub prerelease flag and that beta is not `Latest`. Publish only through the maintainer's authorized release process. Keep the tag, generated artifacts, checksums, and release notes aligned. A release does not automatically deploy to any user's instance.

## After publication: close completed branches

With the maintainer's approval, remove completed remote working branches without changing a published release:

1. Verify the published tag resolves to the exact release branch tip, the release assets and checksums are available, and no open pull request or unpublished work depends on that branch. If the branch contains later commits, preserve and review them instead of deleting it.
2. Confirm that `main` contains the current channel index, installation links and verification report. A stable payload stays on its release tag; do not merge it into beta merely to clear GitHub's **Compare & pull request** suggestion.
3. Remove only the verified remote release branch. A documentation/index branch may also be removed after its pull request is merged and all its commits are reachable from `main`. Use an exact expected-head check when deleting remote refs so a concurrent push cannot be lost. Keep tags, release assets and local worktrees unchanged.
4. Verify the remote refs and release again. The immutable tag preserves the complete source history; a stable maintenance branch can be recreated from it for a later fix, which must pass the release gate and receive a new tag.

This cleanup is part of an explicitly approved release task, not something the weekly read-only checks perform automatically. Release branches are isolated working branches, not missing pull requests into `main`.

## Reproduce a release or rebuild catalog changes

Use Node.js 24 and a local Git clone containing the exact `upstreamCommit` in `source-lock.json`. No private integration commit is needed: the checked-in foundation patch contains the complete reviewed localization integration against that public upstream object.

```bash
npm run validate
npm test
npm run build -- --upstream /absolute/path/to/paperclip
npm run build -- --upstream /absolute/path/to/paperclip --check
npm run verify -- --upstream /absolute/path/to/paperclip
```

The builder uses a disposable clone, applies the source-hashed foundation, integrates canonical catalogs using the selected runtime profile, and generates the patch, manifest and checksums. `community-json` applies its audited runtime overlays; `pinned-en-ru` only copies the two validated catalogs into the preserved integration. `--check` compares generated bytes without overwriting artifacts. Verification independently exercises forward/reverse installation, file hashes, modes, and unchanged Git metadata. It does not install dependencies or test the running application. Local optional community-runtime tests and the three-language fixture are documented in [runtime/README.md](../runtime/README.md); they do not certify the historical stable runtime.

## Update the pinned upstream base

This is integration work, not a change to `manifest.baseCommit`. Start a separate source integration branch from the public `localizationSourceCommit` recorded in `source-lock.json`, then merge the exact chosen upstream commit. Reconcile that branch with the current community catalogs and foundation so community-only fixes are not lost. Resolve conflicts while retaining upstream behavior; inventory new UI strings and canonical dynamic labels, translate and independently review them, then commit the clean integration. Keep the community runtime overlays separate from this foundation.

Export the reviewed integration with explicit full object IDs and the intended new tag:

```bash
node scripts/export-foundation.mjs --source /absolute/path/to/reviewed-integration --base UPSTREAM_SHA --inherited PUBLIC_LOCALIZATION_SHA --tag vYYYY.M.D.N-beta.N --channel beta --upstream-ref master --runtime-profile community-json
```

For stable, select its separately reviewed source, use `--channel stable`, the official version in `--upstream-ref`, a stable localization tag without a beta suffix, and the explicitly reviewed runtime profile. Never just relabel beta. The exporter replaces the English and Russian canonical catalogs from that committed source, writes `patches/foundation.patch` and `source-lock.json`, and rejects changes outside UI localization and the three approved locale tools. Review any runtime overlay source-hash mismatch manually; never update a hash merely to bypass its guard. Run the build and verification commands above, then the complete release gate. Additional language catalogs remain subject to review against the new English source. If there is no suitable public localization ancestor after upstream adoption, revise this export workflow explicitly rather than inventing an object ID.

After documentation or test changes, rebuild checksums and verify again. Keep a released tag immutable; corrected artifacts need a new tag. Do not push the integration branch to the existing upstream localization pull request as a side effect of maintaining this distribution.

## Upstream adoption and contribution history

Track upstream adoption before preparing another overlay. If upstream incorporates the relevant changes, assess which independent artifacts remain necessary and document the resulting migration path. Do not assume acceptance of one pull request covers later Paperclip versions.

Preserve the lineage from [PR #11125](https://github.com/paperclipai/paperclip/pull/11125), including Evyatar Bluzer (@bluzername), original submitter @convergentaru, existing copyright notices, and valid `Co-authored-by` records. Describe subsequent work by @DrMaks22 and other contributors accurately. Neither a generated patch nor agent review transfers original authorship.
