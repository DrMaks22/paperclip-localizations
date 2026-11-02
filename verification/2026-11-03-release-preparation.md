# Release preparation — November 3, 2026

The maintainer explicitly approved merging [PR #10](https://github.com/DrMaks22/paperclip-localizations/pull/10) and publishing `v2026.10.26.1`. This approval excludes the installed Paperclip instance. The November 2 verification reports preserve their dated prepublication status; this record documents the later release preparation.

- Channel: `stable`; runtime profile: `pinned-en-ru`.
- Paperclip base: `v2026.1023.0`, exact commit `1b4c803816e82b0265c8422e1a804327a7ed8c54`.
- Reviewed PR head: `dfd33cd8143b4327944cb44a72fa93cd3b36aae6`; all three PR CI jobs passed.
- Merge commit: `207678a132c190ddae2c101141803b48768bf0f4`.
- Complete patch SHA-256: `b30ee6fafc49fc2244c089540828e27687ffd5885b4bd95c59883fe850b6652a`.
- Finalization changes only documentation, the channel index, verification evidence and package checksums. Patch, foundation, catalogs, runtime, manifest, source-lock, installer and build/test code are unchanged from the reviewed PR head.
- Publication flags: `prerelease=false`, `Latest=true`. Previously published tags and download bytes remain immutable.

## Verification and limits

The November 3 artifact check passed byte-for-byte reproducibility, forward check/application, verification of every result hash and mode, reverse check/application and restoration of the clean base. Git metadata remained unchanged. The read-only prepublication gate also passed the exact upstream ref and channel checks.

Both English and Russian catalogs pass structural validation. The November 3 toolkit rerun passed 118 tests, with one explicit conditional community-runtime fixture skipped, with zero failures. That fixture exercises community-json and is not applicable to the preserved pinned-en-ru profile; its exploratory refusal is documented in [the tooling report](2026-11-02-stable-tooling.md).

UI and browser evidence applies to the unchanged reviewed payload in [the version report](v2026.10.26.1.md). Those application checks are not claimed as new November 3 runs. Full backend/monorepo suites, live provider authorization, real production data and the installed Nano PC are outside this release validation. Prior Russian lint heuristic warnings were separately triaged during review; a raw nonzero lint exit is not counted as a pass. No additional language is certified.

The remaining publication gates are exact-tree ZIP validation, fresh extracted-package reproduction and forward/reverse installation, successful CI on the final packaging commit, then uploaded/downloaded byte comparison and the read-only published-release gate. Release notes record completion of those gates; this preparation record does not itself assert that publication has occurred.
