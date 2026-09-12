# Stable и beta / Stable and beta

[Русская главная](../README.md) · [English overview](../README.en.md)

## Русский

У локализации два независимых канала. Номер нашего релиза обозначает выпуск пакета перевода, а не версию самого Paperclip.

| | Stable | Beta |
| --- | --- | --- |
| Релиз локализации | [v2026.9.13.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1) | [v2026.9.13.1-beta.1](https://github.com/DrMaks22/paperclip-localizations/releases/tag/v2026.9.13.1-beta.1) |
| Основа Paperclip | [Официальный стабильный v2026.831.1](https://github.com/paperclipai/paperclip/releases/tag/v2026.831.1) | Снимок master, проверенный 12 сентября 2026 года |
| Точный коммит Paperclip | `65ec059bde30d98c92165b24a30a540800dd1f6f` | `04e364236bd2f9787e4a5c581751e0b8c6c16383` |
| Метка GitHub | `Latest`, не предварительный выпуск | `Pre-release`, не `Latest` |
| Языки | Английский и русский | Английский и русский; подключение новых проверенных JSON-каталогов |
| Проверки | [Отчёт stable](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1/verification/v2026.9.13.1.md) | [Отчёт beta](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1-beta.1/verification/v2026.9.13.1-beta.1.md) |

Для Paperclip `v2026.831.1` выбирайте stable. Для отдельной тестовой сборки на указанном в таблице коммите master — beta. Перед развёртыванием проверьте выбранный канал в своей среде: ошибки возможны в обоих. Обозначение beta связано с предварительной версией Paperclip и не означает, что русский перевод выполнен хуже.

Новый коммит master не становится поддерживаемым только потому, что появился на GitHub. Установщик принимает только исходники на коммите `baseCommit`, указанном в `manifest.json` выбранного релиза. Если текущий экземпляр новее или отличается от этой базы, не понижайте его версию ради локализации. Подготовьте совместимый выпуск или дождитесь его. Переход между каналами — отдельное обновление приложения с учётом базы данных, а не обычное переключение языка.

В каждом архиве находятся собственные manifest, патч, установщик, каталоги и контрольные суммы. Не смешивайте файлы stable и beta. `channels.json` помогает выбрать релиз, но совместимость проверяется по manifest именно скачанного релиза. `main` — ветка разработки beta, `release/stable-2026.831.1` — ветка сопровождения стабильной версии. Ветки меняются со временем; для установки используйте закреплённый тег.

### Установка beta с агентом

Для stable используйте задание из [README](../README.md#установить-с-помощью-агента). Для beta:

```text
Подготовь отдельную тестовую сборку Paperclip с локализацией beta
из DrMaks22/paperclip-localizations, релиз v2026.9.13.1-beta.1.
Я выбираю предварительный канал на снимке master 04e364236bd2f9787e4a5c581751e0b8c6c16383.
Мой исходный Git-репозиторий: /absolute/path/to/paperclip.
Прочитай инструкции закреплённого релиза:
https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1-beta.1/docs/AGENT-INSTALL.md
Проверь контрольные суммы, канал и точный baseCommit. Создай отдельный worktree,
проверь и примени патч, выполни проверки сборки и интерфейса EN/RU.
Не меняй действующий экземпляр, базу данных или выбранный канал.
Сообщи результаты и ограничения. Развёртывание требует отдельного указания.
```

### Что изменилось в названиях

Первый публичный `v2026.9.12.1` был выпущен без указания beta, хотя его основой был master. Его карточка исправлена на **предварительный выпуск**, а тег и скачиваемые файлы сохранены неизменными. Это исторический выпуск, заменённый явно обозначенным `v2026.9.13.1-beta.1`; он никогда не был патчем для `v2026.831.1`.

Новый stable сохраняет перевод и поведение интерфейса из проверенной сборки `stable ru4` от 8 сентября. Изменены упаковка, документация и установщик. Проверки интерфейса в его отчёте имеют исходную дату; новые проверки упаковки описаны отдельно. В beta сохранён проверенный патч master из предыдущего публичного выпуска, добавлены явные сведения о канале и обновлённое оформление.

### Как выходят обновления

Stable обновляется для официальных стабильных выпусков Paperclip и исправлений перевода на соответствующей базе. Beta обновляется для выбранных и проверенных снимков master. В обоих случаях нужны отдельные проверки, неизменяемый тег и разрешение сопровождающего на публикацию. Расписание проверок не означает автоматического выпуска или установки.

Новые языки сначала добавляются в `main` через JSON-каталоги и проходят языковую и интерфейсную проверку. Текущий stable использует профиль `pinned-en-ru`: добавление JSON-каталога само по себе не подключает новый язык к интерфейсу этой версии. Для переноса в stable нужен отдельный проверенный выпуск. В beta профиль `community-json` автоматически регистрирует языки на основе проверенных каталогов.

## English

The two channels target different Paperclip source revisions. Our release number identifies the localization package, not the Paperclip version.

- **Stable `v2026.9.13.1`:** official Paperclip `v2026.831.1`, exact commit `65ec059bde30d98c92165b24a30a540800dd1f6f`. GitHub `Latest`, not a prerelease. English/Russian UI. [Stable verification](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1/verification/v2026.9.13.1.md).
- **Beta `v2026.9.13.1-beta.1`:** master snapshot `04e364236bd2f9787e4a5c581751e0b8c6c16383`, reviewed on 2026-09-12. GitHub `Pre-release`, never `Latest`. English/Russian UI and registration of additional reviewed JSON catalogs. [Beta verification](https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1-beta.1/verification/v2026.9.13.1-beta.1.md).

Choose stable for the matching official stable release. Choose beta only for a separate test build of the pinned master snapshot. Both require validation in your deployment environment. Beta identifies the development channel, not automatically inferior translation quality. Neither channel guarantees defect-free operation or compatibility with a newer commit.

The installer accepts only its own `manifest.baseCommit`. Never downgrade a running instance to fit a patch. Switching channels is an application upgrade decision, including database compatibility; it is not merely changing the UI language. Each archive contains its own manifest, patch, installer, catalogs and checksums. Do not mix channel files. `channels.json` is a release-selection index, not an override of the downloaded manifest.

`main` tracks beta development; `release/stable-2026.831.1` maintains the stable base. Install immutable release tags, not either moving branch.

### Install beta with an agent

Use the [README task](../README.en.md#install-with-an-agent) for stable. For beta:

```text
Prepare a separate Paperclip test build with beta localization
from DrMaks22/paperclip-localizations, release v2026.9.13.1-beta.1.
I choose the prerelease channel at master snapshot 04e364236bd2f9787e4a5c581751e0b8c6c16383.
My original Git repository is at /absolute/path/to/paperclip.
Read the pinned release instructions:
https://github.com/DrMaks22/paperclip-localizations/blob/v2026.9.13.1-beta.1/docs/AGENT-INSTALL.md
Verify checksums, the channel and exact baseCommit. Create a separate worktree,
check and apply the patch, then run build and EN/RU interface checks.
Do not change the running instance, database or selected channel.
Report results and limitations. Deployment requires a separate instruction.
```

### Historical release and future updates

The first public release `v2026.9.12.1` omitted a beta designation despite targeting master. Its GitHub metadata is corrected to prerelease; its tag and download bytes remain unchanged. It is superseded by the explicitly named beta release, not a stable-version patch.

The new stable package preserves the stable ru4 interface and catalog bytes reviewed on 2026-09-08. Packaging, documentation and the installer are updated; historical application evidence and fresh packaging checks are distinguished in its report. Beta retains the previously verified master patch while adding explicit channel metadata and the updated cover.

Stable follows official stable Paperclip releases; beta follows selected reviewed master snapshots. Both require independent release gates and maintainer approval. A weekly review does not authorize publication or deployment. New languages enter `main` through reviewed JSON catalogs. Stable's historical `pinned-en-ru` runtime does not enable another language merely from a new JSON file; a separately verified backport is needed. Beta's `community-json` profile generates registration from reviewed catalogs.

See [MAINTENANCE.md](MAINTENANCE.md) for release naming, publishing and maintenance rules.
