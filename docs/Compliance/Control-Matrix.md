---
type: reference
status: active
created: 2026-04-15
owner: AI 7
---

# Compliance Control Matrix

> Part of [[Home]] > Compliance | See also: [[Compliance/Implementation-Checklist|Compliance Implementation Checklist]], [[Compliance/Requirements/README|Compliance Requirements]], [[Compliance/Vendor-Constraints/README|Vendor Constraints]]

## Purpose

Map external/compliance truths to system controls and owner actions.

## Structure

Each row maps an external truth to one or more system controls.

---

## TFV — Toll-Free Verification (Telnyx)

Source: [[Compliance/Vendor-Constraints/Telnyx-TFV|Telnyx TFV Vendor Constraints]], [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Requirements]]

| # | External Truth | Affected Area | Required Control | Owner Action | Monitoring |
|---|---|---|---|---|---|
| TFV-1 | Toll-free numbers must be `Verified` before outbound SMS | Backend — sending guard | `getWorkspaceSmsConfig()` blocks send unless `status === 'active'` | None (automated) | Alert on `40329` error in production |
| TFV-2 | Purchase + profile attachment alone is not delivery-ready | Backend — provisioning | `provisionTollFreeSmsForWorkspace()` writes `configured`, not `active` | None (automated) | Verify Firestore shows `configured` after provision |
| TFV-3 | TFV requires business identity matching the sender | Backend — TFV submission | Payload maps `shop_name`, `shop_email`, `shop_phone`, per-workspace booking URL | Owner fills Business Profile completely | Gate: TFV submission blocked until shop_* fields present |
| TFV-4 | ISV / Reseller model rejected for multi-tenant platforms | Architecture | Per-workspace TFV, no ISV flag, no "on behalf of" language | None (architectural decision) | Review any new TFV request for ISV markers |
| TFV-5 | SMS consent must be optional, unchecked, separate, branded | Frontend — booking page | Consent checkbox: unchecked default, SMS-only, `{shop_name}` branding | None (automated per workspace) | CTA review on each workspace before TFV submission |
| TFV-6 | STOP/HELP must work at carrier level | Backend + Telnyx profile | Carrier-level STOP response + profile-level opt-out + HELP autoresponse configured | Live-test STOP + HELP after each workspace reaches `active` | Log STOP/HELP events per workspace |
| TFV-7 | Newly verified traffic may be carrier-filtered | Operations | No enforcement, awareness only | Gradual ramp-up for first 1-2 weeks post-Verified | Monitor delivery rates for newly verified senders |
| TFV-8 | Max 10 messages per recipient per 24h (unless two-way) | Backend — sending logic | Current reminder volume (3 per booking) is within limit | Monitor if message types expand | Alert if any recipient exceeds 10 messages/24h |
| TFV-9 | Messaging profile STOP scope is per-profile | Architecture | Dedicated messaging profile per workspace | None (automated at provisioning) | Verify no profile sharing across workspaces |
| TFV-10 | Privacy policy must include SMS no-sharing language | Legal docs | `vurium.com/privacy` SMS section includes required disclosures | Owner reviews privacy policy content | Periodic review of legal page content |
| TFV-11 | Element Barbershop on grandfathered 10DLC path | Backend — exclusion | `isLegacyManualSmsPath()` + `isProtectedLegacyWorkspace()` bypass TFV flow | Verify Element status unchanged after deploys | Post-deploy Element status check |
