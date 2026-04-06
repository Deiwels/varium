/** Dynamic terminology based on business type */

const TERMINOLOGY: Record<string, { singular: string; plural: string }> = {
  'Barbershop':      { singular: 'Barber',     plural: 'Barbers' },
  'Hair Salon':      { singular: 'Stylist',    plural: 'Stylists' },
  'Nail Studio':     { singular: 'Master',     plural: 'Masters' },
  'Beauty Salon':    { singular: 'Master',     plural: 'Masters' },
  'Spa & Wellness':  { singular: 'Specialist', plural: 'Specialists' },
  'Tattoo Studio':   { singular: 'Artist',     plural: 'Artists' },
  'Lash & Brow Bar': { singular: 'Master',     plural: 'Masters' },
}

const FALLBACK = { singular: 'Specialist', plural: 'Specialists' }

export function getStaffLabel(businessType: string | undefined | null, plural = false): string {
  const t = TERMINOLOGY[businessType || ''] || FALLBACK
  return plural ? t.plural : t.singular
}

export function getStaffLabels(businessType: string | undefined | null): { singular: string; plural: string } {
  return TERMINOLOGY[businessType || ''] || FALLBACK
}
