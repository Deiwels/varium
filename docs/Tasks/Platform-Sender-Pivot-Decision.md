# Platform Sender Pivot — Decision Note

> [[Home]] > Tasks | Owner: AI 1 (docs) · Blocked on: external Telnyx confirmation
> Related: [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/SMS-Strategy-Review|SMS Strategy Review]], [[Features/SMS & 10DLC|SMS & 10DLC]], [[Tasks/SMS Finalization Plan|SMS Finalization Plan]]
> Created: 2026-04-15

---

## TL;DR

**Питання:** Чи може VuriumBook перейти на Booksy/Square-модель, де один Vurium-owned toll-free номер шле appointment reminders для всіх бізнесів на платформі?

**Статус:** ❌ **Не впроваджуємо зараз.** Операційний блокер + історія rejection-у.

**Launch path:** Залишаємось на **dual-path** (per-workspace TFN + grandfathered manual 10DLC) як описано в [[Tasks/SMS-Strategy-Review]]. Додаємо **auto-provision на активацію плану** як UX-покращення (див. [[Tasks/Telnyx-Integration-Plan]] Gap 5), щоб наблизити owner experience до Booksy без зміни compliance моделі.

**Після launch:** Запит до Telnyx (Jonathan) на підтвердження whether a Vurium-owned TFN може легально возити multi-business traffic. Якщо так → окремий pivot plan із consent re-flow, legal updates, TFV submission, і тільки тоді code changes.

---

## Чому це питання піднялося

Власник висловив legitimate product concern:

> "Я не можу у кожного клієнта брати AI / EIN щоб йому приходило повідомлення. Такого я не бачу ніде. Я хочу як Booksy."

І це правильний product intent. У Booksy та Square власник справді нічого не налаштовує — SMS просто працює одразу після signup. У нас поточний dual-path формально також не вимагає EIN (toll-free path без KYC), але є **один клік у Settings** який створює friction.

Verdent запропонував plan "прибрати `allowGlobalFallback: false` у всіх call-sites і відправляти все через один `TELNYX_FROM`". Це **технічно коректний code patch**, але пропускає кілька критичних compliance обмежень, описаних нижче.

---

## Чому не можна зробити "як Booksy/Square" одним patch-ем

### 1. Ми це вже пробували — і отримали rejection code 710

Із [[Features/SMS & 10DLC|SMS & 10DLC]]:

> **Platform-as-sender was rejected ❌**
> Submitted one VuriumBook brand + one CUSTOMER_CARE campaign for all businesses.
> **Rejected with code 710** — "Reseller / Non-compliant KYC. Register the brand info, not the agency behind the brand."

Sample messages тоді були **буквально ідентичні** тому, що пропонує Verdent:

```
VuriumBook: Your appointment with Element Barbershop is confirmed for Apr 12 at 2:00 PM...
VuriumBook: Reminder - your appointment with North Shore Salon is tomorrow at 11:00 AM...
VuriumBook: Reminder - your appointment with Fade District Barbers is in 2 hours...
```

Carrier побачив у sample messages різні назви бізнесів і вирішив що VuriumBook — це агенція/ресейлер, а не справжній sender. Це і є code 710.

Telnyx ISV guidance, яку Jonathan підтвердив на call-у:
> "Unless your business is a franchise, [single brand for multiple end-users] is unlikely to be approved."

Це не технічна помилка — це **product рішення carrier-ів**, яке не обійти code patch-ем. Джерела:
- [Telnyx — ISVs & 10DLC](https://support.telnyx.com/en/articles/5593977-isvs-10dlc)
- [Telnyx — Toll-Free Messaging](https://support.telnyx.com/en/articles/5353868-toll-free-messaging)

### 2. Square ≠ VuriumBook (поки що)

Square справді шле appointment texts з централізованого toll-free. Підтверджено офіційно: [Square Support](https://squareup.com/help/us/en/article/8447-troubleshoot-customer-appointment-communications).

Але:
- Square — це один великий визнаний бренд, який carrier-и знають роками
- Square має внутрішні домовленості з операторами, до яких ми ще не маємо доступу
- Square sample messages мають власний compliance framework, який вже approved

Просто скопіювати архітектуру Square **не означає**, що carrier-и до нас поставляться так само. Потрібно пройти той самий approval шлях.

### 3. Booksy sender rail — непідтверджений

Booksy офіційно каже, що вони централізовано надсилають reminders і verification texts за свій рахунок:
- [Booksy reminders](https://support.booksy.com/hc/en-gb/articles/16463854228114-Does-Booksy-send-clients-reminders-of-their-upcoming-appointments)
- [Booksy text troubleshooting](https://support.booksy.com/hc/en-us/articles/18791260716690-Why-aren-t-my-clients-receiving-verification-codes-or-other-text-messages-from-Booksy)

**Але жодне з цих джерел не доводить**, що Booksy використовує один toll-free на всіх vs per-business short code vs щось інше. Наша в [[Tasks/SMS-Strategy-Review]] стара нота "Booksy long code" — це internal observation, не офіційний факт.

Тобто нам нема на що посилатись як на precedent для нашої ситуації.

### 4. Toll-Free Verification (TFV) — окрема робота

Щоб Vurium-owned TFN реально возив reminder traffic для multi-business use case, він повинен пройти **Toll-Free Verification** через Telnyx до операторів. Без TFV:

- T-Mobile throttle ~2 msg/sec
- AT&T / Verizon можуть блокувати
- Delivery rate падає нижче 50%

TFV submission — це окремий review цикл (дні–тижні), зі своїми sample messages які carrier знову оцінить на той самий 710 патерн. TFV submission НЕ є "одна строчка коду".

### 5. CTIA opt-in non-transferability

CTIA правило (згадане в наших doc-ах): **"opt-in is NOT transferable across Message Senders."**

Зараз consent text у нас: `{shopName} Appointment Notifications`. Sender в очах користувача — `{shopName}` (через власний TFN цього workspace). Якщо sender змінити на `Vurium`, це **інший sender** і стара згода не переноситься.

Треба буде:
- Новий consent text, де прямо написано, що SMS приходять **від Vurium on behalf of {Business}**
- Re-consent flow для існуючих клієнтів (або явно винести їх у grandfathered path)
- Оновлені privacy/terms pages
- Оновлений [[Features/SMS & 10DLC|SMS & 10DLC]] compliance розділ

Це теж не code patch — це legal + product work.

### 6. STOP isolation ламається на shared sender

Сценарій: клієнт дав згоду Element Barbershop, потім окремо North Shore Salon. На per-workspace TFN кожен STOP ізольований — клієнт може відписатися від одного без зачіпання іншого.

На shared Vurium TFN: STOP — це opt-out **з ВСІХ** бізнесів на платформі одразу, бо sender один. Verdent у плані це частково визнав ("виставляти opt-out у всіх workspaces"), але це не рішення — це визнання, що opt-in isolation ламається. Carrier-и цього не люблять, і CTIA теж.

---

## Три можливі шляхи

### Варіант A — Залишаємось на dual-path + auto-provision (РЕКОМЕНДОВАНО для launch)

**Зміст:**
- Нові workspace → per-workspace toll-free через `enable-tollfree`
- Grandfathered → manual 10DLC (Element protected)
- **Нове:** `provisionTollFreeSmsForWorkspace()` викликається автоматично при активації платного плану (див. [[Tasks/Telnyx-Integration-Plan]] Gap 5)
- Owner не бачить "Enable SMS" кнопку як обов'язковий крок — номер з'являється сам протягом кількох хвилин після плану
- Settings все ще показує стан + manual retry якщо auto-provision провалився
- Email-only fallback поки TFN не active

**Плюси:**
- Compliance-safe, нічого не ламає
- Launch можливий **цього тижня**
- UX близький до Booksy (власник нічого не налаштовує явно)
- Consent text, STOP isolation, legal pages — без змін
- Element Barbershop недоторканий

**Мінуси:**
- Кожен workspace витрачає 1 TFN ($1.10/міс)
- ~1-2 хвилини затримки між активацією плану і першим SMS
- Не "правдиво Booksy" з точки зору архітектури, але з точки зору owner experience — майже

**Cost estimate:** $1.10/workspace/місяць · за 50 workspaces = **$55/місяць**. Прийнятно.

### Варіант B — Повний pivot на platform sender (ВІДКЛАДЕНО)

**Зміст:** Verdent-style `TELNYX_FROM` для всіх. **Потребує preconditions:**

1. Lист до Jonathan → письмова згода Telnyx що цей pattern acceptable для нас
2. TFV submission для Vurium-owned TFN із sample messages у форматі `{Business Name}: ...`
3. TFV approval від carrier-ів (дні-тижні)
4. Новий consent text + re-consent migration для існуючих клієнтів
5. Legal pages (privacy/terms) updated
6. STOP semantics переписати
7. Rollback plan на випадок другого 710
8. Тільки після всього — code patch (той самий що запропонував Verdent)

**Launch impact:** мінімум 1-2 тижні operational + legal роботи. **Блокує launch.**

**Ризик:** повторний 710 reject.

### Варіант C — Hybrid (long-term, після launch)

- Малі / solo operators → shared Vurium TFN (після TFV approval)
- Великі бізнеси → дедикований TFN або 10DLC (на вибір)
- Дефолт — централізований, але upgrade path є

Це, ймовірно, правильна long-term архітектура, але **після** Варіанту A і після того, як Telnyx дасть офіційний зелений на shared sender.

---

## Рішення на 2026-04-15

**Launch path:** Варіант A (dual-path + auto-provision на активацію плану).

**Paralle

l track:** Підняти Варіант B як запит до Jonathan (лист нижче). Якщо Telnyx підтвердить шлях — після launch перейти на Варіант C.

**Не робимо зараз:**
- Не чіпаємо `allowGlobalFallback: false` у reminder call-sites
- Не змінюємо consent text
- Не змінюємо sender model
- Не змінюємо STOP handler semantics

**Робимо зараз** (див. [[Tasks/Telnyx-Integration-Plan]]):
- Gap 1 — `TELNYX_VERIFY_PROFILE_ID` перевірка
- Gap 2 — webhook signature verification (Ed25519)
- Gap 3 — `phone_number_index` для O(1) STOP lookup
- Gap 4 — `runAutoReminders()` pagination
- Gap 5 — auto-provision toll-free на активацію плану

---

## Draft letter для Jonathan (Telnyx)

> Subject: ISV question — Vurium-owned toll-free for multi-business appointment reminders
>
> Hi Jonathan,
>
> Following up on our earlier conversation about Vurium's SMS architecture. We're finalizing our launch path and I want to confirm one direction directly with you before we commit to it.
>
> **Current state:**
> - Vurium Inc. brand verified on Telnyx (TCR ID: BCFAC3G)
> - We previously submitted a platform-level CUSTOMER_CARE campaign (TCR Campaign ID: CKAOXOW) that was rejected with carrier code 710 — "Reseller / Non-compliant KYC"
> - After that, we moved to a per-workspace model: each business gets its own dedicated toll-free number via `POST /v2/number_orders`, with their own messaging profile, and reminders are sent with the format `{Business Name}: <message>`
> - Element Barbershop (TCR Campaign ID: CICHCOJ) is still on the manual 10DLC grandfathered path and has now received a failed MNO review for website / CTA issues
>
> **What we want to understand:**
>
> 1. Is there a supported architecture where a **Vurium-owned toll-free number** (verified through TFV) can legitimately send appointment reminder traffic on behalf of **multiple independent end-businesses** — similar to how Square's appointment messaging works?
>
> 2. If yes, what specifically differentiates an acceptable submission from the one that got code 710 in our earlier attempt? Is it:
>    - A different campaign use case than CUSTOMER_CARE?
>    - Specific wording in sample messages (e.g., "sent by Vurium on behalf of {Business}" vs `{Business}: ...`)?
>    - Different brand-level metadata?
>    - An ISV-specific carrier arrangement that Telnyx can facilitate?
>
> 3. If a shared-sender approach is feasible, what is the **TFV submission process** we should follow? We would need:
>    - Confirmation that TFV is the right path (vs something like partner short code)
>    - Guidance on acceptable sample messages
>    - Expected review timeline
>    - Fallback posture if TFV submission is rejected
>
> 4. From a CTIA opt-in isolation perspective, how should we handle STOP requests on a shared Vurium sender? Specifically, if Client A has consented to receive messages from Business X and Business Y on the same Vurium number, does a STOP from Client A opt them out of both businesses, or is there a carrier-acceptable pattern for per-business opt-out on a shared sender?
>
> 5. Are there other operators (e.g., Bandwidth, Sinch) where Telnyx is seeing this pattern work for ISVs in our segment that we should be aware of, even if only as reference?
>
> **Context on what we're NOT asking:**
> - We are NOT asking to resubmit the failed CUSTOMER_CARE 10DLC campaign
> - We are NOT asking for a special case exception
> - We ARE asking whether the Booksy/Square-style "platform as the sender" pattern is officially supported for ISVs in our tier, and if so, what the compliant implementation looks like
>
> Meanwhile we are proceeding with the dual-path model we discussed (per-workspace toll-free for new workspaces, manual 10DLC grandfathered for existing, Telnyx Verify for OTP) as our launch path. Auto-provisioning of per-workspace toll-free numbers on plan activation will go live this week. Element Barbershop stays untouched on its current manual review path.
>
> Happy to hop on a call Mon–Fri 10 AM–4 PM CT next week if this is easier than email.
>
> Thanks,
> Nazarii Mykhailiuk
> Vurium Inc.

---

## Decision tree after Jonathan responds

```
Jonathan response
├── "Yes, here is the compliant shared-sender pattern"
│   └── Write new Platform-Sender-Pivot-Plan.md with:
│       ├── TFV submission checklist
│       ├── Consent re-flow
│       ├── Legal page diffs
│       ├── Code patch (Verdent-style allowGlobalFallback removal)
│       ├── Rollback plan if second 710
│       └── Target: Variant C hybrid
│
├── "No, per-business brand is required — there is no shared path"
│   └── Stay on Variant A permanently
│       └── Document as final decision in SMS-Strategy-Review.md
│
└── "Maybe — let's get on a call"
    └── Record outcome in DevLog, update this doc
```

---

## DoD for this decision note

- [x] Historical 710 rejection documented
- [x] 6 compliance obstacles explained
- [x] 3 variants compared
- [x] Launch path confirmed as Variant A
- [x] Jonathan draft letter ready to send
- [ ] Letter sent to `10dlcquestions@telnyx.com` / Jonathan directly
- [ ] Response recorded in DevLog
- [ ] Final decision logged back into `SMS-Strategy-Review.md`
