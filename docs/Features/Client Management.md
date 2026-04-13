# Client Management

> Part of [[Home]] > Features | See also: [[Booking System]], [[Database Schema]], [[API Routes]]

## Overview
CRM-like client tracking with booking history and phone verification.

## Endpoints
- `GET /api/clients` — list clients
- `POST /api/clients` — create client
- `GET /api/clients/:id` — client details
- `PATCH /api/clients/:id` — update client
- `DELETE /api/clients/:id` — delete client
- `GET /api/clients/:id/history` — booking history
- `POST /api/clients/request-phone` — phone verification

## Key Behavior
- Clients are classified by **phone number**, not just name (recent fix)
- Phone verification via Telnyx SMS

## Frontend
- `/clients` — client list & management page

## Related
- [[Booking System]] — clients created during booking flow
- [[Payments]] — payment history per client
