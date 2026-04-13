export interface ServiceTemplate {
  name: string
  duration_minutes: number
  price_cents: number
  service_type: 'primary' | 'addon'
}

export const BUSINESS_TEMPLATES: Record<string, ServiceTemplate[]> = {
  'Barbershop': [
    { name: 'Haircut', duration_minutes: 30, price_cents: 2500, service_type: 'primary' },
    { name: 'Beard Trim', duration_minutes: 20, price_cents: 1500, service_type: 'primary' },
    { name: 'Haircut + Beard', duration_minutes: 45, price_cents: 3500, service_type: 'primary' },
    { name: 'Kids Haircut', duration_minutes: 20, price_cents: 2000, service_type: 'primary' },
    { name: 'Hot Towel Shave', duration_minutes: 30, price_cents: 3000, service_type: 'addon' },
    { name: 'Lineup / Edge Up', duration_minutes: 15, price_cents: 1000, service_type: 'addon' },
  ],
  'Hair Salon': [
    { name: 'Women\'s Haircut', duration_minutes: 45, price_cents: 5000, service_type: 'primary' },
    { name: 'Men\'s Haircut', duration_minutes: 30, price_cents: 3000, service_type: 'primary' },
    { name: 'Blowout', duration_minutes: 30, price_cents: 3500, service_type: 'primary' },
    { name: 'Color (Full)', duration_minutes: 90, price_cents: 12000, service_type: 'primary' },
    { name: 'Highlights', duration_minutes: 120, price_cents: 15000, service_type: 'primary' },
    { name: 'Deep Conditioning', duration_minutes: 20, price_cents: 2500, service_type: 'addon' },
  ],
  'Nail Studio': [
    { name: 'Classic Manicure', duration_minutes: 30, price_cents: 2500, service_type: 'primary' },
    { name: 'Gel Manicure', duration_minutes: 45, price_cents: 4000, service_type: 'primary' },
    { name: 'Classic Pedicure', duration_minutes: 45, price_cents: 3500, service_type: 'primary' },
    { name: 'Gel Pedicure', duration_minutes: 60, price_cents: 5500, service_type: 'primary' },
    { name: 'Nail Art (per nail)', duration_minutes: 10, price_cents: 500, service_type: 'addon' },
    { name: 'Polish Change', duration_minutes: 15, price_cents: 1500, service_type: 'addon' },
  ],
  'Beauty Salon': [
    { name: 'Facial', duration_minutes: 60, price_cents: 7500, service_type: 'primary' },
    { name: 'Waxing (Eyebrows)', duration_minutes: 15, price_cents: 1500, service_type: 'primary' },
    { name: 'Waxing (Full Leg)', duration_minutes: 45, price_cents: 5000, service_type: 'primary' },
    { name: 'Makeup Application', duration_minutes: 60, price_cents: 8000, service_type: 'primary' },
    { name: 'Threading', duration_minutes: 15, price_cents: 1200, service_type: 'addon' },
  ],
  'Spa & Wellness': [
    { name: 'Swedish Massage (60min)', duration_minutes: 60, price_cents: 8000, service_type: 'primary' },
    { name: 'Deep Tissue Massage (60min)', duration_minutes: 60, price_cents: 10000, service_type: 'primary' },
    { name: 'Hot Stone Massage', duration_minutes: 75, price_cents: 12000, service_type: 'primary' },
    { name: 'Body Scrub', duration_minutes: 45, price_cents: 6000, service_type: 'primary' },
    { name: 'Aromatherapy Add-On', duration_minutes: 15, price_cents: 2000, service_type: 'addon' },
  ],
  'Tattoo Studio': [
    { name: 'Small Tattoo', duration_minutes: 60, price_cents: 10000, service_type: 'primary' },
    { name: 'Medium Tattoo', duration_minutes: 120, price_cents: 25000, service_type: 'primary' },
    { name: 'Large Tattoo', duration_minutes: 240, price_cents: 50000, service_type: 'primary' },
    { name: 'Consultation', duration_minutes: 30, price_cents: 0, service_type: 'primary' },
    { name: 'Touch-Up', duration_minutes: 30, price_cents: 5000, service_type: 'addon' },
    { name: 'Piercing', duration_minutes: 15, price_cents: 3000, service_type: 'addon' },
  ],
  'Lash & Brow Bar': [
    { name: 'Classic Lash Extensions', duration_minutes: 90, price_cents: 12000, service_type: 'primary' },
    { name: 'Volume Lash Extensions', duration_minutes: 120, price_cents: 18000, service_type: 'primary' },
    { name: 'Lash Fill', duration_minutes: 60, price_cents: 6500, service_type: 'primary' },
    { name: 'Brow Lamination', duration_minutes: 45, price_cents: 5000, service_type: 'primary' },
    { name: 'Brow Tint', duration_minutes: 20, price_cents: 2000, service_type: 'addon' },
    { name: 'Lash Lift + Tint', duration_minutes: 60, price_cents: 7500, service_type: 'primary' },
  ],
}

export const DEFAULT_TEMPLATES: ServiceTemplate[] = [
  { name: 'Standard Service', duration_minutes: 30, price_cents: 3000, service_type: 'primary' },
  { name: 'Premium Service', duration_minutes: 60, price_cents: 6000, service_type: 'primary' },
  { name: 'Quick Service', duration_minutes: 15, price_cents: 1500, service_type: 'primary' },
]
