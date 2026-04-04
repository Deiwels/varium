/** Shared timezone utilities for signup & settings */

export function getTimezoneList(): { value: string; label: string }[] {
  let zones: string[]
  try {
    zones = (Intl as any).supportedValuesOf('timeZone')
  } catch {
    zones = [
      'America/Chicago', 'America/New_York', 'America/Los_Angeles',
      'America/Denver', 'America/Phoenix', 'America/Anchorage',
      'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Kyiv',
      'Europe/Moscow', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai',
      'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
    ]
  }

  const now = Date.now()
  const entries = zones.map(tz => {
    let offset = ''
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now)
      const tzPart = parts.find(p => p.type === 'timeZoneName')
      offset = tzPart?.value || ''
    } catch { /* skip */ }

    // Normalize "GMT" → "UTC", "GMT+5" → "UTC+05:00"
    let label = tz
    if (offset) {
      let norm = offset.replace('GMT', 'UTC')
      if (norm === 'UTC') norm = 'UTC+00:00'
      else {
        const m = norm.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/)
        if (m) norm = `UTC${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`
      }
      label = `(${norm}) ${tz}`
    }

    // Numeric offset for sorting
    let num = 0
    const nm = label.match(/UTC([+-])(\d{2}):(\d{2})/)
    if (nm) num = (nm[1] === '-' ? -1 : 1) * (parseInt(nm[2]) * 60 + parseInt(nm[3]))

    return { value: tz, label, _offset: num }
  })

  entries.sort((a, b) => a._offset - b._offset || a.value.localeCompare(b.value))
  return entries.map(({ value, label }) => ({ value, label }))
}

export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
  } catch {
    return 'America/Chicago'
  }
}
