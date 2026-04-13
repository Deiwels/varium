# Edge Case Bugs — Deep Scan

> [[Home]] > Tasks | Scan date: 2026-04-14
> These are edge cases that could affect real users under specific conditions.

---

## HIGH — Should fix before scaling

### EDGE 1: Double booking race condition
- **File**: `backend/index.js` ensureNoConflictTx function
- **What**: If existing booking has null/malformed start_at, conflict check skips it. Two simultaneous requests can both pass and create overlapping bookings.
- **Impact**: Barber gets 2 simultaneous bookings
- **Fix**: Treat null dates as conflicting (fail-safe), not passing
- **Owner**: AI 1

### EDGE 2: Memory leak in rate limiter maps
- **File**: `backend/index.js` — `_apiRateBuckets`, `_bookingRateMap`
- **What**: These Maps have NO cleanup logic. Only `publicRateLimits` has cleanup.
- **Impact**: Under high traffic, memory grows → Cloud Run OOM after hours/days
- **Fix**: Add cleanup intervals for all in-memory Maps
- **Owner**: AI 1

### EDGE 3: Square token refresh fails silently
- **File**: `backend/index.js` getSquareToken function
- **What**: If refresh token expires (180 days), code returns expired access_token. Next API call fails 401.
- **Impact**: Square payments silently break. Owner doesn't know until customer complains.
- **Fix**: Return explicit error when refresh fails, show "Reconnect Square" in frontend
- **Owner**: AI 1

---

## MEDIUM — Track and fix

### EDGE 4: SMS no retry
- **File**: `backend/index.js` sendSms function
- **What**: Network error → resolve(null) → caller swallows with .catch(() => {})
- **Impact**: Appointment reminders silently lost. No audit trail.
- **Fix**: Add retry (like sendEmail) + log failed SMS
- **Owner**: AI 1

### EDGE 5: PHONE_ENCRYPTION_KEY lifecycle
- **File**: `backend/index.js` encryptPhone/decryptPhone
- **What**: If key is empty → phones stored plaintext. If key added later → old plaintext phones become "corrupted" (show as ****).
- **Impact**: Data appears lost after key change. No migration path.
- **Note**: Key is currently set in production. Only a risk if key is rotated.
- **Fix**: Add migration endpoint to re-encrypt existing data when key changes
- **Owner**: AI 1 (future)

### EDGE 6: Reference photo 800KB in Firestore doc
- **File**: `backend/index.js` ~line 8171
- **What**: Reference photos stored as base64 data URLs in booking doc. Firestore 1MB limit.
- **Impact**: Large photos could cause booking creation to fail silently
- **Fix**: Move to Cloud Storage or reduce max size to 500KB
- **Owner**: AI 1 (future)

### EDGE 7: Waitlist limit 10
- **File**: `backend/index.js` waitlist notification query
- **What**: Query limits to 10 waitlist entries. Person #11+ never notified.
- **Impact**: Popular slots don't notify all waitlisted customers
- **Fix**: Increase limit or paginate
- **Owner**: AI 1

### EDGE 8: DST timezone edge cases
- **File**: `backend/index.js` zonedTimeToUtc, SMS reminder scheduling
- **What**: Booking at 2 AM during spring-forward creates invalid time. SMS reminders may be offset by hours near DST boundary.
- **Impact**: Rare (affects 2 days/year, 1-2 AM slots only)
- **Fix**: Add DST-aware validation for booking times
- **Owner**: AI 1 (future)

### EDGE 9: Decryption failure shows ****
- **File**: `backend/index.js` decryptPhone, decryptPII
- **What**: Any decryption error returns **** — no log, no audit trail
- **Impact**: Corrupted records silently masked
- **Fix**: Log decryption failures with record ID for diagnosis
- **Owner**: AI 1

---

## Current Production Status

These are edge cases — the main flows are safe:
- Single booking: fully validated with conflict detection ✓
- Payments: webhook-verified, price-checked ✓
- Payroll: audited and accurate ✓
- Auth: JWT + rate limiting + OAuth verified ✓
- Cash register: field normalization working ✓

The edge cases above mostly affect:
- High-traffic scenarios (memory leak)
- Long-running instances (Square token expiry)
- Rare timing (DST transitions)
- Data lifecycle (encryption key rotation)
