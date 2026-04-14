# Deploy Smoke Test (VR.5)

> [[Home]] > Tasks | Owner: Verdent (reviewer)
> Related: [[Tasks/Launch-Verification-Runbook|Launch Verification Runbook]], [[Tasks/In Progress|In Progress]]
> Created: 2026-04-15

---

## Purpose

Fast sanity check (~5 min) immediately after every deploy to Cloud Run + Vercel. Not a full QA pass — just confirms the deployment is alive and critical paths haven't broken. Run this **first** after every push to main.

---

## Cloud Run health

```bash
# Should return 200 + { ok: true }
curl -s https://vuriumbook-api-431945333485.us-central1.run.app/health

# Should return 200 (public, no auth)
curl -s https://vuriumbook-api-431945333485.us-central1.run.app/public/resolve/<test-workspace-slug>
```

Expected: both return 200 within 2 seconds. If Cold Start: allow up to 10 seconds on first hit.

---

## Frontend alive

- [ ] `https://app.vuriumbook.com` loads (no 5xx, no blank page)
- [ ] `/signin` renders login form
- [ ] `/book/<test-workspace-id>` renders public booking page (no white screen)

---

## Auth (30 sec)

- [ ] Sign in with test owner account → dashboard loads
- [ ] `/api/settings` returns 200 with JSON (confirms auth middleware + Firestore working)
- [ ] Sign out → redirected to `/signin`

---

## SMS trigger (60 sec)

- [ ] Create a test booking via CRM
- [ ] Check Firestore `sms_reminders` → new document written
- [ ] Check `sms_logs` → no error log (or log exists but `status: queued`)

---

## Webhook endpoints alive

```bash
# Should return 401 (no signature) — confirms handler is registered and signature check active
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://vuriumbook-api-431945333485.us-central1.run.app/api/webhooks/telnyx \
  -H "Content-Type: application/json" -d '{}'
# Expected: 401

curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://vuriumbook-api-431945333485.us-central1.run.app/api/webhooks/telnyx-10dlc \
  -H "Content-Type: application/json" -d '{}'
# Expected: 401
```

> ⚠️ If `TELNYX_WEBHOOK_PUBLIC_KEY` not yet set → expected response is 200 (soft no-op). Once secret is set, expected is 401. Document which state applies.

---

## Error budget check

- [ ] Cloud Run → Logs → filter last 10 minutes → no new `ERROR` level entries (warnings OK)
- [ ] Vercel → Functions tab → no 5xx responses

---

## Smoke test result template

Add to DevLog or PR description:

```
### Smoke Test — YYYY-MM-DD HH:MM

| Check | Result |
|---|---|
| Cloud Run /health | ✅ 200 |
| Frontend /signin | ✅ loads |
| Auth + /api/settings | ✅ 200 |
| SMS reminder write | ✅ Firestore doc written |
| Telnyx webhook 401 | ✅ / ⚠️ no-op (secret not set yet) |
| Error logs | ✅ clean / ❌ N new errors |

**Deploy verdict:** GREEN / RED
```
