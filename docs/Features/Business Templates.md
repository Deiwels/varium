# Business Templates

> Part of [[Home]] > Features | See also: [[Onboarding Wizard]], [[Booking System]]

## Overview
Pre-filled service templates used in the [[Onboarding Wizard]] Step 3. Located in `lib/onboarding-templates.ts`.

## Templates by Business Type

### Barbershop
| Service | Duration | Price |
|---------|----------|-------|
| Haircut | 30 min | $25 |
| Beard Trim | 20 min | $15 |
| Haircut + Beard | 45 min | $35 |
| Kids Haircut | 20 min | $20 |
| Hot Towel Shave | 30 min | $30 |
| Lineup / Edge Up | 15 min | $10 |

### Hair Salon
| Service | Duration | Price |
|---------|----------|-------|
| Women's Haircut | 45 min | $50 |
| Men's Haircut | 30 min | $30 |
| Blowout | 30 min | $35 |
| Color (Full) | 90 min | $120 |
| Highlights | 120 min | $150 |
| Deep Conditioning | 20 min | $25 |

### Nail Studio
| Service | Duration | Price |
|---------|----------|-------|
| Classic Manicure | 30 min | $25 |
| Gel Manicure | 45 min | $40 |
| Classic Pedicure | 45 min | $35 |
| Gel Pedicure | 60 min | $55 |
| Nail Art (per nail) | 10 min | $5 |
| Polish Change | 15 min | $15 |

### Beauty Salon
| Service | Duration | Price |
|---------|----------|-------|
| Facial | 60 min | $75 |
| Waxing (Eyebrows) | 15 min | $15 |
| Waxing (Full Leg) | 45 min | $50 |
| Makeup Application | 60 min | $80 |
| Threading | 15 min | $12 |

### Spa & Wellness
| Service | Duration | Price |
|---------|----------|-------|
| Swedish Massage (60min) | 60 min | $80 |
| Deep Tissue Massage (60min) | 60 min | $100 |
| Hot Stone Massage | 75 min | $120 |
| Body Scrub | 45 min | $60 |
| Aromatherapy Add-On | 15 min | $20 |

### Tattoo Studio
| Service | Duration | Price |
|---------|----------|-------|
| Small Tattoo | 60 min | $100 |
| Medium Tattoo | 120 min | $250 |
| Large Tattoo | 240 min | $500 |
| Consultation | 30 min | Free |
| Touch-Up | 30 min | $50 |
| Piercing | 15 min | $30 |

### Lash & Brow Bar
| Service | Duration | Price |
|---------|----------|-------|
| Classic Lash Extensions | 90 min | $120 |
| Volume Lash Extensions | 120 min | $180 |
| Lash Fill | 60 min | $65 |
| Brow Lamination | 45 min | $50 |
| Brow Tint | 20 min | $20 |
| Lash Lift + Tint | 60 min | $75 |

## Default Fallback
For unrecognized business types:
| Service | Duration | Price |
|---------|----------|-------|
| Standard Service | 30 min | $30 |
| Premium Service | 60 min | $60 |
| Quick Service | 15 min | $15 |

## Data Structure
```typescript
interface ServiceTemplate {
  name: string
  duration_minutes: number
  price_cents: number          // in cents (2500 = $25)
  service_type: 'primary' | 'addon'
}
```
