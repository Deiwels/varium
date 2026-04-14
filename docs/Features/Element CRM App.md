# Element CRM App

> Part of [[Home]] > Features | See also: [[iOS App]], [[Push Notifications]], [[Auth Flow]]

## Overview
Standalone iOS app for **Element Barbershop** (Buffalo Grove, IL). Hybrid WKWebView wrapper around elementbarber.com CRM dashboard. NOT a white-label VuriumBook — it's a separate barbershop-specific app.

- **Bundle ID**: `com.elementbarbershop.Element`
- **App Name**: Element Team / ELEMENT CRM
- **Source**: `~/Desktop/untitled folder/Element/`
- **Backend API**: `https://element-crm-api-431945333485.us-central1.run.app`
- **Web URL**: `https://elementbarber.com/dashboard`

## File Structure
```
Element/
├── Element Team.xcodeproj
├── Element Crm IOS/
│   ├── ElementApp.swift       — SwiftUI @main entry + AppDelegate
│   ├── CRMWebView.swift       — WKWebView wrapper + JS bridge
│   ├── LoginView.swift        — Native login UI + biometrics
│   ├── Element.entitlements   — APS push notifications
│   └── Assets.xcassets/       — App icons, Element logo
```

## Native Features
- **Push Notifications** — messages, bookings, attendance, waitlist, requests
- **Biometric Auth** — Face ID / Touch ID via Keychain (`com.elementbarbershop.crm`)
- **Offline Fallback** — shows business info (phone, address, hours) when offline
- **Dark Mode** — enforced black theme, iOS blue accent

## Push Notification Types
| Type | Deep Link |
|------|-----------|
| `message` | `/messages?tab={chatType}` |
| `booking` | `/calendar` |
| `request` | `/messages?tab=requests` |
| `attendance` | `/attendance` |
| `waitlist` | `/waitlist` |

## Auth Flow
1. Email/password → `/api/auth/login` → JWT token
2. Token stored in UserDefaults (`crm_auth_token`) + Keychain
3. Biometric login retrieves Keychain credentials
4. Web ↔ native token sync via localStorage (`ELEMENT_TOKEN`)

## Relationship to VuriumBook
- Separate app, separate backend, separate domain
- Similar architecture (WKWebView + push + biometrics)
- Both hosted on Google Cloud Run
- No shared code or data
