# Web ↔ iOS Native Auth Contract

> [[Home]] > Architecture | See also: [[Auth Flow]], [[Decision-Log]], [[iOS App]]
> Created: 2026-04-14 (after production regression + 3 hotfixes: `95d40fc`, `59fdd7b`, `c97e184`)
> Owner: AI 1 (Claude) — backend + native contract docs. AI 2 (Codex) owns the web-side implementation in `lib/`, `middleware.ts`, `components/Shell.tsx`.

---

## Why this document exists

**Historical bug (2026-04-14):** the native iOS wrapper and the Next.js web app drifted into two different auth contracts. The website moved to a canonical cookie name, but the shipped iOS bundle still seeded the legacy names at cold start. The result was a black screen for logged-in users and an infinite `/signin → /dashboard → /signin` loop on fresh login. Required three sequential hotfixes to resolve: `95d40fc`, `59fdd7b`, `c97e184`.

**Rule going forward:** any change that touches cookie names, localStorage keys, `UserDefaults` keys, the `webkit.messageHandlers` bridge, or the `/api/auth/me` / `/api/auth/logout` contract **MUST** be reviewed against this document first. If a change would break any of the invariants below, stop and escalate to Owner before committing.

---

## The three cookies

The web app uses three cookies with distinct purposes. All three must be understood before touching auth code.

| Cookie name | Type | Set by | Read by | Purpose |
|---|---|---|---|---|
| `vuriumbook_token` | HttpOnly JWT | backend `/auth/login*` response `Set-Cookie`, **OR** native Swift `HTTPCookie` at cold start | backend `getTokenFromReq()` in `backend/index.js` | Real bearer token. Signed JWT. This is the only cookie the backend actually trusts. |
| `VURIUMBOOK_TOKEN` | Non-HttpOnly | `lib/auth-cookie.ts` `setAuthCookie()` after web login | `middleware.ts` for route protection | Canonical role flag in format `role:uid` (e.g. `owner:abc123`). Not a JWT — used purely so Next.js Edge middleware can decide redirects without calling backend. |
| `vuriumbook_auth` | Non-HttpOnly | `lib/auth-cookie.ts` writes this **alongside** the canonical cookie | `middleware.ts` as a legacy fallback | Legacy alias of `VURIUMBOOK_TOKEN` that the native iOS wrapper's cold-start bootstrap still sets. Kept alive because the shipped app bundle cannot be changed without an App Store release. |

### Critical invariants

1. **Backend only reads `vuriumbook_token`.** See `backend/index.js` `getTokenFromReq()`. Do not rename this without a coordinated native release. If you change the name, the iOS app will lose its session on every cold start.
2. **Middleware accepts both `VURIUMBOOK_TOKEN` and legacy `vuriumbook_auth`.** If only `vuriumbook_auth` is present, middleware mirrors it forward into `VURIUMBOOK_TOKEN` so the session self-heals on the first request. See `middleware.ts` `canonicalCookie || legacyCookie` pattern.
3. **`lib/auth-cookie.ts` `setAuthCookie()` must write BOTH `VURIUMBOOK_TOKEN` and `vuriumbook_auth`.** Do not simplify this to only the canonical name — you will break freshly-installed iOS users the moment they tap "sign in".
4. **`clearAuthCookie()` must clear ALL THREE names (`VURIUMBOOK_TOKEN`, `vuriumbook_auth`, `vuriumbook_token`) and it MUST include the `Secure` flag when running over HTTPS.** Safari/WKWebView refuse to delete a `Secure` cookie unless the delete operation is also `Secure`. This was the root cause of the second hotfix (`59fdd7b`).

---

## The Next.js middleware redirect contract

`middleware.ts` runs on every non-asset request. The cookie check is structured as follows:

```ts
const canonicalCookie = req.cookies.get('VURIUMBOOK_TOKEN')?.value
const legacyCookie    = req.cookies.get('vuriumbook_auth')?.value
const cookieValue     = canonicalCookie ?? legacyCookie ?? null

// No cookie at all → /signin
// Invalid cookie → /signin + clear both
// Valid cookie + role-restricted route → role-based redirect
// Valid cookie + legacy-only → mirror into canonical on the response
```

**Rules:**
- Never gate a route on `VURIUMBOOK_TOKEN` alone. Always accept `vuriumbook_auth` as an equal fallback until the native bundle is rebuilt with the canonical name.
- The response must set `VURIUMBOOK_TOKEN` when only the legacy cookie was present, so subsequent requests do not keep falling through the legacy branch.
- Never add a route to `PUBLIC_PATHS` unless you explicitly want unauthenticated access — doing so silently bypasses the entire session check.

---

## The Shell bootstrap contract

`components/Shell.tsx` mounts on every authenticated page and is the **first point at which the client-side session can fail**. Its contract with the rest of the app:

1. Read the bearer token in this priority order:
   1. `localStorage.getItem('VURIUMBOOK_TOKEN')`
   2. (fallback added by `95d40fc`) read `document.cookie` for `vuriumbook_token` and promote it into `localStorage` so subsequent API calls can find it
2. If no token can be found at all → mark session as `noauth` → `redirectToSignIn()`.
3. If a token is found → call `/api/auth/me` to validate.
4. On `401` from `/api/auth/me` → go through `redirectToSignIn()`.

`redirectToSignIn()` (and `lib/api.ts` on any non-login 401) must:
- `localStorage.removeItem('VURIUMBOOK_TOKEN')`
- `localStorage.removeItem('VURIUMBOOK_USER')`
- `clearAuthCookie()` (clears all three cookies)
- **`window.webkit?.messageHandlers?.logout?.postMessage('logout')`** — tells native iOS to clear `UserDefaults`
- `window.location.replace('/signin')`

If any one of these steps is skipped, the infinite loop from 2026-04-14 can come back.

---

## The native iOS bridge (read-only — not in the web repo)

File: `/Users/nazarii/Desktop/untitled folder/VuriumBook/VuriumBook/VuriumWebView.swift`. This is the iOS app bundle, shipped separately to the App Store. The web repo cannot change it; we can only respect its contract.

### UserDefaults keys Swift reads

| Key | Written by | Restored to |
|---|---|---|
| `vurium_auth_token` | Swift sync script (line ~181, ~229, ~505) after reading `localStorage.VURIUMBOOK_TOKEN` | Re-injected as `vuriumbook_token` HTTPCookie on cold start (line ~90-121) and as a localStorage restore script on every page load (line ~468-488) |
| `vurium_user_json` | Same sync path | Re-injected as `VURIUMBOOK_USER` in localStorage |
| `vurium_push_token` | APNs registration | Injected into web page as `window.__NATIVE_PUSH_TOKEN` |
| `vurium_needs_subscription` | StoreKit flow | Read once then removed |

### The `logout` message handler

At `VuriumWebView.swift:64`:

```swift
contentController.add(context.coordinator, name: "logout")
```

At `VuriumWebView.swift:203-207` (the handler):

```swift
if message.name == "logout" {
    UserDefaults.standard.removeObject(forKey: "vurium_auth_token")
    UserDefaults.standard.removeObject(forKey: "vurium_user_json")
    // ...
}
```

**This is the only way the web app can tell the native wrapper to forget a stale session.** Without calling this bridge, Swift will keep re-injecting the expired token into `localStorage` on every `/signin` page load, creating the infinite loop fixed by `c97e184`.

Invariant: any `redirectToSignIn` or forced teardown path in `lib/api.ts` / `components/Shell.tsx` **must** include:

```ts
try { (window as any).webkit?.messageHandlers?.logout?.postMessage('logout') } catch {}
```

---

## The full auth chain (cold start)

This is the sequence after the user launches the iOS app from scratch. Read it end-to-end before touching anything in this contract.

```
1. User taps the Vurium app icon
   └─ iOS launches the WKWebView wrapper

2. Swift SwiftUI init:
   ├─ Reads UserDefaults.vurium_auth_token
   ├─ If present → creates HTTPCookie name="vuriumbook_token", value=<token>
   └─ Sets cookie on WKWebsiteDataStore before navigation

3. WKWebView loads https://vurium.com/dashboard
   └─ Request carries vuriumbook_token cookie (HttpOnly JWT)

4. Next.js middleware.ts sees the request:
   ├─ Looks for VURIUMBOOK_TOKEN (canonical role cookie) — not present
   ├─ Falls back to vuriumbook_auth (legacy role cookie) — not present either on cold start
   │  (only vuriumbook_token, the JWT, was injected by Swift)
   ├─ → Redirects to /signin with ?redirect=/dashboard
   │
   └─ OR: if the user previously signed in on web and vuriumbook_auth exists too,
          middleware accepts it and mirrors into VURIUMBOOK_TOKEN on the response.

5. /signin page loads.
   Shell.tsx detects we are on /signin and does nothing — user sees the form.

6. User taps "Sign in".
   ├─ lib/api.ts POSTs /auth/login-email → backend returns 200 + Set-Cookie vuriumbook_token
   ├─ Frontend stores token in localStorage.VURIUMBOOK_TOKEN
   ├─ lib/auth-cookie.ts setAuthCookie("owner:uid") → writes VURIUMBOOK_TOKEN + vuriumbook_auth
   └─ router.replace('/dashboard')

7. Dashboard loads.
   ├─ middleware.ts sees VURIUMBOOK_TOKEN → allows through
   ├─ Shell.tsx reads localStorage.VURIUMBOOK_TOKEN → calls /api/auth/me → 200
   ├─ Swift sync script picks up localStorage.VURIUMBOOK_TOKEN and saves to
   │  UserDefaults.vurium_auth_token for next cold start
   └─ User is in the app.
```

## The full auth chain (expired token)

This is the sequence when the user's token has expired since last launch. This is the chain that the three hotfixes fix.

```
1. Cold start → Swift injects stale vuriumbook_token from UserDefaults.

2. middleware.ts sees vuriumbook_auth (if web login happened previously) or
   nothing (if first launch after expiration). Two sub-cases:

   2a. If role cookie exists → middleware passes through to /dashboard.
       ├─ Shell.tsx calls /api/auth/me with stale bearer
       ├─ Backend returns 401 because JWT is expired
       ├─ lib/api.ts 401 handler:
       │   ├─ localStorage.removeItem('VURIUMBOOK_TOKEN')
       │   ├─ clearAuthCookie() — clears all 3 cookies WITH Secure flag
       │   └─ webkit.messageHandlers.logout.postMessage('logout')
       │       └─ Swift handler removes vurium_auth_token + vurium_user_json
       │          from UserDefaults
       ├─ Redirect to /signin
       ├─ /signin loads — middleware now has no cookies → allows through
       └─ Swift page-load restore script reads UserDefaults → empty → no-op
       → User sees signin form. Loop is dead.

   2b. If no role cookie at all → middleware immediately redirects to /signin.
       Same as 2a from step "/signin loads" onwards.
```

## What breaks if you don't respect this contract

Concrete failure modes observed in production on 2026-04-14:

| Mistake | Symptom |
|---|---|
| Dropping `vuriumbook_auth` fallback from `middleware.ts` | Every iOS user with only the legacy cookie is redirected to `/signin` immediately on cold start, even though they are logged in. Looks like a black screen because the redirect fires before any UI paints. |
| `clearAuthCookie` without `Secure` flag over HTTPS | Safari and WKWebView silently ignore the delete. Cookies persist across the redirect, middleware keeps letting the request through, loop. |
| Forgetting `postMessage('logout')` in the teardown path | Web clears its own state, but Swift restores the token from `UserDefaults` on the next page load via the restore script, loop. |
| Renaming `vuriumbook_token` on the backend | iOS wrapper sends a cookie the backend no longer recognises, every request looks unauthenticated, total app outage. |
| Renaming `vurium_auth_token` in `UserDefaults` | Native and web stop agreeing, session restoration stops working, users are forced to sign in on every cold start. |

---

## Future cleanup (not urgent)

Once the native iOS app can be rebuilt and resubmitted to the App Store:

1. Swift should set the canonical `VURIUMBOOK_TOKEN` cookie at cold start instead of `vuriumbook_auth`.
2. Swift should still set `vuriumbook_token` (the HttpOnly JWT bearer), because backend reads that name.
3. Once the oldest supported iOS app version uses the canonical name, `middleware.ts` and `lib/auth-cookie.ts` can drop the legacy `vuriumbook_auth` fallback — **not before**.
4. `UserDefaults` key names (`vurium_auth_token`) can stay as-is; they are private to the app and no web code reads them.

Until then: **the legacy fallback is load-bearing. Do not remove it.**

---

## Cross-references

- `middleware.ts` — the Next.js Edge middleware that reads the cookies
- `lib/auth-cookie.ts` — `setAuthCookie` / `clearAuthCookie` implementation
- `lib/api.ts` — the 401 handler that drives `clearAuthCookie` + `postMessage('logout')`
- `components/Shell.tsx` — the client-side bootstrap, localStorage → cookie fallback, `redirectToSignIn`
- `backend/index.js` — `getTokenFromReq` (the only place the backend reads the JWT cookie name)
- `VuriumWebView.swift` — shipped iOS bundle, read-only from the web repo's perspective
- [[DevLog/2026-04-15]] — post-mortem of the three hotfixes that created this contract
- [[Decision-Log]] DECISION-006 — the architectural decision to keep the legacy cookie alive
