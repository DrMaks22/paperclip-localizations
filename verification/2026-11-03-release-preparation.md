# Release preparation — November 3, 2026

The maintainer explicitly approved merging [PR #4](https://github.com/DrMaks22/paperclip-localizations/pull/4) and publishing `v2026.11.2.1-beta.1`. This approval excludes the installed Paperclip instance. The November 2 verification reports preserve their dated prepublication status; this record documents the later release preparation.

- Channel: `beta`; runtime profile: `community-json`.
- Paperclip base: `master snapshot reviewed on November 2`, exact commit `8ea240218dc1d3a94afea1294b377021045dd9c9`.
- Reviewed PR head: `f5441c7402d5d06c439d96f5e96506f6a9bd18ca`; all three PR CI jobs passed.
- Merge commit: `69486897d2433311749cf3b9d0cd8fa2f0f267a2`.
- Complete patch SHA-256: `d47a283b328f2d977d6d54b360a4606f0004b5f3ec5d8d38f9fc9d5932bc71c2`.
- Finalization changes only documentation, the channel index, verification evidence and package checksums. Patch, foundation, catalogs, runtime, manifest, source-lock, installer and build/test code are unchanged from the reviewed PR head.
- Publication flags: `prerelease=true`, `Latest=false`. Previously published tags and download bytes remain immutable.

## Verification and limits

The November 3 artifact check passed byte-for-byte reproducibility, forward check/application, verification of every result hash and mode, reverse check/application and restoration of the clean base. Git metadata remained unchanged. The read-only prepublication gate also passed the exact upstream ref and channel checks.

Both English and Russian catalogs pass structural validation. The November 3 toolkit rerun passed all 119 tests, with zero skipped, with zero failures. The optional community-runtime fixture used the exact reviewed source integration.

UI and browser evidence applies to the unchanged reviewed payload in [the version report](v2026.11.2.1-beta.1.md). Those application checks are not claimed as new November 3 runs. Full backend/monorepo suites, live provider authorization, real production data and the installed Nano PC are outside this release validation. Prior Russian lint heuristic warnings remain explicitly triaged in the version report; a raw nonzero lint exit is not counted as a pass. No additional language is certified.

The remaining publication gates are exact-tree ZIP validation, fresh extracted-package reproduction and forward/reverse installation, successful CI on the final packaging commit, then uploaded/downloaded byte comparison and the read-only published-release gate. Release notes record completion of those gates; this preparation record does not itself assert that publication has occurred.
