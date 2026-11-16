# Stable и beta / Stable and beta

[Русская главная](../README.md) · [English overview](../README.en.md)

> **Кандидат stable / Stable candidate:** [v2026.11.9.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.9.1), Paperclip v2026.1106.0, ещё не опубликован / unpublished. **Beta:** [v2026.11.3.1-beta.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.3.1-beta.1), проверенный снимок master / reviewed master snapshot, Pre-release.

> Кандидат stable / Stable candidate: `v2026.11.9.1` для / for Paperclip `v2026.1106.0`. [Проверки и ограничения / Checks and limitations](../verification/v2026.11.9.1.md). Ссылки будущего релиза заработают после публикации. Future release links become available after publication.

Опубликованные теги и файлы, включая [v2026.9.17.1 для Paperclip v2026.916.0](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.17.1), сохраняются неизменными. Published tags and assets, including that previous stable, remain immutable. Рабочая ветка не заменяет релиз; её можно удалить только после разрешённой публикации и [проверки сохранности результата](MAINTENANCE.md#after-publication-close-completed-branches). A working branch is not a release; remove it only after an approved publication and those preservation checks.

**Compare & pull request** — уведомление GitHub о недавних изменениях в ветке, не ошибка. Не объединяйте stable с `main` ради этой плашки. This GitHub banner indicates a recent branch push, not an error; never merge stable into `main` merely to remove it.

Опубликованный stable [v2026.11.3.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.3.1) предназначен для Paperclip `v2026.1023.0`, а [v2026.10.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.10.13.1) — для `v2026.1012.0`; их теги и файлы неизменны. These published stable releases remain tied to their respective official versions; their tags and assets are unchanged.

## Русский

Кандидат `v2026.11.9.1` переносит локализацию на официальный Paperclip `v2026.1106.0`, включая новые строки интерфейса и динамические подписи. Сохранены профиль `pinned-en-ru`, вертикальный переключатель языков и поведение официальной версии. Кандидат ещё не опубликован; предыдущие релизы и их файлы сохранены. Патчи не накладываются друг на друга.

У локализации два независимых канала. Номер нашего релиза обозначает выпуск пакета перевода, а не версию самого Paperclip. Кандидат stable `v2026.11.9.1` предназначен для официального выпуска Paperclip `v2026.1106.0`. Beta `v2026.11.3.1-beta.1` сохранена для проверенного снимка master от 2 ноября 2026 года.

| | Stable | Beta |
| --- | --- | --- |
| Релиз локализации | Кандидат [v2026.11.9.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.9.1) | [v2026.11.3.1-beta.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.3.1-beta.1) |
| Основа Paperclip | [Официальный стабильный v2026.1106.0](https://github.com/paperclipai/paperclip/releases/tag/v2026.1106.0) | Снимок master, проверенный 2 ноября 2026 года |
| Точный коммит Paperclip | `d69631b01b9c658f80bf8bed389863dce82643e1` | `8ea240218dc1d3a94afea1294b377021045dd9c9` |
| Метка GitHub | Не опубликован; после одобрения — stable | `Pre-release`, не `Latest` |
| Языки | Английский и русский, профиль `pinned-en-ru` | Английский и русский; подключение новых проверенных JSON-каталогов |
| Проверки | [Отчёт кандидата stable: результаты и ограничения](../verification/v2026.11.9.1.md) | [Отчёт beta](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.11.3.1-beta.1/verification/v2026.11.3.1-beta.1.md) |

Для Paperclip `v2026.1106.0` готовится stable `v2026.11.9.1`; до его публикации команды установки кандидата не выполняйте. Для `v2026.1023.0` остаётся доступен stable `v2026.11.3.1`, для `v2026.1005.0` — неизменяемый [stable v2026.10.7.2](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.10.7.2), а для `v2026.831.1` — [stable v2026.9.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1). Для отдельной тестовой сборки на указанном в таблице коммите master выбирайте beta. Перед развёртыванием проверьте выбранный канал в своей среде: ошибки возможны в обоих. Обозначение beta связано с предварительной версией Paperclip и не означает, что русский перевод выполнен хуже.

У этой официальной базы проверена установка с неизменённым lockfile и отключёнными lifecycle-скриптами. [Отчёт](../verification/v2026.11.9.1.md) отдельно описывает результаты и ограничения локализации.

Новый коммит master не становится поддерживаемым только потому, что появился на GitHub. Установщик принимает только исходники на коммите `baseCommit`, указанном в `manifest.json` выбранного релиза. Если текущий экземпляр новее или отличается от этой базы, не понижайте его версию ради локализации. Подготовьте совместимый выпуск или дождитесь его. Переход между каналами — отдельное обновление приложения с учётом базы данных, а не обычное переключение языка.

В каждом архиве находятся собственные manifest, патч, установщик, каталоги и контрольные суммы. Не смешивайте файлы stable и beta. `channels.json` помогает выбрать релиз, но совместимость проверяется по manifest именно скачанного релиза. `main` — ветка разработки beta. Ветка проверки stable сохраняет историческое имя `release/stable-2026.916.1`; оно не обозначает совместимость текущего пакета. Для установки используйте закреплённый тег и его manifest, а не изменяемую ветку.

Перевод относится к строкам интерфейса, включённым в патч. Полный перевод каждого динамического экрана не гарантируется. Пользовательский контент, ответы агентов, журналы и исходные диагностические сообщения провайдеров сохраняются на языке источника.

### Установка beta с агентом

Для stable используйте задание из [README](../README.md#установить-с-помощью-агента). Для beta:

```text
Подготовь отдельную тестовую сборку Paperclip с локализацией beta
из DrMaks22/paperclip-localizations, релиз v2026.11.3.1-beta.1.
Я выбираю предварительный канал на снимке master 8ea240218dc1d3a94afea1294b377021045dd9c9.
Мой исходный Git-репозиторий: /absolute/path/to/paperclip.
Прочитай инструкции закреплённого релиза:
https://github.com/DrMaks22/paperclip-localizations/blob/v2026.11.3.1-beta.1/docs/AGENT-INSTALL.md
Проверь контрольные суммы, канал и точный baseCommit. Создай отдельный worktree,
проверь и примени патч, выполни проверки сборки и интерфейса EN/RU.
Не меняй действующий экземпляр, базу данных или выбранный канал.
Сообщи результаты и ограничения. Развёртывание требует отдельного указания.
```

### Что изменилось в названиях

Первый публичный `v2026.9.12.1` был выпущен без указания beta, хотя его основой был master. Его карточка исправлена на **предварительный выпуск**, а тег и скачиваемые файлы сохранены неизменными. Это исторический выпуск, заменённый явно обозначенным `v2026.9.13.1-beta.1`; он никогда не был патчем для `v2026.831.1`.

Исторический [stable v2026.9.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1) для Paperclip `v2026.831.1`, коммит `65ec059bde30d98c92165b24a30a540800dd1f6f`, сохраняет перевод и поведение интерфейса из проверенной сборки `stable ru4` от 8 сентября. В нём изменены упаковка, документация и установщик. Его [отчёт](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1/verification/v2026.9.13.1.md) разделяет исходные проверки интерфейса и проверки упаковки. Тег и файлы этого выпуска остаются неизменными.

Исторический stable `v2026.10.7.2` предназначен для официальной базы `v2026.1005.0` на коммите `467125fafb47a8520856504fecc48d6e32055db1` и использует профиль `pinned-en-ru`. В нём исправлено доступное имя ссылки «Скачать файл»; адрес, имя и содержимое скачиваемого файла не менялись. Его [отчёт](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.10.7.2/verification/v2026.10.7.2.md), тег и файлы сохранены без изменений. В beta `v2026.9.13.1-beta.1` сохранён прежний проверенный патч master и его метаданные.

### Как выходят обновления

Stable обновляется для официальных стабильных выпусков Paperclip и исправлений перевода на соответствующей базе. Beta обновляется для выбранных и проверенных снимков master. В обоих случаях нужны отдельные проверки, неизменяемый тег и разрешение сопровождающего на публикацию. Расписание проверок не означает автоматического выпуска или установки.

Новые языки сначала добавляются в `main` через JSON-каталоги и проходят языковую и интерфейсную проверку. Текущий stable использует профиль `pinned-en-ru`: добавление JSON-каталога само по себе не подключает новый язык к интерфейсу этой версии. Для переноса в stable нужен отдельный проверенный выпуск. В beta профиль `community-json` автоматически регистрирует языки на основе проверенных каталогов.

## English

Candidate `v2026.11.9.1` updates localization for official Paperclip `v2026.1106.0`, including new interface strings and dynamic labels. It preserves the `pinned-en-ru` profile, vertical language selector and official-version behavior. The candidate is unpublished; previous tags and assets remain immutable. Do not stack patches.

The two channels target different Paperclip source revisions. Our release number identifies the localization package, not the Paperclip version. Stable candidate `v2026.11.9.1` targets the official Paperclip `v2026.1106.0` release. Beta `v2026.11.3.1-beta.1` remains pinned to the master snapshot reviewed on November 2, 2026.

- **[Stable candidate `v2026.11.9.1`](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.11.9.1):** official Paperclip [`v2026.1106.0`](https://github.com/paperclipai/paperclip/releases/tag/v2026.1106.0), exact commit `d69631b01b9c658f80bf8bed389863dce82643e1`. Unpublished; planned as stable after approval. English/Russian UI with the `pinned-en-ru` profile. [Candidate verification results and limitations](../verification/v2026.11.9.1.md).
- **Beta `v2026.11.3.1-beta.1`:** master snapshot `8ea240218dc1d3a94afea1294b377021045dd9c9`, reviewed on 2026-11-02. GitHub `Pre-release`, never `Latest`. English/Russian UI and registration of additional reviewed JSON catalogs. [Beta verification](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.11.3.1-beta.1/verification/v2026.11.3.1-beta.1.md).

Stable `v2026.11.9.1` is being prepared for Paperclip `v2026.1106.0`; do not run its installation commands until publication. Published stable `v2026.11.3.1` remains available for `v2026.1023.0`, immutable [stable v2026.10.7.2](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.10.7.2) for `v2026.1005.0`, and [stable v2026.9.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1) for `v2026.831.1`. Choose beta only for a separate test build of the pinned master snapshot. Both require validation in your deployment environment. Beta identifies the development channel, not automatically inferior translation quality. Neither channel guarantees defect-free operation or compatibility with a newer commit.

The official base passed frozen-lockfile installation with lifecycle scripts disabled. The [report](../verification/v2026.11.9.1.md) records localization verification and its limits separately.

The installer accepts only its own `manifest.baseCommit`. Never downgrade a running instance to fit a patch. Switching channels is an application upgrade decision, including database compatibility; it is not merely changing the UI language. Each archive contains its own manifest, patch, installer, catalogs and checksums. Do not mix channel files. `channels.json` is a release-selection index, not an override of the downloaded manifest.

`main` tracks beta development. The stable review branch retains the historical name `release/stable-2026.916.1`; its name does not define the current package's compatibility. Install immutable release tags and check their manifests, not moving branches.

Translation covers the interface strings included in the patch; it does not guarantee complete translation of every dynamic screen. User content, agent responses, logs, and raw provider diagnostics remain in their source language.

### Install beta with an agent

Use the [README task](../README.en.md#install-with-an-agent) for stable. For beta:

```text
Prepare a separate Paperclip test build with beta localization
from DrMaks22/paperclip-localizations, release v2026.11.3.1-beta.1.
I choose the prerelease channel at master snapshot 8ea240218dc1d3a94afea1294b377021045dd9c9.
My original Git repository is at /absolute/path/to/paperclip.
Read the pinned release instructions:
https://github.com/DrMaks22/paperclip-localizations/blob/v2026.11.3.1-beta.1/docs/AGENT-INSTALL.md
Verify checksums, the channel and exact baseCommit. Create a separate worktree,
check and apply the patch, then run build and EN/RU interface checks.
Do not change the running instance, database or selected channel.
Report results and limitations. Deployment requires a separate instruction.
```

### Historical release and future updates

The first public release `v2026.9.12.1` omitted a beta designation despite targeting master. Its GitHub metadata is corrected to prerelease; its tag and download bytes remain unchanged. It is superseded by the explicitly named beta release, not a stable-version patch.

The historical [stable v2026.9.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1) targets Paperclip `v2026.831.1` at `65ec059bde30d98c92165b24a30a540800dd1f6f`. It preserves the stable ru4 interface and catalog bytes reviewed on 2026-09-08. Packaging, documentation and the installer were updated; historical application evidence and packaging checks are distinguished in [its report](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1/verification/v2026.9.13.1.md). Its tag and download bytes remain unchanged.

Historical stable `v2026.10.7.2` targets the official `v2026.1005.0` base at `467125fafb47a8520856504fecc48d6e32055db1` with `pinned-en-ru`. It corrected the “Download file” link's accessible name without changing download URLs, filenames or contents. Its [report](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.10.7.2/verification/v2026.10.7.2.md), tag and assets remain unchanged. Beta `v2026.9.13.1-beta.1` retains its previously verified master patch and metadata.

Stable follows official stable Paperclip releases; beta follows selected reviewed master snapshots. Both require independent release gates and maintainer approval. A weekly review does not authorize publication or deployment. New languages enter `main` through reviewed JSON catalogs. Stable's historical `pinned-en-ru` runtime does not enable another language merely from a new JSON file; a separately verified backport is needed. Beta's `community-json` profile generates registration from reviewed catalogs.

See [MAINTENANCE.md](MAINTENANCE.md) for release naming, publishing and maintenance rules.
