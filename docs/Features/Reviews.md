# Reviews

> Part of [[Home]] > Features | See also: [[Booking System]], [[Client Management]], [[API Routes]]

## Overview
Review management with moderation workflow, Google review integration, bulk import, and post-visit satisfaction ping (email + SMS).

## Frontend

### Dashboard (`/dashboard`)
- Reviews section with barber filter tabs
- Inline review creation form
- Moderation: approve / reject / delete pending reviews
- Star rating display (1-5)
- Shows up to 50 approved reviews

### Settings (`/settings`)
- **Post-visit review requests** toggle (`satisfaction_sms_enabled`)
- **Google review URL** input (`google_review_url`)
- **Public website Reviews section** toggle (in `site_config.sections_enabled`)
- Custom HTML template variables: `{{#each reviews}}`, `{{reviewer_name}}`, `{{rating}}`, `{{stars}}`, `{{review_text}}`

## Data Model

```
{
  client_name / name,
  rating: 1-5,
  text: string (max 2000 chars, sanitized HTML),
  barber_id, barber_name,
  status: 'pending' | 'approved' | 'rejected',
  source: 'crm' | 'google' | 'website',
  created_at, updated_at
}
```

## Status Workflow
1. New review -> `status: 'pending'`
2. Owner/Admin approves -> `status: 'approved'` (visible publicly)
3. Owner/Admin rejects -> `status: 'rejected'`
4. Public display shows only approved reviews

## API Endpoints

### Authenticated
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/reviews` | List all reviews (max 200, newest first) |
| POST | `/api/reviews` | Create review |
| PATCH | `/api/reviews/:id` | Update status/text (owner/admin) |
| DELETE | `/api/reviews/:id` | Delete review (owner/admin) |
| POST | `/api/reviews/import` | Bulk import up to 500 (owner only, source: 'google') |

### Public
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/public/reviews/:wsId` | Approved reviews + average rating |
| POST | `/public/reviews/:wsId` | Customer review submission (status: pending) |

## Satisfaction Ping (Post-Visit)
Triggered after booking completion via `scheduleSatisfactionPing()`:

1. **Email** — sent immediately after visit
   - Interactive star rating links
   - "Leave a Google Review" button (if `google_review_url` set)
   - Falls back to internal review link

2. **SMS** — sent 2 hours after visit
   - Includes Google review URL
   - Only if phone number + review URL available
   - Stored in `sms_reminders` with `type: 'satisfaction'`
   - Dedup check prevents duplicate reminders

## Google Review Import
- `POST /api/reviews/import` — bulk import up to 500 reviews
- Auto-sets `source: 'google'`, `status: 'approved'`
- Accepts: `name`, `rating`, `text`, `ts`/`createdAt`, `barber_id`/`barber_name`

## Firestore
- Collection: `workspaces/{wsId}/reviews`
- Settings: `satisfaction_sms_enabled`, `google_review_url`
- Related: `sms_reminders` (satisfaction type)
