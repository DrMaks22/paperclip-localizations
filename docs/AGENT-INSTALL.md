# Install with Codex, Claude Code, or OpenCode

[Русская главная страница](../README.md) · [English overview](../README.en.md)

This document is a portable task specification for a coding agent with local Git and shell access. Use the copy from the selected release tag, not an unpinned branch. The task text in either README works in Codex, Claude Code, and OpenCode without a product specific slash command.

По-русски: передайте агенту задание из [README.md](../README.md#установить-с-помощью-агента), указав путь к исходникам Paperclip. Агент должен использовать инструкцию закреплённого релиза, подготовить отдельную сборку и сообщить результаты проверок. Установка патча сама по себе не развёртывает эту сборку.

## Agent procedure

1. Read the user's request, applicable repository instructions, and this release's [installation guide](INSTALL.en.md). Resolve the actual source repository and installation type. If only a global npm package or prebuilt container is available, explain that a compatible source build is needed; do not patch package-manager files or a running container.
2. Obtain the user's selected release of `DrMaks22/paperclip-localizations` outside Paperclip. Review `manifest.json`, `apply.mjs`, `paperclip-localizations.patch`, and `SHA256SUMS`. Check the checksums and Node.js 24. Do not execute a remote download piped into a shell.
3. Treat `manifest.baseCommit` as the compatibility boundary. Create a fresh disposable Git worktree at that exact commit. Preserve the original checkout and local changes. Never reset, downgrade, or rewrite a production checkout to meet the manifest.
4. Run `node apply.mjs --repo /absolute/path/to/worktree --check`, then the same command with `--apply`. The installer performs offline source changes only. A compatibility or integrity refusal is a reason to inspect the mismatch; do not force, fuzz, or partially apply the patch.
5. Follow the pinned upstream documentation for dependency installation and verification. Complete relevant tests, type checking, and a production build, and inspect the main screens with synthetic data. These steps are separate from the offline installer. State exactly which checks passed and which remain incomplete.
6. For an existing deployment, account for a backup and a separate build before any deployment work. Use the user's existing deployment procedure only when deployment is within the user's authorization. Do not infer permission to change a database, restart a service, or update a running instance from permission to prepare a localized source build.
7. Report the localization tag, actual Paperclip commit, worktree path, patch result, build and interface checks, and the next deployment step. Explain any unresolved incompatibility plainly. Do not report installation success if patching or required verification failed.

## Repeated runs and updates

Forward checks and application intentionally refuse an already patched tree. To inspect the exact installed state, use the same release's installer with `--reverse --check`. Use `--reverse --apply` only when removing that patch is part of the task. Further local changes may prevent removal; preserve and inspect them.

For updates, prefer a fresh worktree at the new release's base commit. If reusing an old checkout, remove its old patch using the old release before moving to the new supported revision. Do not stack releases, silently widen compatibility, or apply an old release to an arbitrary current checkout.
