# Vault Rules — Як додавати документи в Obsidian vault

> [[Home]] | Owner: всі AI агенти | Status: **обов'язкове до виконання**
> Created: 2026-04-15 | Based on: офіційні Obsidian best practices + структура VuriumBook vault

## Призначення

Цей документ — **єдине джерело правди** про те, як команда `Owner + 8 AI` додає, перейменовує, лінкує і структурує файли в `docs/`. Ціль — щоб граф Obsidian залишався читабельним, без сиріт, без broken links, з чіткими hub-кластерами.

**Перед тим як створити будь-який новий файл — прочитай цей документ повністю.**

> Для **типів нотаток, `source_of_truth`, статусів `draft/review/superseded/archived`, knowledge-layer папок `00-System` → `12-Archive`, і правил canonical vs historical** використовуй [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]] як вищий рівень семантики.
> Цей файл відповідає за **практичну механіку vault**: де класти, як називати, як лінкувати, як додавати в [[Home]].

---

## Базова механіка vault

1. **Граф = граф wiki-посилань.** Вузол = .md файл. Лінія = `[[wiki link]]` між файлами. Тому **кожен файл має бути пов'язаний** через `[[Home]]` backlink + згадка в Home.md.
2. **Home.md = центральний хаб (MOC).** Всі основні файли мають бути досяжні з Home в 1–2 кліки.
3. **Категорійні папки = sub-hubs.** `Features/`, `Architecture/`, `Tasks/`, `DevLog/`, `AI-Profiles/`.
4. **Tags ≠ навігація.** Теги — для cross-cutting атрибутів (`status/`, `area/`). Тематика йде через лінки, не через теги.
5. **Ghost links = винятки, не норма.** Лінк на неіснуючий файл дозволено лише як свідомий placeholder майбутнього доку — інакше це orphan-builder.

---

## Правило 1 — Розташування файлу (де класти)

Перед створенням визнач категорію. **Не клади все в root.**

| Тип контенту | Куди | Приклад |
|--------------|------|---------|
| Опис продуктової фічі | `Features/` | `Features/Booking System.md` |
| Технічна архітектура | `Architecture/` | `Architecture/Background Jobs.md` |
| Backend API/collections | `Backend/` | `Backend/API Routes.md` |
| Frontend pages/components | `Frontend/` | `Frontend/Components.md` |
| Активна задача / план / review | `Tasks/` | `Tasks/BE.8-Legacy-SMS-Migration-Plan.md` |
| Денна сесія розробки | `DevLog/` | `DevLog/2026-04-15.md` |
| Профіль AI / owner | `AI-Profiles/` | `AI-Profiles/AI-3-Verdent.md` |
| Юридичні / compliance PDF | `Telnyx/` | (не .md, тільки референс з Home) |
| Високорівнева "карта" / index | root `docs/` | `Home.md`, `ARCHITECTURE.md` |

**Правило**: якщо вагаєшся між двома папками — обирай більш специфічну. Якщо контент стосується кількох категорій — клади в найосновнішу і додай cross-links на інші.

---

## Правило 2 — Назва файлу

1. **Назва файлу = H1 заголовок без `# `**. Якщо файл `Booking System.md`, перший рядок має бути `# Booking System`.
2. **Title Case English** для feature/architecture доків. Винятки: `iOS App.md` (правильна капіталізація бренду).
3. **Kebab-case + версія/дата** для plan/review/log доків:
   - `BE.8-Legacy-SMS-Migration-Plan.md`, `BE.8-Legacy-SMS-Migration-Plan-v2.md`
   - `QA-Scan-2026-04-15.md`, `AI4-Branch-Resolution-2026-04-15.md`
4. **DevLog**: формат `YYYY-MM-DD.md` або `YYYY-MM-DD-topic.md` для sub-сесій.
5. **Без "weird" символів**: жодних `?`, `*`, `:`, `<`, `>`, `|`, `\` у назвах. `&` дозволено (`Calendar & Scheduling.md`).
6. **Без пробілів навколо `&`/`/`** — `Backend/API Routes.md`, не `Backend / API Routes.md`.
7. **Англійська мова в назві файлу**, навіть якщо контент українською (Obsidian wiki links легше працюють з ASCII).

---

## Правило 3 — Frontmatter (YAML properties)

**Мінімальний обов'язковий frontmatter** для всіх нових важливих доків (крім щоденних DevLog файлів):

```yaml
---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
source_of_truth: false
---
```

Додаткові поля (опціонально):
- `owner: AI 1 / AI 2 / AI 3 / AI 4 / AI 5 / AI 6 / AI 7 / AI 8 / Owner` — хто веде доку
- `reviewers: [Owner, AI 3]` — коли для нотатки потрібен формальний review lane
- `tags: [area/sms, status/inbox]` — лише cross-cutting атрибути, не теми
- `aliases: ["Alt Name 1", "10DLC"]` — стабільні синоніми

**Для canonical note types, allowed statuses, і правил коли `source_of_truth: true`, дивись [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]].**

**Заборонено**: deprecated формати `tag:` (single), `alias:` (single), `cssclass:`. Використовуй plural list форму: `tags:`, `aliases:`, `cssclasses:`.

---

## Правило 4 — Перший рядок після H1: breadcrumb

**Обов'язково.** Зразу після `# Title` має бути порожній рядок, потім breadcrumb рядок:

```markdown
# Booking System

> Part of [[Home]] > Features | See also: [[Calendar & Scheduling]], [[Payments]], [[Client Management]]
```

Формат breadcrumb:
```
> Part of [[Home]] > <Section> | See also: [[Related1]], [[Related2]], [[Related3]]
```

Альтернативи:
- `> [[Home]] > Tasks | Related: [[X]], [[Y]]` (для tasks)
- `> [[Home]] > DevLog | Related: [[X]]` (для devlog)
- `> [[Home]] > Features | Status: Live | Plan: Salon+` (з додатковими полями)

**Чому це обов'язково**:
1. Backlink `[[Home]]` робить файл недосяжним для orphan-чеку.
2. `See also` створює мінімум 2–3 horizontal зв'язки → файл не висить як кінцева точка.
3. Audit-скрипт перевіряє наявність `[[Home]]` в кожному файлі.

---

## Правило 5 — Лінкування (як писати wiki links)

### Wiki link форми

| Форма | Коли використовувати |
|-------|---------------------|
| `[[File Name]]` | За замовчуванням, коли назва файлу = бажаний відображуваний текст |
| `[[File Name\|Alias]]` | Коли потрібно показати інший текст (наприклад, скорочення) |
| `[[Path/File Name\|Display]]` | Коли в vault є кілька файлів з однаковою назвою — використовуй повний шлях |
| `[[File#Heading]]` | Коли посилаєшся на конкретний розділ файлу |
| `[[File#^block-id]]` | Коли посилаєшся на конкретний block |

### Заборонено

- ❌ `[[Like This]]` як приклад в тексті (це створить broken link). Якщо треба показати синтаксис у тексті — обгорни в backticks: `` `[[wiki link]]` ``
- ❌ Markdown links (`[text](file.md)`) для внутрішніх переходів — використовуй wiki links.
- ❌ Лінк на файл без перевірки чи він існує (окрім свідомих placeholder ghost links — див. Правило 9).
- ❌ Випадково wikiфікований текст у регулярному пояснені — завжди обгортай прикладні `[[...]]` в backticks.

### Escape для прикладів у тексті

Якщо треба показати wiki link синтаксис у тексті без створення реального лінка, обгорни в `` `...` ``:

```markdown
- Use Obsidian wiki links: `[[Note Name]]` or `[[Note Name|Alias]]`
```

---

## Правило 6 — Кожен файл = мінімум 3 зв'язки

Файл вважається "правильно вшитим" коли:

1. Має `[[Home]]` backlink (через breadcrumb).
2. Має мінімум 2 горизонтальні `[[See also]]` лінки на споріднені файли.
3. Згаданий мінімум в одному іншому файлі (зворотний backlink).
4. Доданий в `Home.md` у відповідну секцію.

**Перевірка перед commit**:
- [ ] Файл має breadcrumb з `[[Home]]`
- [ ] Файл згаданий в Home.md
- [ ] Файл має 2+ See also лінків на існуючі файли
- [ ] Жодного broken link, який не є свідомим placeholder

---

## Правило 7 — Оновлення Home.md (обов'язкова процедура)

**Кожен новий .md файл має бути доданий в Home.md.** Бери секцію за категорією:

| Категорія файлу | Секція в Home.md |
|----------------|------------------|
| `Features/` | `## Features` (таблиця) |
| `Architecture/`, `Backend/`, `Frontend/` | `## Architecture` (список) |
| `Tasks/` плани | `## Tasks & Plans` |
| `Tasks/` reviews/sub-tasks | `### BE.X / FE.X — Sprint Reviews` або відповідний sub-section |
| `DevLog/` | `## Dev Log` (newest first) |
| `AI-Profiles/` | `## AI Profiles` |
| QA scans | `## QA & Quality` |
| Reference / legal | `## Reference` |

**Формат запису в Home.md**:
- Списковий пункт: `- [[File Name]] — коротке пояснення в один рядок (макс 80 символів)`
- Таблиця features: `| Name | Description | [[File Name]] |`

**Якщо нової секції ще немає** — створи її між існуючими в логічному місці.

---

## Правило 8 — Атомарність контенту

1. **Один файл = одна тема.** Якщо доку перевалює за 500 рядків і охоплює кілька тем — розбий на атомарні файли і створи зверху MOC.
2. **Не дублюй контент.** Якщо є існуючий файл по темі — оновлюй його, не створюй новий. Винятки: planning sessions з версіями (`-v2.md`).
3. **Винятки на дублі**: parallel AI plans (`Theme-Light-AI1.md` + `Theme-Light-AI2.md`), reviews (`BE.8-BE.9-AI1-Review.md` + `BE.8-BE.9-AI2-Review.md`) — це навмисна паралельна робота двох AI.

---

## Правило 9 — Ghost links (placeholder лінки)

Obsidian дозволяє лінкувати на ще неіснуючий файл. Це **інструмент**, але з ризиками.

**Дозволено** ставити ghost link якщо:
- Це свідомий план — наприклад, з'являється посилання на `[[Tasks/BE.1-Distributed-Lock]]` бо файл буде створено в наступному кроці.
- Файл буде створено впродовж 1–2 робочих сесій.
- В commit message явно зазначено: `references planned doc Tasks/BE.1-Distributed-Lock (to be created in next session)`.

**Заборонено**:
- Створювати ghost link "на майбутнє" без плану.
- Залишати ghost links у production-доках більше ніж на 2 тижні без створення цільового файлу.
- Мати >5 ghost links у vault одночасно.

**Аудит ghost links** виконується раз на тиждень: всі непідтверджені — або файли створюються, або лінки видаляються.

---

## Правило 10 — Перейменування файлів

1. **Завжди використовуй вбудоване Obsidian переіменування**, а не файлову систему — Obsidian автоматично оновлює всі `[[wiki links]]` що ведуть на цей файл.
2. Якщо перейменування зроблено через CLI/файлову систему — обов'язково запусти `grep -r '\[\[Old Name' .` і виправ всі посилання вручну.
3. Після перейменування **завжди** запусти audit (Правило 13).

---

## Правило 11 — Tags (обмежене використання)

Теги використовуються **лише** для cross-cutting атрибутів, які не описують саму тему.

### Дозволені префікси
- `status/` — `status/inbox`, `status/draft`, `status/active`, `status/done`, `status/archived`
- `area/` — `area/sms`, `area/payments`, `area/auth` (для фільтрації по технічних областях)
- `priority/` — `priority/p0`, `priority/p1`, `priority/p2`
- `review/` — `review/weekly`, `review/launch`

### Заборонено
- ❌ Теги-теми (`#booking`, `#calendar`) — використовуй wiki links на feature файли.
- ❌ Теги без префіксу (`#urgent`, `#important`) — додай префікс або зроби їх properties.
- ❌ Теги в коді/code-блоках (вони не індексуються правильно).

---

## Правило 12 — Aliases (псевдоніми)

Використовуй aliases коли файл має стабільну альтернативну назву:

```yaml
---
aliases:
  - "10DLC"
  - "A2P 10DLC"
  - "10DLC реєстрація"
---
```

Тоді `[[10DLC]]` автоматично резолвиться у файл (з показом alias як видимого тексту).

**Не використовуй aliases для**:
- Граматичних варіацій (single/plural) — пиши явно `[[File|Files]]`.
- Translation — якщо потрібен переклад, створи окремий файл і зв'яжи їх через `See also`.

---

## Правило 13 — Audit перед commit

**Обов'язковий чек-лист перед кожним commit, що додає або змінює .md файли**:

> **ВАЖЛИВО**: audit-скрипт має ігнорувати wiki-link приклади всередині code-блоків (між трьома backticks) та inline code (одинарні backticks), бо Obsidian їх теж не парсить як реальні лінки. Інакше будеш бачити false-positives у документах з прикладами синтаксису.

```bash
# Допоміжна функція: витягти wiki-links з файлу, ігноруючи code blocks і inline code
extract_real_links() {
  awk '
    /^```/ { in_code = !in_code; next }
    !in_code {
      # Видалити inline code (між одинарними backticks)
      gsub(/`[^`]*`/, "")
      # Знайти всі [[...]]
      while (match($0, /\[\[[^]]*\]\]/)) {
        print substr($0, RSTART+2, RLENGTH-4)
        $0 = substr($0, RSTART + RLENGTH)
      }
    }
  ' "$1"
}

# 1. Знайти файли без [[Home]] backlink (поза code blocks)
find docs -name '*.md' ! -name 'Home.md' -print0 | while IFS= read -r -d '' f; do
  extract_real_links "$f" | grep -q '^Home$' || echo "MISSING [[Home]]: $f"
done

# 2. Знайти broken wiki links (поза code blocks)
all=$(find docs -name '*.md' -print0 | while IFS= read -r -d '' f; do basename "$f" .md; done | sort -u)
find docs -name '*.md' -print0 | while IFS= read -r -d '' f; do
  extract_real_links "$f" | sed 's/\\|.*//;s/|.*//' | while IFS= read -r link; do
    bn=$(basename "$link")
    [ -n "$bn" ] && (echo "$all" | grep -qx "$bn" || echo "BROKEN: $f -> [[${link}]]")
  done
done

# 3. Знайти файли, не згадані в Home.md
extract_real_links docs/Home.md | sed 's/\\|.*//;s/|.*//' | xargs -I{} basename {} | sort -u > /tmp/home.txt
find docs -name '*.md' ! -name 'Home.md' -print0 | while IFS= read -r -d '' f; do
  bn=$(basename "$f" .md)
  grep -qi "$bn" /tmp/home.txt || echo "NOT IN HOME: $f"
done
```

**Acceptance criteria**:
- 0 файлів без `[[Home]]` backlink
- 0 broken links (крім свідомих placeholder ghost links)
- 0 файлів, не згаданих в Home.md

---

## Правило 14 — Особливі випадки

### DevLog sub-сесії
Якщо в один день було декілька сесій по різним темам:
- Головний файл: `DevLog/2026-04-15.md`
- Sub-файли: `DevLog/2026-04-15-topic.md` (наприклад `2026-04-15-ios.md`)
- Головний файл лінкує на всі sub-файли через `See also`.
- Home.md показує головний з відступами sub-файлів.

### Parallel AI work (AI 1 vs AI 2 vs AI 3)
Коли два AI пишуть план паралельно:
- Файли мають суфікс: `-AI1.md`, `-AI2.md`, `-AI3.md`
- Кожен лінкує на інший через `See also`
- Окремий wrap-up файл збирає рішення (опціонально)

### Reviews/Audits
Формат: `<Scope>-Review.md` або `<Scope>-AI<N>-Review.md`
Завжди з frontmatter `type: review`, `owner: AI N`, `status: done|active`.

### Versioned plans
Якщо план переглянуто і створено нову версію:
- Старий: `BE.8-Legacy-SMS-Migration-Plan.md` → frontmatter `status: archived`, додай посилання на v2 на початку
- Новий: `BE.8-Legacy-SMS-Migration-Plan-v2.md` → лінк назад на v1 в `See also`

---

## Правило 15 — Що НЕ робити

❌ Не створюй файл без додавання в Home.md  
❌ Не залишай файл без `[[Home]]` backlink в breadcrumb  
❌ Не використовуй `[[example]]` як ілюстрацію — обгортай в backticks  
❌ Не клади все в root — використовуй категорійні папки  
❌ Не використовуй теги для тем — теги для статусів/областей  
❌ Не пиши деталі в назві файлу — деталі в контенті, назва коротка  
❌ Не дублюй контент — оновлюй існуючий файл  
❌ Не лінкуй на неіснуючий файл без явного плану створення  
❌ Не змішуй українську й англійську в назвах файлів — обери одну (бажано англійську)  
❌ Не комітуй .md без audit (Правило 13)

---

## Швидка пам'ятка (TL;DR)

При створенні нового файлу:

1. **Визнач категорію** → обери папку
2. **Назва файлу** = H1 заголовок (Title Case English)
3. **Frontmatter** мінімальний (`type`, `status`, `created`)
4. **Breadcrumb** після H1: `> Part of [[Home]] > Section | See also: [[X]], [[Y]], [[Z]]`
5. **Контент** атомарний, без дублів
6. **Додай в Home.md** у правильну секцію
7. **Запусти audit** (Правило 13) перед commit
8. **Якщо є ghost links** — перерахуй їх в commit message

---

## Правило 16 — Reciprocity (взаємні лінки)

Якщо файл A посилається на файл B у `See also` — файл B має згадати A в одному з трьох місць:
1. В своєму `See also` breadcrumb (повний reciprocity — найкраще)
2. В тілі тексту як `[[A]]` в релевантному контексті
3. У відповідній секції (наприклад, "Related plans")

**Чому це критично**: однонапрямні лінки створюють "вхідні-перевантажені" вузли (висока inbound, нуль outbound), які виглядають у графі як кінцеві точки. Reciprocity робить кластери щільними і зрозумілими.

**Виняток**: лінк на Home не вимагає reciprocity (Home — це hub, він не повторює всі діти).

---

## Правило 17 — Глибина від Home (max 2 hops)

**Кожен файл має бути досяжний з Home за ≤2 кліки.**

- **1 hop**: файл згаданий безпосередньо в Home.md (стандарт для всіх основних доків)
- **2 hops**: файл згаданий в іншому файлі, який згаданий в Home (для sub-tasks, sub-devlogs, sub-reviews)
- **3+ hops**: ❌ заборонено — або підніми файл в Home, або зроби 1 hop через категорійний MOC

**Як перевірити**: відкрий Home.md → подивись чи бачиш свій новий файл або його батька. Якщо ні — додай.

---

## Правило 18 — Backlinks workflow при редагуванні

**Коли редагуєш існуючий файл**:

1. Спочатку відкрий його в Obsidian і подивись на панель **Backlinks** (sidebar)
2. Перевір секцію **"Linked mentions"** — це вже існуючі зв'язки, не чіпай їх без потреби
3. Перевір секцію **"Unlinked mentions"** — це місця, де вже згадано назву цього файлу без `[[]]`. **Перетвори їх на справжні лінки** (це найшвидший спосіб "зашити" сиріт)
4. Якщо ти **додаєш новий розділ** з посиланнями на інші файли — переконайся що ті файли мають reciprocity на тебе (Правило 16)
5. Якщо ти **перейменовуєш файл** — Obsidian оновить лінки автоматично, але запусти audit (Правило 13)

**CLI-еквівалент** (для AI агентів які працюють через Bash):
```bash
# Знайти unlinked mentions для File-Name
grep -rn "File Name" docs/ | grep -v "\[\[File Name"
```

---

## Правило 19 — Що НЕ класти у vault

❌ **Секрети, токени, паролі**, навіть в .md файлах. Якщо треба референс — додай як `[[GitHub Secrets Inventory]]` (опис назв змінних, без значень).
❌ **Великі бінарні файли** (>5MB зображення, відео). Якщо треба — клади в `Telnyx/` як референс і згадай в Home.
❌ **Особиста переписка**, банківські дані, медичні записи.
❌ **Згенеровані файли** (build artifacts, logs, dumps) — їм місце в `.gitignore`, не в vault.
❌ **Дублі контенту** з основного коду — vault описує систему, а не повторює код.
❌ **Тимчасові draft без власника** — або додай `owner` + `status: draft` у frontmatter, або не комітуй.

✅ Дозволено: PDF юридичних документів, screenshots з UX, маленькі діаграми, схеми.

---

## Правило 20 — Стандартні значення properties

Щоб граф можна було фільтрувати консистентно, всі AI використовують **однакові значення** в frontmatter:

### `type` (обов'язково)
- `system` — системна / governance note
- `profile` — профіль AI або owner
- `product-brief` — canonical product brief
- `research-brief` — AI 5 research brief
- `compliance-requirement` — AI 7 requirements note
- `plan` — execution plan / strategy doc
- `qa-scan` — QA / verification note
- `runbook` — repeatable operational procedure
- `decision-log` — permanent decision note
- `incident-report` — incident / hotfix / postmortem note
- `growth-brief` — growth / funnel / messaging brief
- `open-questions` — explicit unknowns register
- `reference` — stable reference doc
- `moc` — Map of Content / hub note

**Legacy values still allowed during staged migration**:
- `feature`
- `architecture`
- `backend`
- `frontend`
- `task`
- `review`
- `devlog`
- `decision`

### `status` (обов'язково)
- `active` — поточна робота
- `draft` — чорновик, ще не готовий
- `review` — готово до перевірки, але ще не final
- `done` — завершено
- `superseded` — замінене новішим canonical note
- `archived` — застаріле, замінене
- `blocked` — чекає на розблокування
- `pending` — в очікуванні рішення

### `source_of_truth` (рекомендовано для всіх важливих notes)
- `true` — canonical / binding note
- `false` — supporting / working / historical / non-binding note

### `owner` (опціонально, для tasks/plans/reviews)
- `AI 1` (Claude Code CLI — backend, infra)
- `AI 2` (Codex / Claude Web — frontend, UX)
- `AI 3` (Verdent — architecture, decisions, QA)
- `AI 4` (Phone AI — coordination)
- `AI 5` (GPT Chat Deep Research — external truth)
- `AI 6` (Product Strategist — product framing)
- `AI 7` (Compliance Executor — policy-to-implementation)
- `AI 8` (Growth Marketing Operator — funnel and messaging)
- `Owner` (Назарій)

### `priority` (опціонально, для tasks)
- `p0` — критично, блокує launch
- `p1` — важливо, цей спринт
- `p2` — потрібно, наступний спринт
- `p3` — приємно мати

### `tags` (опціонально, лише cross-cutting)
- `area/sms`, `area/payments`, `area/auth`, `area/booking`, `area/ios`, `area/payroll`
- `status/inbox` (для новостворених без чіткої категорії)
- `review/weekly`, `review/launch`

---

## Templates (готові до копіювання)

### Шаблон 1: Feature doc (нова продуктова фіча)

```markdown
---
type: feature
status: active
created: 2026-04-15
---

# <Feature Name>

> Part of [[Home]] > Features | See also: [[Related Feature 1]], [[Related Feature 2]], [[API Routes]]

## Overview
Один абзац: що це таке, для кого, як вписується в продукт.

## Frontend
- `/route` — що користувач бачить
- Ключові компоненти: [[Components]]

## Backend
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/...` | ... |

## Data Model
```
{ field: type, ... }
```

## Plan Gating (якщо є)
- `individual`: yes/no
- `salon`: yes/no
- `custom`: yes/no

## Firestore
- Collection: `workspaces/{wsId}/...`

### Шаблон 2: Architecture doc

```markdown
---
type: architecture
status: active
created: 2026-04-15
---

# <Architecture Topic>

> Part of [[Home]] > Architecture | See also: [[Tech Stack]], [[Related Architecture Doc]]

## Overview
Що це за компонент, де він у системі.

## How It Works
Покроково або діаграмою.

## Configuration
- Env vars: ...
- Settings: ...

## Failure Modes
- Що зламається якщо ...
- Як відновити
```

### Шаблон 3: Task / Plan

```markdown
---
type: plan
status: active
priority: p1
owner: AI 1
created: 2026-04-15
---

# <Task Name>

> [[Home]] > Tasks | Related: [[Launch Readiness Plan]], [[Related Task]]

## Goal
Один рядок: що треба досягти.

## Why
Контекст: чому це важливо зараз.

## Scope
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Out of Scope
- Що НЕ робимо в цій задачі.

## Success Criteria
- Як перевірити що зроблено.

## Dependencies
- [[File які мають бути готові перед цією задачею]]
```

### Шаблон 4: Review / QA

```markdown
---
type: review
status: done
owner: AI 1
created: 2026-04-15
---

# <Scope> Review — 2026-04-15

> [[Home]] > QA & Quality | See also: [[QA-Scanner-Guide]], [[Related Review]]

## Scope
Що рев'юив (файли, фічі, period).

## Findings
### Critical
- Issue 1: опис, посилання на код

### Warnings
- Issue 2: опис

### Notes
- Observation 1

## Action Items
- [ ] Fix critical issue 1 → [[Tasks/...]]
- [ ] Investigate warning 2

## Sign-off
- Reviewer: AI 1
- Date: 2026-04-15
- Status: PASS / FAIL / NEEDS WORK
```

### Шаблон 5: DevLog (щоденна сесія)

```markdown
---
type: devlog
status: done
created: 2026-04-15
---

# 2026-04-15 — <Тема або пусто>

> [[Home]] > DevLog | Related: [[Feature1]], [[Feature2]]

## Done
### <Topic 1>
- Що зроблено
- Файли: `path/to/file.ts`

### <Topic 2>
- ...

## In Progress
- ...

## Blocked
- ...

## Notes
- Спостереження для майбутнього
```

### Шаблон 6: AI Profile

```markdown
---
type: profile
status: active
created: 2026-04-15
---

# <AI Name або Owner Name>

> [[Home]] > AI Profiles | See also: [[AI-Work-Split]], [[Other AI Profile]]

## Identity
- **Tool**: Claude Code CLI / Codex / Verdent / etc
- **Owner area**: Backend & Infra / Frontend & UX / Architecture / Coordination

## Responsibilities
- Що цей AI відповідає
- Що НЕ робить (escalation rules)

## Owned Files
- `Architecture/...`
- `Backend/...`

## Communication Protocol
- Як інші AI звертаються до цього
- Як цей AI звертається до інших
```

### Шаблон 7: MOC (Map of Content / hub)

```markdown
---
type: moc
status: active
created: 2026-04-15
---

# <Topic> MOC

> [[Home]] > <Section> | See also: [[Parent MOC]]

## Огляд
Один абзац: що цей MOC об'єднує.

## Активні документи
- [[Doc 1]] — короткий опис
- [[Doc 2]] — короткий опис
- [[Doc 3]] — короткий опис

## Архівні
- [[Old Doc]] — замінено на [[New Doc]]

## Питання та прогалини
- [[Question 1]]
- [[Planned Doc]] — ще не створено
```

### Шаблон 8: Universal новий файл (коли тип ще не визначений)

```markdown
---
type: note
status: draft
tags:
  - status/inbox
created: 2026-04-15
---

# <Title>

> [[Home]] > Inbox | See also: [[]]

## Контекст
Звідки прийшла ідея, для чого це.

## Зміст
- 

## Наступні кроки
- [ ] Визначити правильний тип і папку
- [ ] Перенести в правильну категорію
- [ ] Додати 2-3 осмислені See also лінки
- [ ] Додати в Home.md
- [ ] Прибрати з inbox
```

---

## Контакти і ескалація

- Зміни в цих правилах: пропонує AI 3 (Verdent), затверджує Owner.
- Конфлікти інтерпретації: дивись [[AI-Work-Split]] для розподілу відповідальності.
- При сумнівах щодо структури: дивись [[Architecture/Decision-Log|Decision Log]] для прецедентів.
- При новому типі контенту, який не вписується ні в один шаблон — створи `Inbox` файл (Шаблон 8) і ескалюй до Owner.
