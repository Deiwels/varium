# Staff Requests & Job Applications

> Part of [[Home]] > Features | See also: [[Role Permissions]], [[Calendar & Scheduling]], [[Push Notifications]]

## Staff Requests

### Overview
Staff can request schedule changes or profile updates. Owners review and approve/reject. Approved changes auto-apply.

### Request Types
- `schedule_change` — request different working hours
- `profile_change` — request photo/name/about update
- Other custom request types

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/requests` | List requests (filterable by status, type) |
| POST | `/api/requests` | Create request |
| PATCH | `/api/requests/:id` | Review: approve or reject |

### Workflow
1. Staff submits request → `status: 'pending'`
2. Owner gets push notification (type: `request`)
3. Owner reviews in `/messages?tab=requests`
4. **Approve** → auto-applies changes:
   - Schedule change: creates schedule override on barber
   - Profile change: updates barber photo/name/about
5. **Reject** → staff gets push notification
6. Both: reviewer name + timestamp recorded

## Job Applications

### Overview
Public job application pipeline. Candidates apply via careers page, owners manage hiring workflow.

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/applications` | List applications (filterable by status, type) |
| PATCH | `/api/applications/:id` | Update status + notes |
| DELETE | `/api/applications/:id` | Delete application |

### Status Pipeline
`new` → `reviewed` → `interview` → `hired` | `rejected`

### Frontend
- `/careers` page — public application form
- Applications managed in dashboard/settings

### Firestore
- Collection: `workspaces/{wsId}/applications`
- Fields: name, email, phone, type, status, notes, reviewer, created_at
