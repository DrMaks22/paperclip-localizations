# Upstream maintenance review — 2026-10-12

## Outcome

**Stable remains current. The beta upgrade to the October 12 master is incomplete and is not supported by the existing patch.** This is a drift and installer-safety review, not a new localization release or completed translation update.

No catalog, runtime, foundation, source lock, manifest, channel index or patch bytes were changed in this maintenance update. No source push to upstream PR #12989, merge, tag, release, dependency change or deployment was performed. All prior verification remains tied to its exact recorded revisions.

## Independently checked channels

| Channel or proposal | Localization version | Exact upstream base | October 12 finding |
| --- | --- | --- | --- |
| Published stable | `v2026.10.7.2` | Official `v2026.1005.0`, `467125fafb47a8520856504fecc48d6e32055db1` | Still the latest official stable; no new stable base to port. |
| Published beta | `v2026.9.13.1-beta.1` | `04e364236bd2f9787e4a5c581751e0b8c6c16383` | An older pinned master snapshot, not the current master. |
| Unpublished [PR #4](https://github.com/DrMaks22/paperclip-localizations/pull/4) candidate | `v2026.10.7.1-beta.1` | `c365a16e346dd7bee27709a3be92b965c3dd054d` | Package reverified only on this base; not rebased in this update. |
| Newly inspected master | No compatible candidate prepared | `1b4c803816e82b0265c8422e1a804327a7ed8c54` | 183 commits after the candidate base; migration required. |

The [official stable release](https://github.com/paperclipai/paperclip/releases/tag/v2026.1005.0) is neither a prerelease nor a draft; its tag resolves exactly to the stable pin above. The [published stable localization](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.10.7.2) remains separate and unchanged. The beta entry in this PR's `channels.json` is still a proposal, not a published download.

The existing monitor was dispatched on `main`, completed successfully, and refreshed [tracking issue #1](https://github.com/DrMaks22/paperclip-localizations/issues/1): stable review required is false, beta review required is true. [Monitor run](https://github.com/DrMaks22/paperclip-localizations/actions/runs/38217396859). No duplicate issue or pull request was created.

## Exact drift and merge analysis

Reviewed localization source: `cfe87f3cff71aaf1543c0781eab81721c22c70ea`. Its merge base with the newly inspected master is `c365a16e346dd7bee27709a3be92b965c3dd054d`. All counts below come from the complete local Git objects, not the GitHub compare API's truncated 300-file list.

| Changed paths between the two upstream bases | Added | Modified | Deleted | Total |
| --- | ---: | ---: | ---: | ---: |
| `ui/src/` non-test files | 55 | 162 | 2 | 219 |
| `ui/src/` tests | 31 | 76 | 0 | 107 |
| `ui/storybook/` | 56 | 20 | 3 | 79 |
| `ui/public/` | 18 | 1 | 0 | 19 |
| All `ui/` | 160 | 259 | 5 | 424 |

Non-test files include API clients, hooks, helpers and CSS; this is not a count of visible screens or untranslated strings. There are 163 upstream-changed `ui/src/` paths overlapping the localization changes from the common base.

A merge analysis without changing the working tree (`git merge-tree --write-tree LOCALIZATION_SHA MASTER_SHA`) returned exit code 1 with **87 distinct conflicting paths: 86 content conflicts and one modify/delete conflict**. These comprise 80 non-test files and seven tests. The deleted file is `ui/src/pages/Costs.production.tsx`; restoring it blindly would retain a removed implementation. The command writes analysis objects only into the isolated clone's object store. The temporary source checkout remained clean: no working-tree merge or conflict resolution was attempted in this review.

Upstream has not adopted the full localization in this interval. The diff of `ui/src/i18n` and `ui/package.json` is empty. Both upstream snapshots retain only three English and three Russian seed message leaves; translation calls outside `ui/src/i18n/` are still confined to `App.tsx`. This is distinct from the 19,258 English and 19,634 Russian leaves in the reviewed localization source. Locale-specific plural forms account for different catalog totals; raw totals alone are not a parity check. An unchanged upstream catalog does not imply that new UI text is already translated.

## Required integration work

The following findings were independently inspected by an agent using the immutable source objects. This is an agent audit, not human language review or exhaustive coverage certification.

1. **Costs and subscriptions.** Carry applicable translations from removed `Costs.production.tsx` into the retained `Costs.tsx` and new cost/data-quality components. Preserve estimates versus reported charges, unknown price versus zero, subscription coverage, and the distinction between retrying cost recording and rerunning an agent. Integrate the new currency argument and high-precision `formatDetailedCents` with locale-aware formatting, without losing precision or retaining hard-coded `en-US` output.
2. **Private tasks and project access.** Review `IssuePrivacyActions`, `IssueShareSheet`, `ProjectAccessMembers` and `LockedIssueChip`. Here, public access means company-wide access, not publication on the internet. Preserve explanations of inheritance, remaining grants/roles, private descendants and information already seen by a shared agent. Translate display text, not grant codes or user/agent/project names.
3. **MCP/Dot consent.** Review the expanded pairing and write-access description in `McpConnect.tsx`. The component displays `pairingPreview.permissions` and `accessDuration` directly from the server; a JSX-only scan misses them. The built-in descriptions in `server/src/services/public-mcp/oauth.ts` include sending assigned attachment contents to OpenAI, separate attachment/workspace settings, no board/other-company access, and ongoing access until revocation. A controlled display mapping or separately reviewed locale-aware contract is needed; do not reuse the older, narrower consent text or translate arbitrary server/user text. Scope, IDs and URLs must remain unchanged.
4. **Credential identity.** `credential-access-notice.ts` and `TaskChatMarker.tsx` use the English sentinel `you` and grammatical fragments. Preserve error matching and distinguish current-user identity explicitly when localizing complete messages. Cover current user, named other user, unknown user, missing credential name and live language switching.
5. **Slack and GitHub setup.** Preserve upstream's new automatic/manual Slack setup branches instead of resurrecting the removed `SlackAvatarStep` flow. Audit popup titles/body text, persisted error messages and built-in `slackRegistrationErrorMessage` output, including unknown provider errors. Preserve commands, credentials, retries and permission distinctions in `GitHubAgentTrustWarning`.
6. **Settings, histories and recovery.** Audit new company connections, decision-model/fast-response histories, module-level dictionaries, enum labels, table headers, raw publication/error codes, lifecycle phases and workspace base-ref recovery details. Known statuses need translated display mappings; unknown values, model/branch IDs and user content stay intact. Open surfaces must retranslate without resetting drafts or triggering extra requests.
7. **Artifact previews and accessibility.** Cover new CSV/HTML preview modes and interpolated accessible names, including iframe titles. Preserve file content, the iframe sandbox/CSP, provider permissions, URLs, downloads, keyboard focus and DOM identity. Do not weaken security or restore a redundant accessible-name override to satisfy a translation assertion.

After resolving the source integration against the new behavior, inventory added, removed and changed messages; perform Russian-only editing and independent bilingual review; repeat placeholder, plural, markup and dynamic-label checks; regenerate the foundation and distribution from exact reviewed objects; and run the full applicable runtime/package gates. **These translation and runtime integration steps were not completed in this run.** No new-base string count or completeness claim is made.

## Checks performed on October 12

Tests ran under Node.js 24 against the unchanged candidate payload from package commit `8b6add0383e18d7d652e3ef6ba517d0cb550641c`; this update adds documentation and regenerated documentation checksums only.

- **PASS — catalog validation:** both existing EN/RU catalogs, including structure, CLDR plural forms, placeholders and markup constraints. This checks the old pinned candidate, not new master coverage.
- **PASS — distribution toolkit:** 105 tests, zero failures and zero skips, with `PAPERCLIP_REVIEWED_SOURCE` pointing to the exact clean source `cfe87f3c`. An initial default invocation passed 104 tests and skipped this optional source check; the subsequent full invocation included it successfully.
- **PASS — reproducibility and round trip:** the existing 957-path patch regenerated byte-for-byte on `c365a16`; forward check/apply and reverse check/apply passed, file hashes/modes matched, and Git metadata remained unchanged. Patch SHA-256 remains `62da446743314de5846d708a50d65101972376d8e592382b666781015e580584`.
- **PASS — unsupported-master safety:** in a separate clean checkout at `1b4c8038`, both `--check` and `--apply` refused with exit code 1 and `Unsupported revision. HEAD must be exactly c365a16e346dd7bee27709a3be92b965c3dd054d.` Snapshots of all checkout and `.git` files, modes and symbolic-link targets were identical before and after each refusal; HEAD and clean status were preserved. This expected refusal is not a successful installation or compatibility result.
- **NOT MERGEABLE WITHOUT RESOLUTION — new-base source analysis:** 87 conflicting paths, as above. This describes the application-source migration, not the GitHub mergeability of the distribution's documentation PR.
- **NOT RUN for the new base —** conflict resolution, new-message extraction/translation, Russian-only and bilingual translation reviews, regenerated foundation/patch, application typecheck, production build, UI tests, Storybook and browser/backend/provider scenarios. No integrated new-base candidate exists to test. Earlier October 7 source/runtime results do not carry over to the new master.
- **NOT RERUN — stable application QA:** no stable base or payload changed; its exact previous evidence remains in the [stable verification report](v2026.10.7.2.md). This run checked upstream release/tag identity, not a fresh stable browser deployment.

After this report is committed, the existing PR's exact-head distribution CI must pass before the documentation update is reported as verified. That CI validates the old pinned payload and documentation consistency; it cannot certify an unimplemented master migration.

## Upstream PR status and remaining limitations

[PR #12989](https://github.com/paperclipai/paperclip/pull/12989) is still open and unmerged, with source head `cfe87f3cff71aaf1543c0781eab81721c22c70ea`; the final GitHub check reports `mergeable: false`. The [existing upstream CI run](https://github.com/paperclipai/paperclip/actions/runs/37540365164) still records 45 successful jobs, the failed denied-retry E2E shard and its failed aggregate. No new maintainer response or successful rerun was observed during this review. This scheduled run did not change the upstream source branch or request another privileged rerun.

The candidate's upstream lockfile inconsistency and previous browser/full-monorepo limitations remain as recorded in the [October 7 beta report](v2026.10.7.1-beta.1.md). No dependency changes or test bypasses were made. No new language was certified, and no live instance, database, mail, credentials or production configuration was accessed.

The safe installation choice remains the matching **published stable tag** for Paperclip `v2026.1005.0`. Do not apply the old beta to October 12 master, edit `baseCommit`, force a merge, downgrade a live instance, or treat green package CI as permission to release an unreviewed migration.
