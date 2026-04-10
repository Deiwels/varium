# SMS Campaign Re-Registration Requirements

## Причина відмови

Кампанія (TCR: C1BWNV7, Telnyx ID: 4b30019d-7276-795d-7f4e-4b33a7cf4b50) отримала статус TELNYX_FAILED.

Причини:
1. Кампанія зареєстрована як 2FA, але Privacy Policy описує appointment-reminder SMS
2. Опис кампанії включає "system notifications" — занадто розмито для 2FA
3. Назва компанії "Element Barbershop Co" не збігається з "Vurium Inc."

## Що потрібно зробити

Створити 2 ОКРЕМІ кампанії:
- **CUSTOMER_CARE** — бронювання, нагадування, скасування
- **2FA** — коди верифікації телефону

---

## Потрібна інформація

### 1. Юридична інформація компанії (Brand)

Telnyx відхилив через невідповідність: на файлі "Element Barbershop Co", а кампанія працює як "Vurium Inc."

- [ ] Яка точна юридична назва компанії (як в IRS/EIN документах)? "Vurium Inc."?
- [ ] EIN номер — підтвердити що він відповідає саме цій юридичній назві
- [ ] Entity Type: Corporation, LLC, Sole Proprietor, чи інше?
- [ ] Фізична адреса: 1142 W Lake Cook Rd, Buffalo Grove, IL 60089 — це правильна і актуальна?
- [ ] Контактний телефон для реєстрації бренду
- [ ] Email для реєстрації бренду
- [ ] Website: vurium.com — підтвердити

### 2. Кампанія #1 — CUSTOMER_CARE (бронювання та нагадування)

Це основна кампанія для повідомлень клієнтам барбершопів/салонів.

- [ ] Чи ок такий опис кампанії?

> "Appointment-related transactional SMS sent by individual barbershops and salons to their clients who explicitly opt in during online booking. Messages include: booking confirmations, appointment reminders (24 hours and 2 hours before), schedule changes, and cancellation notices. Maximum frequency: up to 5 messages per booking."

- [ ] Sample Message 1 (підтвердження):

> "{ShopName}: Your appointment is confirmed for Mon Apr 7 at 2:00 PM with John. Msg freq varies, up to 5 msgs/booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help."

- [ ] Sample Message 2 (нагадування):

> "{ShopName}: Reminder: Your appointment with John is tomorrow Mon Apr 7 at 2:00 PM. Reply STOP to opt out, HELP for help."

- [ ] Чи потрібно щось додати/змінити в цих прикладах?

### 3. Кампанія #2 — 2FA (верифікація телефону)

Окрема кампанія виключно для одноразових кодів верифікації.

- [ ] Чи ок такий опис?

> "One-time verification codes (OTP) sent to users to verify phone number ownership during the booking or account verification process. Each verification sends a single SMS with a 6-digit code. No marketing or appointment-related content."

- [ ] Sample Message:

> "{ShopName}: Your verification code is 123456. Do not share this code. Msg & data rates may apply. Reply STOP to opt out, HELP for help."

- [ ] Чи потрібно щось змінити?

### 4. Telnyx акаунт

- [ ] Чи потрібно спершу видалити/скасувати стару rejected кампанію (C1BWNV7) вручну через Telnyx Portal, чи можна створити нові поверх?
- [ ] Чи потрібно перереєструвати Brand з правильною назвою, чи тільки кампанії?
- [ ] Чи є зараз доступ до Telnyx Portal щоб перевірити поточний стан бренду?
- [ ] Для 2 кампаній потрібно 2 окремих телефонних номери — це ок? (кожна кампанія на Telnyx прив'язується до свого номера)

### 5. Privacy Policy

Зараз Privacy Policy (vurium.com/privacy) описує тільки appointment SMS. Потрібно додати окремий пункт про 2FA/verification SMS:

- [ ] Тип: одноразовий код верифікації
- [ ] Частота: 1 повідомлення на запит верифікації
- [ ] Мета: підтвердження номера телефону
- [ ] Чи є якісь додаткові вимоги до тексту Privacy Policy?

### 6. Placeholder в коді

Зараз у формі налаштувань placeholder — "Element Barbershop Co".

- [ ] На що замінити? Наприклад "Acme Barbers LLC" або інший нейтральний приклад?

---

## Зміни в коді після отримання відповідей

| Файл | Що змінити |
|---|---|
| backend/index.js (рядки 4541-4572) | Розділити реєстрацію на 2 кампанії: CUSTOMER_CARE + 2FA |
| backend/index.js (рядки 4498-4510) | Оновити Brand registration payload (назва компанії, EIN) |
| backend/index.js (рядки 6414-6451) | Виділити 2FA SMS на окремий номер/кампанію |
| app/privacy/page.tsx (рядки 71-85) | Додати секцію про 2FA verification SMS |
| app/settings/page.tsx (рядки 244-245) | Замінити placeholder "Element Barbershop Co" |
| backend/index.js (рядки 630-636) | Перевірити формат reminder повідомлень |
