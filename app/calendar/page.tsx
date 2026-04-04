'use client'
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import Shell from '@/components/Shell'
const BookingModal = dynamic(() => import('@/app/calendar/booking-modal').then(m => m.BookingModal), { ssr: false })
const ImageCropper = dynamic(() => import('@/components/ImageCropper'), { ssr: false })

import { apiFetch, API } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Barber {
  id: string; name: string; level?: string; photo?: string; color: string
  about?: string; basePrice?: string; publicRole?: string
  radarLabels?: string[]; radarValues?: number[]; username?: string
  schedule?: any; work_schedule?: any
}
interface Service {
  id: string; name: string; durationMin: number; price?: string; barberIds: string[]; service_type?: string
}
interface CalEvent {
  id: string; type?: 'booking' | 'block'; barberId: string; barberName: string
  clientName: string; clientPhone: string; serviceId: string; serviceIds?: string[]; serviceName: string
  date: string; startMin: number; durMin: number; status: string
  paid: boolean; paymentMethod?: string; notes?: string; tipAmount?: number; _raw: any
}
interface ModalState { open: boolean; eventId: string | null; isNew: boolean }
interface DaySchedule { enabled: boolean; startMin: number; endMin: number }

// ─── Constants ────────────────────────────────────────────────────────────────
const slotH_DEFAULT = 11
const START_HOUR = 0
const END_HOUR = 24
const COL_MIN = 190
const BARBER_COLORS = ['#99d100','rgba(180,140,220,.8)','rgba(255,255,255,.7)','#ffb000','rgba(220,130,160,.8)','rgba(130,200,220,.8)','#ff6b6b']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_DEFAULTS: DaySchedule[] = [
  { enabled: false, startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
  { enabled: true,  startMin: 10*60, endMin: 20*60 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0')
const minToHHMM = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
// Detect device 12h/24h preference (cached)
const _is24h = (() => { try { const f = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions(); return f.hourCycle === 'h23' || f.hourCycle === 'h24' } catch { return false } })()
const minToAMPM = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60
  if (_is24h) return `${pad2(h)}:${pad2(m)}`
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12} ${period}` : `${h12}:${pad2(m)} ${period}`
}
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
// Timezone-aware helpers
let _calTz = 'America/Chicago'
function tzHourMin(d: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: _calTz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const obj: Record<string, string> = {}; parts.forEach(p => { obj[p.type] = p.value })
  return { h: Number(obj.hour || 0), m: Number(obj.minute || 0) }
}
function tzMinOfDay(d: Date): number { const t = tzHourMin(d); return t.h * 60 + t.m }
const uid = () => 'e_' + Math.random().toString(16).slice(2)
const clamp = (min: number) => Math.max(START_HOUR * 60, Math.min(min, END_HOUR * 60 - 5))
const timeStrToMin = (s: string) => { const [h,m] = s.split(':').map(Number); return (h||0)*60+(m||0) }
const minToTimeStr = (min: number) => `${pad2(Math.floor(min/60))}:${pad2(min%60)}`


// ─── Status Chip ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  paid:      { border: 'rgba(143,240,177,.40)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  booked:    { border: 'rgba(255,255,255,.10)',  bg: 'rgba(255,255,255,.04)',  color: 'rgba(130,150,220,.6)' },
  arrived:   { border: 'rgba(143,240,177,.40)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  done:      { border: 'rgba(255,207,63,.40)',  bg: 'rgba(255,207,63,.08)',  color: 'rgba(220,190,130,.5)' },
  noshow:    { border: 'rgba(255,107,107,.40)', bg: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)' },
  cancelled: { border: 'rgba(255,107,107,.30)', bg: 'rgba(255,107,107,.07)', color: 'rgba(220,130,160,.5)' },
  model:     { border: 'rgba(168,107,255,.40)', bg: 'rgba(168,107,255,.10)', color: 'rgba(180,140,220,.6)' },
}
function Chip({ label, type }: { label: string; type: string }) {
  const s = STATUS_COLORS[type] || STATUS_COLORS.booked
  return <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, border: `1px solid ${s.border}`, background: s.bg, color: s.color, whiteSpace: 'nowrap' as const }}>{label}</span>
}

// ─── DatePickerModal ──────────────────────────────────────────────────────────
function DatePickerModal({ current, onSelect, onClose }: {
  current: Date; onSelect: (d: Date) => void; onClose: () => void
}) {
  const [month, setMonth] = useState(() => { const d = new Date(current); d.setDate(1); d.setHours(0,0,0,0); return d })
  const today = new Date(); today.setHours(0,0,0,0)
  const offset = (month.getDay() + 6) % 7
  const start = new Date(month); start.setDate(1 - offset)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
  const btn: React.CSSProperties = { height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.40)', color: 'rgba(255,255,255,.70)', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }
  return (
    <div className="cal-picker-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.70)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cal-picker-card" style={{ width: 'min(400px,100%)', borderRadius: 22, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(2,2,6,.95)', padding: 16, color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 -8px 60px rgba(0,0,0,.70)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()-1); setMonth(m) }} style={{ height: 30, width: 30, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 12 }}>&lsaquo;</button>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()+1); setMonth(m) }} style={{ height: 30, width: 30, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 12 }}>&rsaquo;</button>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,.80)' }}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
          <button onClick={() => { const t = new Date(); t.setDate(1); t.setHours(0,0,0,0); setMonth(t) }} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit' }}>Today</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth()
            const isToday = +d === +today
            const isSel = d.toDateString() === current.toDateString()
            return <button key={i} onClick={() => { onSelect(d); onClose() }} style={{ ...btn, opacity: inMonth ? 1 : 0.2, borderColor: isSel ? 'rgba(255,255,255,.30)' : isToday ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,.04)', background: isSel ? 'rgba(255,255,255,.12)' : isToday ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.30)', color: isSel ? '#fff' : isToday ? 'rgba(255,255,255,.90)' : 'rgba(255,255,255,.50)' }}>{d.getDate()}</button>
          })}
        </div>
      </div>
    </div>
  )
}

// ─── SchedGrid ────────────────────────────────────────────────────────────────
function SchedGrid({ schedule, onChange }: { schedule: DaySchedule[]; onChange: (s: DaySchedule[]) => void }) {
  function toggle(i: number) { const n = [...schedule]; n[i] = { ...n[i], enabled: !n[i].enabled }; onChange(n) }
  function setTime(i: number, field: 'startMin'|'endMin', val: string) { const n = [...schedule]; n[i] = { ...n[i], [field]: timeStrToMin(val) }; onChange(n) }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, margin: '6px auto' }}>
      {DAY_NAMES.map((name, i) => {
        const day = schedule[i]
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, border: `1px solid ${day.enabled ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.10)'}`, borderRadius: 10, padding: '5px 4px', background: day.enabled ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.18)', opacity: day.enabled ? 1 : 0.55 }}>
            <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'center', fontWeight: 900, color: 'rgba(255,255,255,.60)' }}>{name}</div>
            <button onClick={() => toggle(i)} style={{ height: 22, borderRadius: 999, border: `1px solid ${day.enabled ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.16)'}`, background: day.enabled ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.05)', color: day.enabled ? 'rgba(130,150,220,.6)' : '#fff', cursor: 'pointer', fontSize: 8, textTransform: 'uppercase', fontWeight: 900, fontFamily: 'inherit', width: '100%' }}>{day.enabled ? 'ON' : 'OFF'}</button>
            <div style={{ opacity: day.enabled ? 1 : 0.3, pointerEvents: day.enabled ? 'auto' : 'none' }}>
              <input type="time" value={minToTimeStr(day.startMin)} onChange={e => setTime(i,'startMin',e.target.value)} style={{ height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', color: '#fff', padding: '0 3px', fontSize: 9, outline: 'none', width: '100%', colorScheme: 'dark' as any }} />
              <input type="time" value={minToTimeStr(day.endMin)} onChange={e => setTime(i,'endMin',e.target.value)} style={{ height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', color: '#fff', padding: '0 3px', fontSize: 9, outline: 'none', width: '100%', colorScheme: 'dark' as any, marginTop: 2 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── RadarEditor ─────────────────────────────────────────────────────────────
function RadarEditor({ labelsStr, valuesStr, onLabelsChange, onValuesChange }: {
  labelsStr: string; valuesStr: string; onLabelsChange: (s: string) => void; onValuesChange: (s: string) => void
}) {
  const labels = labelsStr.split(',').map(s => s.trim()).filter(Boolean)
  const values = valuesStr.split(',').map(s => { const n = parseFloat(s.trim()); return isNaN(n) ? 0 : n })
  // Pad values to match labels length
  while (values.length < labels.length) values.push(0)

  const [editingIdx, setEditingIdx] = React.useState<number | null>(null)
  const [editText, setEditText] = React.useState('')

  function updateValue(idx: number, val: number) {
    const next = [...values]; next[idx] = val
    onValuesChange(next.slice(0, labels.length).join(','))
  }
  function updateLabel(idx: number, newLabel: string) {
    const next = [...labels]; next[idx] = newLabel || 'SKILL'
    onLabelsChange(next.join(','))
  }
  function removeSkill(idx: number) {
    const nl = labels.filter((_, i) => i !== idx)
    const nv = values.filter((_, i) => i !== idx)
    onLabelsChange(nl.join(',') || '')
    onValuesChange(nv.join(',') || '')
  }
  function addSkill() {
    onLabelsChange([...labels, 'NEW'].join(','))
    onValuesChange([...values, 3].join(','))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)' }}>
          {editingIdx === i ? (
            <input
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value.toUpperCase())}
              onBlur={() => { updateLabel(i, editText); setEditingIdx(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { updateLabel(i, editText); setEditingIdx(null) } }}
              style={{ width: 70, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', padding: '0 6px', outline: 'none', fontSize: 10, fontWeight: 900, letterSpacing: '.08em', fontFamily: 'inherit' }}
            />
          ) : (
            <span
              onClick={() => { setEditingIdx(i); setEditText(label) }}
              style={{ minWidth: 56, fontSize: 10, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', cursor: 'pointer', userSelect: 'none' }}
              title="Click to rename"
            >{label}</span>
          )}
          <input
            type="range"
            min={0} max={5} step={0.5}
            value={values[i] ?? 0}
            onChange={e => updateValue(i, parseFloat(e.target.value))}
            style={{ flex: 1, height: 4, accentColor: 'rgba(255,255,255,.7)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', minWidth: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(values[i] ?? 0).toFixed(1)}</span>
          <button
            onClick={() => removeSkill(i)}
            style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={addSkill}
        style={{ height: 30, borderRadius: 10, border: '1px dashed rgba(255,255,255,.16)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
      >+ Add skill</button>
    </div>
  )
}

// ─── BarberEditCard ───────────────────────────────────────────────────────────
function BarberEditCard({ b, onDelete, onSaved, onError, isBarberSelf }: {
  b: Barber; onDelete?: (id: string, name: string) => void
  onSaved: () => void; onError: (e: string) => void
  isBarberSelf?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [level, setLevel] = useState(b.level || '')
  const [price, setPrice] = useState(b.basePrice || '')
  const [about, setAbout] = useState(b.about || '')
  const [publicRole, setPublicRole] = useState(b.publicRole || '')
  const [radarLabels, setRadarLabels] = useState((b.radarLabels || ['SKILL 1','SKILL 2','SKILL 3','SKILL 4','SKILL 5']).join(','))
  const [radarValues, setRadarValues] = useState((b.radarValues || [4.5,4.5,4.5,4.5,4.5]).join(','))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [cropSrc, setCropSrc] = useState('')
  const [sched, setSched] = useState<DaySchedule[]>(() => {
    const raw = b.schedule || b.work_schedule
    // Per-day array format
    if (Array.isArray(raw) && raw.length === 7) {
      return raw.map((d: any) => ({ enabled: d.enabled !== false, startMin: Number(d.startMin ?? d.start_min ?? 600), endMin: Number(d.endMin ?? d.end_min ?? 1200) }))
    }
    // Object with perDay
    if (raw?.perDay && Array.isArray(raw.perDay) && raw.perDay.length === 7) {
      return raw.perDay.map((d: any) => ({ enabled: d.enabled !== false, startMin: Number(d.startMin ?? d.start_min ?? 600), endMin: Number(d.endMin ?? d.end_min ?? 1200) }))
    }
    // Legacy { startMin, endMin, days }
    if (raw?.days) {
      return Array.from({length: 7}, (_, i) => ({
        enabled: raw.days.includes(i),
        startMin: Number(raw.startMin ?? 600),
        endMin: Number(raw.endMin ?? 1200),
      }))
    }
    return DAY_DEFAULTS.map(d => ({...d}))
  })

  useEffect(() => {
    setLevel(b.level || ''); setPrice(b.basePrice || ''); setAbout(b.about || '')
    setPublicRole(b.publicRole || '')
    setRadarLabels((b.radarLabels || ['SKILL 1','SKILL 2','SKILL 3','SKILL 4','SKILL 5']).join(','))
    setRadarValues((b.radarValues || [4.5,4.5,4.5,4.5,4.5]).join(','))
    // Sync schedule from server data (b.schedule is 7-element array [Sun..Sat])
    if (b.schedule && b.schedule.length === 7) {
      setSched(b.schedule.map((d: any) => ({ enabled: !!d.enabled, startMin: Number(d.startMin) || 10*60, endMin: Number(d.endMin) || 20*60 })))
    } else {
      setSched(DAY_DEFAULTS.map(d => ({...d})))
    }
  }, [b.id])

  function handlePhoto(file: File | null) {
    if (!file) return; setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900, scale = Math.min(1, MAX/img.width, MAX/img.height)
        const w = Math.round(img.width*scale), h = Math.round(img.height*scale)
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        let q = 0.82, out = canvas.toDataURL('image/jpeg', q)
        while (out.length > 900000 && q > 0.35) { q -= 0.08; out = canvas.toDataURL('image/jpeg', q) }
        setCropSrc(out)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    try {
      const enabledDays = sched.map((d, i) => d.enabled ? i : -1).filter(i => i >= 0)
      const enabledScheds = sched.filter(d => d.enabled)
      const startMin = enabledScheds.length ? Math.min(...enabledScheds.map(d => d.startMin)) : 10*60
      const endMin   = enabledScheds.length ? Math.max(...enabledScheds.map(d => d.endMin))   : 20*60
      const perDay = sched.map(d => ({ enabled: d.enabled, startMin: d.startMin, endMin: d.endMin }))
      const schedPayload = { startMin, endMin, days: enabledDays, perDay }
      const rLabels = radarLabels.split(',').map(s => s.trim()).filter(Boolean)
      const rValues = radarValues.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
      const changes = { level, base_price: price, public_role: publicRole || level, about, description: about, bio: about, radar_labels: rLabels, radar_values: rValues, photo_url: photoPreview || b.photo || '', schedule: schedPayload, work_schedule: schedPayload, public_off_days: DAY_NAMES.filter((_,i) => !sched[i].enabled), public_enabled: true }

      if (isBarberSelf) {
        // Build readable schedule summary
        const schedSummary = sched.map((d, i) => d.enabled ? `${DAY_NAMES[i]} ${minToTimeStr(d.startMin)}–${minToTimeStr(d.endMin)}` : null).filter(Boolean)
        // Barber sends profile changes as request for approval
        await apiFetch('/api/requests', { method: 'POST', body: JSON.stringify({
          type: 'profile_change',
          data: { barberId: b.id, barberName: b.name, changes, scheduleSummary: schedSummary, workDays: DAY_NAMES.filter((_, i) => sched[i].enabled) }
        })})
      } else {
        // Owner/admin saves directly
        await apiFetch(`/api/barbers/${encodeURIComponent(b.id)}`, { method: 'PATCH', body: JSON.stringify(changes) })
      }
      setPhotoFile(null); setPhotoPreview(''); onSaved()
    } catch (e: any) { onError(e.message) }
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 4 }

  return (
    <div className="barber-edit-card" style={{ borderRadius: 16, border: `1px solid ${open ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.10)'}`, background: open ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.03)', transition: 'border-color .25s ease, box-shadow .25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {(photoPreview || b.photo)
            ? <img src={photoPreview || b.photo} alt={b.name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)', flexShrink: 0 }} onError={e => (e.currentTarget.style.display='none')} />
            : <div style={{ width: 44, height: 44, borderRadius: 12, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{b.name[0]}</div>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{b.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', letterSpacing: '.06em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {(() => {
                const lvl = (b.level || 'Team member').toLowerCase()
                const badgeColors = lvl.includes('ambassador')
                  ? { border: 'rgba(255,207,63,.45)', bg: 'rgba(255,207,63,.10)', color: 'rgba(220,190,130,.5)', shadow: '0 0 8px rgba(255,207,63,.20)' }
                  : lvl.includes('senior')
                  ? { border: 'rgba(255,255,255,.12)', bg: 'rgba(255,255,255,.04)', color: 'rgba(130,150,220,.6)', shadow: '0 0 8px rgba(255,255,255,.06)' }
                  : lvl.includes('expert')
                  ? { border: 'rgba(143,240,177,.45)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)', shadow: '0 0 8px rgba(143,240,177,.20)' }
                  : { border: 'rgba(255,255,255,.16)', bg: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.55)', shadow: 'none' }
                return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 900, border: `1px solid ${badgeColors.border}`, background: badgeColors.bg, color: badgeColors.color, boxShadow: badgeColors.shadow }}>{b.level || 'Team member'}</span>
              })()}
              {b.basePrice ? <span>· ${b.basePrice}</span> : null}
            </div>
            {b.about && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{b.about}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setOpen(v => !v)} style={{ height: 36, padding: '0 14px', borderRadius: 999, border: `1px solid ${open ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.14)'}`, background: open ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.05)', color: open ? 'rgba(130,150,220,.6)' : '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit' }}>{open ? 'Collapse' : 'Edit'}</button>
          {!isBarberSelf && onDelete && <button onClick={() => onDelete(b.id, b.name)} style={{ height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit' }}>Remove</button>}
        </div>
      </div>

      <div style={{ maxHeight: open ? 2000 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height .4s ease, opacity .3s ease' }}>
        <div style={{ padding: '0 14px 14px', borderTop: open ? '1px solid rgba(255,255,255,.08)' : '1px solid transparent', overflow: 'hidden' }}>
          <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: '100%' }}>
            {[['Level / Rank', level, setLevel, 'Senior / Expert'], ['Base price ($)', price, setPrice, '55.99'], ['Public role', publicRole, setPublicRole, 'Ambassador']].map(([lbText, val, setter, ph]) => (
              <div key={lbText as string}><label style={lbl}>{lbText as string}</label><input value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={ph as string} style={inp} /></div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>About / Bio</label>
              <textarea value={about} onChange={e => setAbout(e.target.value)} rows={3} placeholder="Precision fades. Clean silhouette. Premium finish..." style={{ ...inp, height: 'auto', padding: '10px', resize: 'vertical' as const, lineHeight: 1.5 }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Skill radar</label>
              <RadarEditor labelsStr={radarLabels} valuesStr={radarValues} onLabelsChange={setRadarLabels} onValuesChange={setRadarValues} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Photo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ height: 38, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: 'inherit' }}>
                  {photoFile ? photoFile.name : 'Change photo…'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e.target.files?.[0] || null)} />
                </label>
                {(photoPreview || b.photo) && <img src={photoPreview || b.photo} alt="" style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }} onError={e => (e.currentTarget.style.display='none')} />}
                {photoPreview && <button onClick={() => { setPhotoFile(null); setPhotoPreview('') }} style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={lbl}>Working schedule</label>
            <SchedGrid schedule={sched} onChange={setSched} />
          </div>
          <button onClick={save} disabled={saving} style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.04)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', marginTop: 12 }}>
            {saving ? 'Saving…' : isBarberSelf ? 'Send for approval' : 'Save changes — update on website'}
          </button>
        </div>
      </div>
      {cropSrc && <ImageCropper src={cropSrc} onSave={(url) => { setPhotoPreview(url); setCropSrc('') }} onClose={() => setCropSrc('')} />}
    </div>
  )
}

// ─── SettingsModal ────────────────────────────────────────────────────────────
function SettingsModal({ barbers, services, onClose, onReload, isStudent, isBarber, myBarberId, studentSchedule, onStudentScheduleChange }: {
  barbers: Barber[]; services: any[]; onClose: () => void; onReload: () => void
  isStudent?: boolean; isBarber?: boolean; myBarberId?: string
  studentSchedule?: DaySchedule[]; onStudentScheduleChange?: (s: DaySchedule[]) => void
}) {
  const _isOwnerOrAdmin = !isStudent && !isBarber
  const [tab, setTab] = useState<'team'|'services'>(isStudent ? 'team' : 'team')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Barber form
  const [bName, setBName] = useState(''); const [bLevel, setBLevel] = useState('')
  const [bUsername, setBUsername] = useState(''); const [bPassword, setBPassword] = useState('')
  const [bPrice, setBPrice] = useState(''); const [bAbout, setBAbout] = useState('')
  const [bPublicRole, setBPublicRole] = useState('')
  const [bRadarLabels, setBRadarLabels] = useState('SKILL 1,SKILL 2,SKILL 3,SKILL 4,SKILL 5')
  const [bRadarValues, setBRadarValues] = useState('4.5,4.5,4.5,4.5,4.5')
  const [bPhotoPreview, setBPhotoPreview] = useState('')
  const [bSchedule, setBSchedule] = useState<DaySchedule[]>(DAY_DEFAULTS.map(d => ({...d})))

  // Service form
  const [sName, setSName] = useState(''); const [sDur, setSDur] = useState('30')
  const [sPrice, setSPrice] = useState(''); const [sBarber, setSBarber] = useState('')
  const [editSvcId, setEditSvcId] = useState<string | null>(null)
  const [sBarbers, setSBarbers] = useState<string[]>([]) // multi-barber selection
  const [sType, setSType] = useState<'primary' | 'addon'>('primary')

  async function addBarber() {
    if (!bName.trim()) { setMsg('Name required'); return }
    setSaving(true); setMsg('')
    try {
      const enabledDays = bSchedule.map((d, i) => d.enabled ? i : -1).filter(i => i >= 0)
      const schedPayload = { startMin: 10*60, endMin: 20*60, days: enabledDays, perDay: bSchedule }
      await apiFetch('/api/barbers', { method: 'POST', body: JSON.stringify({
        name: bName.trim(), level: bLevel.trim() || undefined,
        public_role: bPublicRole.trim() || bLevel.trim() || undefined,
        photo_url: bPhotoPreview || '', active: true,
        schedule: schedPayload, work_schedule: schedPayload,
        public_off_days: DAY_NAMES.filter((_, i) => !bSchedule[i].enabled)
      })})
      setMsg('Team member added ✓ — now visible on booking page')
      setBName(''); setBLevel(''); setBPublicRole(''); setBPhotoPreview('')
      setBSchedule(DAY_DEFAULTS.map(d => ({...d}))); onReload()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  async function deleteBarber(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return
    try { await apiFetch(`/api/barbers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }); setMsg('Team member removed'); onReload() }
    catch (e: any) { setMsg('Error: ' + e.message) }
  }

  async function addService() {
    if (!sName.trim()) { setMsg('Service name required'); return }
    setSaving(true); setMsg('')
    try {
      const price_cents = Math.round(parseFloat(sPrice || '0') * 100)
      // Always create new service — same name can exist for different barbers/prices
      await apiFetch('/api/services', { method: 'POST', body: JSON.stringify({ name: sName.trim(), duration_minutes: Number(sDur), price_cents, version: '1', barber_ids: sBarbers, service_type: sType }) })
      setMsg('Service added ✓'); setSName(''); setSDur('30'); setSPrice(''); setSBarbers([]); setSType('primary'); onReload()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 4 }
  const tabs = (isStudent ? ['team'] : ['team','services']) as ('team'|'services')[]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 'clamp(8px,2vw,16px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(480px,100%)', maxWidth: 'calc(100vw - 24px)', height: 'min(560px,calc(100dvh - 48px))', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.55), inset 0 0 0 0.5px rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.04em', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>Settings</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '14px 18px 0' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${tab === t ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.09)'}`, background: tab === t ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.03)', color: tab === t ? '#fff' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'inherit', transition: 'all .25s ease', boxShadow: 'none' }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '16px 18px 20px', flex: 1, overflowY: 'auto' }}>
          {msg && <div style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', fontSize: 12, color: '#e8e8ed', marginBottom: 14 }}>{msg}</div>}

          {/* Barbers tab */}
          {tab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>{isBarber ? 'My profile' : `Team members (${barbers.length})`}</div>
                {(isBarber ? barbers.filter(b => b.id === myBarberId) : barbers).map(b => (
                  <BarberEditCard key={b.id} b={b} onDelete={isBarber ? undefined as any : deleteBarber} isBarberSelf={isBarber}
                    onSaved={() => { setMsg(isBarber ? 'Changes sent for approval ✓' : 'Saved ✓ — updated on website'); onReload() }}
                    onError={(e: string) => setMsg('Error: ' + e)} />
                ))}
              </div>

              {/* Add team member form — show always for now, plan gating via backend */}
              {!isBarber && <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 12 }}>Add to team</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['Name *', bName, setBName, 'Jane Smith'], ['Level', bLevel, setBLevel, 'Senior'], ['Public role', bPublicRole, setBPublicRole, 'Stylist']].map(([l, v, s, p]) => (
                    <div key={l as string}><label style={lbl}>{l as string}</label><input value={v as string} onChange={e => (s as any)(e.target.value)} placeholder={p as string} style={inp} /></div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Photo</label>
                    <label style={{ height: 42, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 13, fontFamily: 'inherit', gap: 8, transition: 'border-color .2s' }}>
                      {bPhotoPreview ? <img src={bPhotoPreview} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                      {bPhotoPreview ? 'Change photo' : 'Upload photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]; if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          const img = new Image()
                          img.onload = () => {
                            const MAX = 600, scale = Math.min(1, MAX/img.width, MAX/img.height)
                            const w = Math.round(img.width*scale), h = Math.round(img.height*scale)
                            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
                            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                            setBPhotoPreview(canvas.toDataURL('image/jpeg', 0.8))
                          }
                          img.src = reader.result as string
                        }
                        reader.readAsDataURL(file)
                      }} />
                    </label>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Working schedule</label>
                    <SchedGrid schedule={bSchedule} onChange={setBSchedule} />
                  </div>
                </div>
                <button onClick={addBarber} disabled={saving} style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', marginTop: 12 }}>
                  {saving ? 'Saving…' : '+ Add team member'}
                </button>
              </div>}
            </div>
          )}

          {/* Services tab */}
          {tab === 'services' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {(isBarber ? services.filter(s => !s.barberIds.length || s.barberIds.includes(myBarberId || '')) : services).map(s => {
                  const assignedBarbers = barbers.filter(b => s.barberIds.includes(b.id))
                  const isEditing = editSvcId === s.id
                  return (
                    <div key={s.id} style={{ borderRadius: 12, border: `1px solid ${isEditing ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,.07)'}`, background: 'rgba(255,255,255,.03)', overflow: 'hidden' }}>
                      {/* Service row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, border: `1px solid ${s.service_type === 'addon' ? 'rgba(255,207,63,.35)' : 'rgba(255,255,255,.08)'}`, background: s.service_type === 'addon' ? 'rgba(255,207,63,.12)' : 'rgba(255,255,255,.04)', color: s.service_type === 'addon' ? 'rgba(220,190,130,.5)' : 'rgba(130,150,220,.6)' }}>{s.service_type === 'addon' ? 'Add-on' : 'Primary'}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 2 }}>
                            {s.durationMin}min{s.price ? ` · $${s.price}` : ''}
                          </div>
                          {/* Barbers assigned */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                            {assignedBarbers.length === 0
                              ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', letterSpacing: '.06em' }}>All team members</span>
                              : assignedBarbers.map(b => (
                                <span key={b.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.65)' }}>{b.name}</span>
                              ))
                            }
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => {
                            if (isEditing) { setEditSvcId(null); return }
                            setEditSvcId(s.id)
                            setSName(s.name)
                            setSDur(String(s.durationMin))
                            setSPrice(s.price || '')
                            setSBarbers(s.barberIds)
                            setSType(s.service_type === 'addon' ? 'addon' : 'primary')
                          }} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: isEditing ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                          {!isBarber && <button onClick={async () => { if (!confirm(`Delete ${s.name}?`)) return; try { await apiFetch(`/api/services/${encodeURIComponent(s.id)}`, { method: 'DELETE' }); setMsg('Deleted'); onReload() } catch (e: any) { setMsg('Error: ' + e.message) } }} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>✕</button>}
                        </div>
                      </div>
                      {/* Edit form inline */}
                      {isEditing && (
                        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Name</label><input value={sName} onChange={e => setSName(e.target.value)} style={inp} /></div>
                            <div><label style={lbl}>Duration (min)</label><input type="number" value={sDur} onChange={e => setSDur(e.target.value)} style={inp} /></div>
                            <div><label style={lbl}>Price ($)</label><input value={sPrice} onChange={e => setSPrice(e.target.value)} style={inp} /></div>
                          </div>
                          {/* Barbers checkboxes — owner/admin only */}
                          {/* Service type toggle */}
                          {!isBarber && <div style={{ marginTop: 10 }}>
                            <label style={lbl}>Service type</label>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              {(['primary', 'addon'] as const).map(t => (
                                <button key={t} onClick={() => setSType(t)}
                                  style={{ height: 30, padding: '0 12px', borderRadius: 999, border: `1px solid ${sType === t ? (t === 'addon' ? 'rgba(255,207,63,.40)' : 'rgba(255,255,255,.10)') : 'rgba(255,255,255,.10)'}`, background: sType === t ? (t === 'addon' ? 'rgba(255,207,63,.12)' : 'rgba(255,255,255,.04)') : 'rgba(255,255,255,.03)', color: sType === t ? (t === 'addon' ? 'rgba(220,190,130,.5)' : 'rgba(130,150,220,.6)') : 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all .2s' }}>
                                  {t === 'primary' ? 'Primary' : 'Add-on'}
                                </button>
                              ))}
                            </div>
                          </div>}
                          {!isBarber && <div style={{ marginTop: 10 }}>
                            <label style={lbl}>Assigned team members</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {barbers.map(b => {
                                const on = sBarbers.includes(b.id)
                                return (
                                  <button key={b.id} onClick={() => setSBarbers(prev => on ? prev.filter(x => x !== b.id) : [...prev, b.id])}
                                    style={{ height: 30, padding: '0 10px', borderRadius: 999, border: `1px solid ${on ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'}`, background: on ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.03)', color: on ? '#fff' : 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                                    {b.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>}
                          <button onClick={async () => {
                            setSaving(true)
                            try {
                              const price_cents = sPrice ? Math.round(parseFloat(sPrice) * 100) : 0
                              const changes = { name: sName.trim(), duration_minutes: Number(sDur), price_cents, barber_ids: sBarbers, service_type: sType }
                              if (isBarber) {
                                // Barber sends service change as request
                                await apiFetch('/api/requests', { method: 'POST', body: JSON.stringify({ type: 'service_change', data: { serviceId: s.id, serviceName: s.name, changes } }) })
                                setMsg('Service change request sent for approval ✓'); setEditSvcId(null)
                              } else {
                                await apiFetch(`/api/services/${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify(changes) })
                                setMsg('Saved'); setEditSvcId(null); onReload()
                              }
                            } catch (e: any) { setMsg('Error: ' + e.message) }
                            setSaving(false)
                          }} disabled={saving} style={{ width: '100%', height: 38, borderRadius: 10, border: `1px solid ${isBarber ? 'rgba(168,107,255,.40)' : 'rgba(255,255,255,.20)'}`, background: isBarber ? 'rgba(168,107,255,.10)' : 'rgba(255,255,255,.08)', color: isBarber ? 'rgba(180,140,220,.6)' : '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit', marginTop: 10 }}>
                            {saving ? 'Saving…' : isBarber ? 'Send for approval' : 'Save changes'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {!isBarber && <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 10 }}>Add new service</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Service name</label><input value={editSvcId ? '' : sName} onChange={e => setSName(e.target.value)} placeholder="Fade" style={inp} /></div>
                  <div><label style={lbl}>Duration (min)</label><input type="number" value={editSvcId ? '30' : sDur} onChange={e => setSDur(e.target.value)} placeholder="30" style={inp} /></div>
                  <div><label style={lbl}>Price ($)</label><input value={editSvcId ? '' : sPrice} onChange={e => setSPrice(e.target.value)} placeholder="35" style={inp} /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Service type</label>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {(['primary', 'addon'] as const).map(t => (
                        <button key={t} onClick={() => { if (!editSvcId) setSType(t) }}
                          style={{ height: 30, padding: '0 12px', borderRadius: 999, border: `1px solid ${!editSvcId && sType === t ? (t === 'addon' ? 'rgba(255,207,63,.40)' : 'rgba(255,255,255,.10)') : 'rgba(255,255,255,.10)'}`, background: !editSvcId && sType === t ? (t === 'addon' ? 'rgba(255,207,63,.12)' : 'rgba(255,255,255,.04)') : 'rgba(255,255,255,.03)', color: !editSvcId && sType === t ? (t === 'addon' ? 'rgba(220,190,130,.5)' : 'rgba(130,150,220,.6)') : 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', opacity: editSvcId ? 0.4 : 1, transition: 'all .2s' }}>
                          {t === 'primary' ? 'Primary' : 'Add-on'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Assign barbers</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {barbers.map(b => {
                        const on = !editSvcId && sBarbers.includes(b.id)
                        return (
                          <button key={b.id} onClick={() => { if (editSvcId) return; setSBarbers(prev => on ? prev.filter(x => x !== b.id) : [...prev, b.id]) }}
                            style={{ height: 30, padding: '0 10px', borderRadius: 999, border: `1px solid ${on ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'}`, background: on ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.03)', color: on ? '#fff' : 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                            {b.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <button onClick={addService} disabled={saving || !!editSvcId} style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.04)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: editSvcId ? 0.4 : 1 }}>
                  {saving ? 'Saving…' : '+ Add service'}
                </button>
              </div>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [studentUsers, setStudentUsers] = useState<{ id: string; name: string; mentorIds: string[] }[]>([])
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([])
  const [wlConfirm, setWlConfirm] = useState<{ w: any; barberId: string; barberName: string; slotMin: number; dur: number } | null>(null)
  const [wlConfirming, setWlConfirming] = useState(false)
  const [search, setSearch] = useState('')
  const [slotH, setSlotH] = useState(slotH_DEFAULT)
  const [isMobile, setIsMobile] = useState(false) // mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [modal, setModal] = useState<ModalState>({ open: false, eventId: null, isNew: false })
  const [nowMin, setNowMin] = useState(0)
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<{ eventId: string; offsetMin: number; ghostBarberIdx: number; ghostMin: number } | null>(null)
  const [dragConfirm, setDragConfirm] = useState<{ eventId: string; newBarberId: string; newBarberName: string; newMin: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // Retry finding the portal target — Shell may render after Calendar
    const find = () => {
      const el = document.getElementById('topbar-center')
      if (el) { setPortalTarget(el); return true }
      return false
    }
    if (find()) return
    const interval = setInterval(() => { if (find()) clearInterval(interval) }, 100)
    return () => clearInterval(interval)
  }, [])
  const [dayTransition, setDayTransition] = useState<'idle' | 'out' | 'in'>('idle')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; barberId: string; min: number } | null>(null)
  const [blockDrag, setBlockDrag] = useState<{ barberId: string; barberIdx: number; startMin: number; endMin: number } | null>(null)
  const blockDragRef = useRef<{ barberId: string; barberIdx: number; startMin: number; endMin: number } | null>(null)
  const blockDragJustEnded = useRef(false)
  const blockLongPressTimer = useRef<any>(null)
  const eventLongPressTimer = useRef<any>(null)
  // Persist arrived IDs in localStorage so they survive reload (cleared when paid)
  const ARRIVED_KEY = 'VB_ARRIVED_IDS'
  const arrivedIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    try { arrivedIdsRef.current = new Set(JSON.parse(localStorage.getItem(ARRIVED_KEY) || '[]')) } catch {}
  }, [])
  function saveArrivedIds() {
    try { localStorage.setItem(ARRIVED_KEY, JSON.stringify([...arrivedIdsRef.current])) } catch {}
  }
  function markArrived(id: string) { arrivedIdsRef.current.add(id); saveArrivedIds() }
  function clearArrived(id: string) { arrivedIdsRef.current.delete(id); saveArrivedIds() }
  const [trainingModal, setTrainingModal] = useState<{ barberId: string; barberName: string; min: number } | null>(null)
  const [toast, setToast] = useState('')
  // Block modals
  const [blockModal, setBlockModal] = useState<{ type: 'create' | 'resize_confirm' | 'owner_resize'; barberId: string; startMin: number; currentDur: number; originalDur: number; evId?: string; rawId?: string } | null>(null)
  const [blockConfirm, setBlockConfirm] = useState<{ action: 'create' | 'delete'; barberId: string; startMin: number; endMin: number; evId?: string; rawId?: string } | null>(null)
  const [blockDurInput, setBlockDurInput] = useState('30')
  // Pending block requests (loaded from /api/requests)
  const [pendingBlockRequests, setPendingBlockRequests] = useState<any[]>([])
  const [slotPicker, setSlotPicker] = useState<{ min: number; mentorId: string; mentorName: string }[] | null>(null)
  const [touchIndicator, setTouchIndicator] = useState<{ min: number; y: number } | null>(null)
  const touchColRef = useRef<{ barberId: string; barberIdx: number; colEl: HTMLElement | null; startX: number; startY: number; active: boolean; moveHandler: ((e: TouchEvent) => void) | null; endHandler: (() => void) | null }>({ barberId: '', barberIdx: 0, colEl: null, startX: 0, startY: 0, active: false, moveHandler: null, endHandler: null })
  const touchDelayTimer = useRef<any>(null)
  const [mobilePage, setMobilePage] = useState(0)
  const BARBERS_PER_PAGE = 2
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null)
  const toastTimer = useRef<any>(null)
  const showToast = useCallback((msg: string) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3500) }, [])
  const colRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Pinch zoom
  const lastPinchDist = useRef(0)
  const onPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDist.current = Math.sqrt(dx*dx + dy*dy)
    }
  }
  const onPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current
        setSlotH(prev => Math.round(Math.max(3, Math.min(22, prev * scale))))
      }
      lastPinchDist.current = dist
    }
  }
  const onPinchEnd = () => { lastPinchDist.current = 0 }

  // Work hours per barber: { barberId -> { startMin, endMin } }
  // Default: 10:00–20:00 if no schedule loaded
  const [workHours, setWorkHours] = useState<Record<string, { startMin: number; endMin: number }>>({})
  const offResize = useRef<{ barberId: string; type: 'top' | 'bottom'; startY: number; origMin: number } | null>(null)
  const hasScrolledRef = useRef(false)
  const prevAnchorRef = useRef<string>('')
  const [scheduleConfirm, setScheduleConfirm] = useState<{ barberId: string; barberName: string; dow: number; startMin: number; endMin: number } | null>(null)

  // Student schedule state
  const [studentSchedule, setStudentSchedule] = useState<DaySchedule[]>(() => {
    try { const s = localStorage.getItem('VB_STUDENT_SCHEDULE'); if (s) return JSON.parse(s) } catch {}
    return DAY_DEFAULTS.map(d => ({...d}))
  })
  // Build workHours from barber schedule every time barbers or date changes
  // Note: _isStudent computed inline to avoid block-scope ordering issues
  const _isStudent = (() => { try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}')?.role === 'student' } catch { return false } })()

  useEffect(() => {
    if (!barbers.length && !_isStudent) return
    // dow = 0=Sun,1=Mon..6=Sat — matches how schedule.days[] is stored on server
    const dow = anchor.getDay() // anchor is Date object, 0=Sun..6=Sat
    const next: Record<string, { startMin: number; endMin: number; dayOff: boolean }> = {}
    barbers.forEach(b => {
      // Check one-time override for this specific date first
      const dateKey = isoDate(anchor)
      const override = (b as any).schedule_overrides?.[dateKey]
      if (override) {
        next[b.id] = override.enabled === false
          ? { startMin: 0, endMin: 0, dayOff: true }
          : { startMin: Number(override.startMin || 600), endMin: Number(override.endMin || 1200), dayOff: false }
        return
      }
      // Normal permanent schedule
      const sched = b.schedule
      if (!sched) {
        next[b.id] = { startMin: 0, endMin: END_HOUR * 60, dayOff: false }
        return
      }
      const day = sched[dow]
      if (!day) {
        next[b.id] = { startMin: 0, endMin: END_HOUR * 60, dayOff: false }
      } else if (!day.enabled) {
        next[b.id] = { startMin: 0, endMin: 0, dayOff: true }
      } else {
        next[b.id] = { startMin: day.startMin, endMin: day.endMin, dayOff: false }
      }
    })
    // Student column work hours
    if (_isStudent && studentSchedule.length === 7) {
      const day = studentSchedule[dow]
      if (!day || !day.enabled) {
        next['__student__'] = { startMin: 0, endMin: 0, dayOff: true }
      } else {
        next['__student__'] = { startMin: day.startMin, endMin: day.endMin, dayOff: false }
      }
    }
    setWorkHours(next as any)
  }, [barbers, anchor, _isStudent, studentSchedule])

  // Scroll to current time or work start — runs after barbers load
  useEffect(() => {
    if (!barbers.length) return
    const anchorStr = isoDate(anchor)
    // Reset scroll flag when anchor date changes (user navigated to a different day)
    if (prevAnchorRef.current && prevAnchorRef.current !== anchorStr) {
      hasScrolledRef.current = false
    }
    prevAnchorRef.current = anchorStr
    // Only scroll once per anchor date
    if (hasScrolledRef.current) return
    const container = scrollContainerRef.current
    if (!container) return
    const now = new Date()
    const today = isoDate(now)
    const currentMin = tzMinOfDay(now)
    // Find earliest work start across visible barbers
    let earliestWorkStart = 8 * 60 // fallback
    for (const b of barbers) {
      const wh = (workHours as any)[b.id]
      if (wh && !wh.dayOff && wh.startMin < earliestWorkStart) earliestWorkStart = wh.startMin
    }
    // If today → scroll to current time (30% from top)
    // If another day → scroll to work start
    const scrollMin = anchorStr === today ? currentMin : earliestWorkStart
    const y = ((scrollMin - START_HOUR * 60) / 5) * slotH
    const offset = Math.max(0, y - container.clientHeight * 0.3)
    requestAnimationFrame(() => { container.scrollTop = offset })
    hasScrolledRef.current = true
  }, [barbers, anchor, workHours])

  // Off-block resize handlers
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!offResize.current) return
      // Prevent page scroll while resizing on touch devices
      if ('touches' in e) e.preventDefault()
      const { barberId, type, startY, origMin } = offResize.current
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const dy = clientY - startY
      const dMin = Math.round(dy / slotH) * 5
      setWorkHours(prev => {
        const cur = prev[barberId] || { startMin: 10*60, endMin: 20*60 }
        if (type === 'top') {
          const newStart = Math.max(START_HOUR*60, Math.min(cur.endMin - 30, origMin + dMin))
          return { ...prev, [barberId]: { ...cur, startMin: newStart } }
        } else {
          const newEnd = Math.max(cur.startMin + 30, Math.min(END_HOUR*60, origMin + dMin))
          return { ...prev, [barberId]: { ...cur, endMin: newEnd } }
        }
      })
    }
    function onUp() {
      if (!offResize.current) return
      const { barberId } = offResize.current
      offResize.current = null
      const wh = (workHours as any)[barberId]
      if (!wh || wh.dayOff) return
      const barber = barbers.find(b => b.id === barberId)
      if (!barber) return
      const dow = anchor.getDay()
      // Show confirm dialog before saving
      setScheduleConfirm({ barberId, barberName: barber.name, dow, startMin: wh.startMin, endMin: wh.endMin })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [workHours])

  const [currentUser, setCurrentUser] = useState<{ role: string; barber_id?: string; mentor_barber_ids?: string[]; uid?: string; name?: string; username?: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null') } catch { return null }
  })
  // Re-read user from localStorage when Shell updates it (barber_id might arrive late)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const fresh = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null')
        if (fresh?.barber_id && fresh.barber_id !== currentUser?.barber_id) {
          setCurrentUser(fresh)
        }
      } catch {}
    }, 1500)
    return () => clearInterval(interval)
  }, [currentUser?.barber_id])
  const isBarber = currentUser?.role === 'barber'
  const isStudent = currentUser?.role === 'student'
  const isOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin'
  const myBarberId = currentUser?.barber_id || ''
  const mentorBarberIds: string[] = currentUser?.mentor_barber_ids || []
  const [terminalEnabled, setTerminalEnabled] = useState(false)

  // Check if Square or Stripe is connected (for showing Terminal button)
  useEffect(() => {
    if (!isOwnerOrAdmin) return
    Promise.all([
      apiFetch('/api/square/oauth/status').catch(() => ({ connected: false })),
      apiFetch('/api/stripe-connect/status').catch(() => ({ connected: false })),
    ]).then(([sq, st]) => {
      setTerminalEnabled(sq?.connected || st?.connected || false)
    })
  }, [isOwnerOrAdmin])

  // Load student schedule from API on mount
  useEffect(() => {
    if (!isStudent) return
    ;(async () => {
      try {
        const data = await apiFetch('/api/auth/me')
        const sched = data?.user?.schedule
        if (Array.isArray(sched) && sched.length === 7) {
          setStudentSchedule(sched)
          localStorage.setItem('VB_STUDENT_SCHEDULE', JSON.stringify(sched))
        }
      } catch {}
    })()
  }, [isStudent])

  // Barber sees only their own column
  // Student sees ONE column with their name (availability computed from mentors)
  const myBarberObj = isBarber ? barbers.find(b => b.id === myBarberId) : null
  const studentColumn: Barber | null = isStudent ? {
    id: '__student__', name: currentUser?.name || currentUser?.username || 'My Schedule',
    color: 'rgba(180,140,220,.8)', schedule: undefined,
  } : null
  const visibleBarbers = useMemo(() => isStudent
    ? (studentColumn ? [studentColumn] : [])
    : isBarber
      ? (myBarberObj ? [myBarberObj] : barbers)
      : barbers, [isStudent, studentColumn, isBarber, myBarberObj, barbers])
  const totalPages = Math.ceil(visibleBarbers.length / BARBERS_PER_PAGE)

  // Animated day change — gravity lens effect
  function animateDayChange(delta: number) {
    if (dayTransition !== 'idle') return
    setDayTransition('out')
    setTimeout(() => {
      setAnchor(a => { const x = new Date(a); x.setDate(x.getDate() + delta); return x })
      setDayTransition('in')
      setTimeout(() => setDayTransition('idle'), 220)
    }, 180)
  }

  // Swipe handler for mobile — always changes day for everyone
  useEffect(() => {
    if (!isMobile) return
    const el = scrollContainerRef.current; if (!el) return
    function onTouchStart(e: TouchEvent) {
      const x = e.touches[0].clientX
      // Ignore if starting from left edge (sidebar swipe area)
      if (x < 40) { swipeRef.current = null; return }
      swipeRef.current = { startX: x, startY: e.touches[0].clientY }
    }
    function onTouchEnd(e: TouchEvent) {
      if (!swipeRef.current) return
      // Don't swipe calendar if sidebar is being swiped or drag is active
      if (document.body.getAttribute('data-sidebar-swiping') === '1') { swipeRef.current = null; return }
      if (document.body.getAttribute('data-dragging') === '1') { swipeRef.current = null; return }
      const dx = e.changedTouches[0].clientX - swipeRef.current.startX
      const dy = e.changedTouches[0].clientY - swipeRef.current.startY
      swipeRef.current = null
      // Ignore swipe if started from left edge (sidebar area)
      if (swipeRef.current === null && e.changedTouches[0].clientX < 50 && dx > 0) return
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return
      animateDayChange(dx < 0 ? 1 : -1)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchend', onTouchEnd) }
  }, [isMobile, dayTransition])

  const todayStr = isoDate(anchor)

  // ── Student: compute blocked slots from mentor schedules + bookings ──
  const mentorBarbers = isStudent ? barbers.filter(b => mentorBarberIds.includes(b.id)) : []

  // For each 5-min slot: which mentor(s) are free?
  const studentSlotMentorMap = React.useMemo(() => {
    if (!isStudent || !mentorBarbers.length) return new Map<number, string>()
    const map = new Map<number, string>()
    const dow = anchor.getDay()
    const mentorEvents = events.filter(e => e.date === todayStr && mentorBarberIds.includes(e.barberId) && e.status !== 'cancelled')

    for (let m = 0; m < END_HOUR * 60; m += 5) {
      for (const mb of mentorBarbers) {
        // Check if mentor works this slot
        const wh = (workHours as any)[mb.id]
        if (!wh || wh.dayOff) continue
        if (m < wh.startMin || m >= wh.endMin) continue
        // Check if mentor has a booking at this slot
        const busy = mentorEvents.some(e => e.barberId === mb.id && m >= e.startMin && m < e.startMin + e.durMin)
        if (!busy) { map.set(m, mb.id); break } // first free mentor wins
      }
    }
    return map
  }, [isStudent, mentorBarbers.length, mentorBarberIds.join(','), events, todayStr, workHours, anchor.getTime()])

  // Blocked ranges: consecutive slots where no mentor is free
  const studentBlockedRanges = React.useMemo(() => {
    if (!isStudent || !mentorBarbers.length) return [] as { startMin: number; endMin: number }[]
    const ranges: { startMin: number; endMin: number }[] = []
    let rangeStart = -1
    for (let m = 0; m < END_HOUR * 60; m += 5) {
      if (!studentSlotMentorMap.has(m)) {
        if (rangeStart < 0) rangeStart = m
      } else {
        if (rangeStart >= 0) { ranges.push({ startMin: rangeStart, endMin: m }); rangeStart = -1 }
      }
    }
    if (rangeStart >= 0) ranges.push({ startMin: rangeStart, endMin: END_HOUR * 60 })
    return ranges
  }, [isStudent, studentSlotMentorMap])

  const selectedEvent = events.find(e => e.id === modal.eventId) || null

  useEffect(() => {
    const tick = () => { setNowMin(tzMinOfDay(new Date())) }
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t)
  }, [])

  // Per-day schedule overrides stored in localStorage
  // Key: 'sched_override_<barberId>' = {dow: {startMin, endMin}, ...}
  function getSchedOverrides(barberId: string): Record<number, { startMin: number; endMin: number }> {
    try { return JSON.parse(localStorage.getItem('sched_override_' + barberId) || '{}') } catch { return {} }
  }
  function saveSchedOverride(barberId: string, dow: number, startMin: number, endMin: number) {
    const cur = getSchedOverrides(barberId)
    cur[dow] = { startMin, endMin }
    localStorage.setItem('sched_override_' + barberId, JSON.stringify(cur))
  }

  const loadBarbers = useCallback(async () => {
    const data = await apiFetch('/api/barbers')
    const list = Array.isArray(data) ? data : (data?.barbers || [])
    return list.map((b: any, i: number) => {
      // Extract work hours from any schedule format the API returns
      const rawSched = b.schedule || b.work_schedule
      let parsedSchedule: { enabled: boolean; startMin: number; endMin: number }[] | undefined

      if (rawSched) {
        if (Array.isArray(rawSched)) {
          // Format: array of day objects
          parsedSchedule = rawSched.map((d: any) => ({
            enabled: !!d.enabled,
            startMin: Number(d.startMin ?? d.start_min ?? 10*60),
            endMin: Number(d.endMin ?? d.end_min ?? 20*60),
          }))
        } else if (typeof rawSched === 'object') {
          if (Array.isArray(rawSched.perDay)) {
            // Format: { startMin, endMin, perDay: [...] }
            parsedSchedule = rawSched.perDay.map((d: any) => ({
              enabled: !!d.enabled,
              startMin: Number(d.startMin ?? d.start_min ?? 10*60),
              endMin: Number(d.endMin ?? d.end_min ?? 20*60),
            }))
          } else if (rawSched.startMin !== undefined || rawSched.start_min !== undefined) {
            // Format: { startMin, endMin, days:[0,1,2,3,4,5,6] } — server normalizeSchedule output
            const sm = Number(rawSched.startMin ?? rawSched.start_min ?? 10*60)
            const em = Number(rawSched.endMin ?? rawSched.end_min ?? 20*60)
            // days[] contains JS getDay() indices of WORKING days (0=Sun..6=Sat)
            const workDays: number[] = Array.isArray(rawSched.days)
              ? rawSched.days.map(Number)
              : [1,2,3,4,5,6] // default Mon-Sat if no days specified
            parsedSchedule = Array.from({ length: 7 }, (_, i) => ({
              enabled: workDays.includes(i), // use server data, not hardcoded!
              startMin: sm,
              endMin: em,
            }))
          }
        }
      }

      // Apply per-day localStorage overrides on top of server schedule
      let finalSchedule = parsedSchedule
      if (finalSchedule) {
        const overrides = getSchedOverrides(String(b.id || ''))
        if (Object.keys(overrides).length > 0) {
          finalSchedule = finalSchedule.map((day, dow) => {
            const ov = overrides[dow]
            return ov ? { ...day, startMin: ov.startMin, endMin: ov.endMin } : day
          })
        }
      }

      return {
        id: String(b.id || ''), name: String(b.name || '').trim(),
        level: String(b.level || '').trim(), photo: String(b.photo_url || b.photo || '').trim(),
        color: BARBER_COLORS[i % BARBER_COLORS.length],
        about: String(b.about || b.description || '').trim(),
        basePrice: String(b.base_price || '').trim(),
        publicRole: String(b.public_role || '').trim(),
        radarLabels: Array.isArray(b.radar_labels) ? b.radar_labels : ['SKILL 1','SKILL 2','SKILL 3','SKILL 4','SKILL 5'],
        radarValues: Array.isArray(b.radar_values) ? b.radar_values.map(Number) : [4.5,4.5,4.5,4.5,4.5],
        username: String(b.username || '').trim(),
        schedule: finalSchedule,
        schedule_overrides: b.schedule_overrides || {},
      }
    }).filter((b: Barber) => b.id && b.name)
  }, [])

  const loadServices = useCallback(async () => {
    const data = await apiFetch('/api/services')
    const list = Array.isArray(data?.services) ? data.services : Array.isArray(data) ? data : []
    return list.map((s: any) => {
      const durMin = s.duration_minutes || Math.round((s.durationMs || 0) / 60000) || 30
      const price = s.price ?? (s.price_cents > 0 ? (s.price_cents / 100).toFixed(2) : '')
      return { id: String(s.id || ''), name: String(s.name || ''), durationMin: Math.max(1, durMin), price: String(price), barberIds: (s.barber_ids || s.barberIds || []).map(String), service_type: String(s.service_type || 'primary') }
    }).filter((s: Service) => s.name)
  }, [])

  const loadBookings = useCallback(async (barbersArg: Barber[], servicesArg: Service[]) => {
    // Build UTC range that covers the full local day (Chicago UTC-6 / UTC-5)
    // Expand by ±1 day to catch bookings near midnight boundaries
    const anchorDate = new Date(todayStr + 'T00:00:00')
    const dayBefore = new Date(anchorDate); dayBefore.setDate(dayBefore.getDate() - 1)
    const dayAfter  = new Date(anchorDate); dayAfter.setDate(dayAfter.getDate() + 2)
    const fromIso = dayBefore.toISOString()
    const toIso   = dayAfter.toISOString()
    const data = await apiFetch(`/api/bookings?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
    const list = Array.isArray(data?.bookings) ? data.bookings : Array.isArray(data) ? data : []
    return list.map((b: any) => {
      const startAt = b.start_at ? new Date(b.start_at) : null
      // Use LOCAL time for startMin and date — not UTC slice
      const startMin = startAt ? tzMinOfDay(startAt) : 10*60
      const localDate = startAt ? isoDate(startAt) : todayStr
      const isBlock = b.status === 'block' || b.type === 'block' || b.booking_type === 'block' || b.client_name === 'BLOCKED'
      const isModelOrTraining = b.booking_type === 'model' || b.booking_type === 'training'
      let rawServiceIds: string[] = (Array.isArray(b.service_ids) && b.service_ids.length > 0) ? b.service_ids.map(String) : b.service_id ? String(b.service_id).split(',').map((s: string) => s.trim()).filter(Boolean) : []
      let svcs = servicesArg.filter(s => rawServiceIds.includes(s.id))
      // Fallback: if only 1 service found but service_name has " + ", resolve by name
      if (svcs.length <= 1 && b.service_name && String(b.service_name).includes(' + ')) {
        const names = String(b.service_name).split(' + ').map((n: string) => n.trim().toLowerCase())
        const byName = names.map(n => servicesArg.find(s => s.name.toLowerCase() === n)).filter(Boolean) as typeof servicesArg
        if (byName.length > 1) {
          svcs = byName
          rawServiceIds = byName.map(s => s.id)
        }
      }
      const svc = svcs[0] || servicesArg.find(s => s.id === String(b.service_id || ''))
      const barber = barbersArg.find(br => br.id === String(b.barber_id || ''))
      // Duration: prefer end_at - start_at (handles multi-service), fallback to duration_minutes, then service durations sum
      const svcDurMin = svcs.length > 0 ? svcs.reduce((sum, s) => sum + (s.durationMin || 30), 0) : (svc?.durationMin || 30)
      const endAtTime = b.end_at ? new Date(b.end_at).getTime() : 0
      const startAtTime = startAt ? startAt.getTime() : 0
      const calcFromEndAt = (endAtTime && startAtTime && endAtTime > startAtTime) ? Math.round((endAtTime - startAtTime) / 60000) : 0
      const durMin = (isBlock || isModelOrTraining)
        ? (calcFromEndAt || 90)
        : (calcFromEndAt || Number(b.duration_minutes || 0) || svcDurMin)
      const svcName = svcs.length > 1 ? svcs.map(s => s.name).join(' + ') : (svc?.name || String(b.service_name || b.notes || 'Service'))
      return {
        id: String(b.id || uid()), type: isBlock ? 'block' as const : 'booking' as const,
        barberId: String(b.barber_id || ''), barberName: barber?.name || String(b.barber_name || b.barber || ''),
        clientName: String(b.client_name || 'Client'), clientPhone: String(b.client_phone || ''),
        serviceId: rawServiceIds[0] || String(b.service_id || ''), serviceIds: rawServiceIds, serviceName: svcName,
        date: localDate,
        startMin: clamp(startMin), durMin: Math.max(5, durMin),
        status: String(b.status || 'booked'), paid: !!(b.paid || b.is_paid),
        paymentMethod: String(b.payment_method || ''), notes: String(b.notes || ''),
        tipAmount: Number(b.tip || 0), _raw: b,
      } as CalEvent
    })
  }, [todayStr])

  // Load student users (for showing badges on barber headers)
  const loadStudents = useCallback(async () => {
    if (isStudent) return
    try {
      // Try /api/users first (owner/admin), fallback to /api/users/students (barber)
      let users: any[] = []
      try {
        const data = await apiFetch('/api/users')
        users = Array.isArray(data?.users) ? data.users : []
      } catch {
        // Barber may not have access to /api/users — try students endpoint
        try {
          const data = await apiFetch('/api/users/students')
          users = Array.isArray(data?.students) ? data.students : []
        } catch { /* no access */ }
      }
      setStudentUsers(users.filter((u: any) => u.role === 'student' && u.active !== false).map((u: any) => ({
        id: u.id, name: u.name || u.username || '', mentorIds: Array.isArray(u.mentor_barber_ids) ? u.mentor_barber_ids : []
      })))
    } catch { /* ignore */ }
  }, [isOwnerOrAdmin])

  const loadWaitlist = useCallback(async () => {
    if (!isOwnerOrAdmin) return
    try {
      const data = await apiFetch(`/api/waitlist?date=${todayStr}`)
      setWaitlistEntries(data?.waitlist || [])
    } catch { /* ignore */ }
  }, [isOwnerOrAdmin, todayStr])

  // Load pending block requests to show as breathing blocks
  const loadPendingBlocks = useCallback(async () => {
    try {
      const data = await apiFetch('/api/requests')
      const pending = (data?.requests || []).filter((r: any) => r.type === 'block_time' && r.status === 'pending' && (!r.data?.date || r.data.date === todayStr))
      setPendingBlockRequests(pending)
    } catch { /* ignore */ }
  }, [todayStr])

  const reloadAll = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([loadBarbers(), loadServices()])
      setBarbers(b); setServices(s)
      setEvents(await loadBookings(b, s))
      loadStudents()
      loadWaitlist()
      loadPendingBlocks()
    } catch(e) { console.warn(e) }
  }, [loadBarbers, loadServices, loadBookings, loadStudents, loadWaitlist, loadPendingBlocks])

  const isFirstLoad = useRef(true)
  useEffect(() => {
    // Only show full loading overlay on first load — subsequent date changes keep old data visible
    if (isFirstLoad.current) setLoading(true)
    // Load workspace timezone
    apiFetch('/api/settings/timezone').then(d => { if (d?.timezone) _calTz = d.timezone }).catch(() => {})
    // Fire all independent fetches in parallel
    const mainP = Promise.all([loadBarbers(), loadServices()])
    loadStudents(); loadWaitlist(); loadPendingBlocks()
    mainP.then(async ([b, s]) => {
      setBarbers(b); setServices(s)
      setEvents(await loadBookings(b, s)); setLoading(false); isFirstLoad.current = false
    }).catch(e => { console.warn(e); setLoading(false); isFirstLoad.current = false })
  }, [todayStr])

  // Poll bookings + pending blocks every 15s — PAUSE when modal is open
  useEffect(() => {
    if (modal.open) return // Don't poll while booking modal is open
    const interval = setInterval(() => {
      loadBookings(barbers, services).then(evs => setEvents(evs.map((e: any) => { if ((e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id)) clearArrived(e.id); return !(e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id) ? { ...e, status: 'arrived' } : e }))).catch(console.warn)
      loadPendingBlocks().catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [barbers, services, loadBookings, modal.open])

  const reload = useCallback(() => {
    loadBookings(barbers, services).then(evs => setEvents(evs.map((e: any) => { if ((e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id)) clearArrived(e.id); return !(e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id) ? { ...e, status: 'arrived' } : e }))).catch(console.warn)
  }, [barbers, services, loadBookings])

  const totalH = (END_HOUR - START_HOUR) * 12 * slotH
  const minToY = (min: number) => ((min - START_HOUR * 60) / 5) * slotH
  const nowY = minToY(nowMin)
  const isToday = (() => { const t = new Date(); return todayStr === isoDate(t) })()
  const showNow = isToday && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60

  const todayEvents = useMemo(() => events.filter(e => {
    if (e.date !== todayStr) return false
    if (e.status === 'cancelled') return false
    if (isBarber && myBarberId && e.type !== 'block' && e.barberId !== myBarberId) return false
    if (isStudent) return e._raw?.booking_type === 'model' || e._raw?.booking_type === 'training'
    return true
  }), [events, todayStr, isBarber, myBarberId, isStudent])
  const filtered = useMemo(() => search ? todayEvents.filter(e => [e.clientName, e.barberName, e.serviceName].join(' ').toLowerCase().includes(search.toLowerCase())) : todayEvents, [todayEvents, search])

  // ── Drag ──────────────────────────────────────────────────────────────────
  function startDrag(e: React.MouseEvent | React.TouchEvent, ev: CalEvent, barberIdx: number) {
    e.preventDefault(); e.stopPropagation()
    haptic()
    document.body.setAttribute('data-dragging', '1')
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    const col = colRefs.current[barberIdx]; if (!col) return
    const clickedMin = Math.round((clientY - col.getBoundingClientRect().top) / slotH) * 5 + START_HOUR * 60
    setDrag({ eventId: ev.id, offsetMin: clickedMin - ev.startMin, ghostBarberIdx: barberIdx, ghostMin: ev.startMin })
  }

  function onDragMove(e: MouseEvent | TouchEvent) {
    if (!drag) return
    // Prevent page scroll while dragging on touch devices
    if ('touches' in e) e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    let newBI = drag.ghostBarberIdx
    colRefs.current.forEach((col, i) => { if (!col) return; const r = col.getBoundingClientRect(); if (clientX >= r.left && clientX <= r.right) newBI = i })
    const col = colRefs.current[newBI]; if (!col) return
    const rawMin = Math.round((clientY - col.getBoundingClientRect().top) / slotH) * 5 + START_HOUR * 60 - drag.offsetMin
    setDrag(d => d ? { ...d, ghostBarberIdx: newBI, ghostMin: clamp(rawMin) } : d)
  }

  function onDragEnd() {
    if (!drag) return
    const ev = events.find(e => e.id === drag.eventId); if (!ev) { setDrag(null); return }
    const newBarber = visibleBarbers[drag.ghostBarberIdx]; if (!newBarber) { setDrag(null); return }
    // Only show move confirm if actually moved (different barber or time changed by at least 5min)
    const timeDiff = Math.abs(drag.ghostMin - ev.startMin)
    if (newBarber.id !== ev.barberId || timeDiff >= 5) {
      setDragConfirm({ eventId: ev.id, newBarberId: newBarber.id, newBarberName: newBarber.name, newMin: drag.ghostMin })
    }
    setDrag(null)
    // Keep data-dragging for 500ms to prevent swipe from triggering after drag confirm
    setTimeout(() => document.body.removeAttribute('data-dragging'), 500)
  }

  async function confirmDragMove() {
    if (!dragConfirm) return
    const ev = events.find(e => e.id === dragConfirm.eventId); if (!ev) { setDragConfirm(null); return }
    // Barbers cannot drag bookings to other barbers
    if (isBarber && dragConfirm.newBarberId !== ev.barberId) {
      showToast('Cannot move to another team member')
      setDragConfirm(null); return
    }
    const newBarber = barbers.find(b => b.id === dragConfirm.newBarberId)
    // Remap services to new barber's equivalent (by name) — updates price & duration
    let oldSvcIds = ev.serviceIds?.length ? ev.serviceIds : (ev.serviceId ? [ev.serviceId] : [])
    // If no service IDs, try to find by service name
    if (!oldSvcIds.length && ev.serviceName) {
      const byName = services.find(s => s.name === ev.serviceName && s.barberIds.includes(ev.barberId))
      if (byName) oldSvcIds = [byName.id]
    }
    const newBarberSvcs = services.filter(s => !s.barberIds.length || s.barberIds.includes(dragConfirm.newBarberId))
    let remappedSvcIds: string[] = []
    if (dragConfirm.newBarberId !== ev.barberId && oldSvcIds.length) {
      remappedSvcIds = oldSvcIds.map((id: string) => {
        if (newBarberSvcs.some(s => s.id === id)) return id
        const oldSvc = services.find(s => s.id === id)
        if (!oldSvc) return null
        const match = newBarberSvcs.find(s => s.name.toLowerCase() === oldSvc.name.toLowerCase())
        return match ? match.id : null
      }).filter(Boolean) as string[]
    } else {
      remappedSvcIds = oldSvcIds
    }
    const remappedSvcs = remappedSvcIds.map(id => services.find(s => s.id === id)).filter(Boolean)
    const newDurMin = remappedSvcs.length > 0 ? remappedSvcs.reduce((sum, s) => sum + (s!.durationMin || 30), 0) : ev.durMin
    const newSvcNames = remappedSvcs.length > 0 ? remappedSvcs.map(s => s!.name).join(' + ') : ev.serviceName
    const updated = { ...ev, barberId: dragConfirm.newBarberId, barberName: newBarber?.name || ev.barberName, startMin: dragConfirm.newMin, serviceIds: remappedSvcIds, serviceId: remappedSvcIds[0] || ev.serviceId, serviceName: newSvcNames, durMin: newDurMin }
    setEvents(prev => prev.map((e: any) => e.id === ev.id ? updated : e)); setDragConfirm(null)
    if (ev._raw?.id) {
      try {
        const startAt = new Date(updated.date + 'T' + minToHHMM(updated.startMin) + ':00')
        await apiFetch('/api/bookings/' + encodeURIComponent(String(ev._raw.id)), {
          method: 'PATCH',
          body: JSON.stringify({ barber_id: updated.barberId, service_id: remappedSvcIds[0] || updated.serviceId || '', service_ids: remappedSvcIds, service_name: newSvcNames, start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + newDurMin*60000).toISOString() })
        })
      } catch(e: any) {
        // Rollback optimistic update on failure
        setEvents(prev => prev.map(e2 => e2.id === ev.id ? ev : e2))
        showToast('Move failed: ' + (e.message || 'Error'))
      }
    }
  }

  useEffect(() => {
    if (!drag) return
    const move = (e: MouseEvent|TouchEvent) => onDragMove(e)
    const end = () => onDragEnd()
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end) }
  }, [drag, events, barbers])

  // ── Block drag-to-create ────────────────────────────────────────────────────
  // Haptic feedback for iOS
  function haptic() { try { if (navigator?.vibrate) navigator.vibrate(10) } catch {} }

  function startBlockDrag(barberId: string, barberIdx: number, startMin: number) {
    haptic()
    document.body.setAttribute('data-dragging', '1')
    const bd = { barberId, barberIdx, startMin: clamp(startMin), endMin: clamp(startMin) + 15 }
    blockDragRef.current = bd
    setBlockDrag(bd)
  }
  useEffect(() => {
    if (!blockDrag) return
    function onMove(e: MouseEvent | TouchEvent) {
      if (!blockDragRef.current) return
      e.preventDefault()
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const col = colRefs.current[blockDragRef.current.barberIdx]; if (!col) return
      const rawMin = Math.round((clientY - col.getBoundingClientRect().top) / slotH) * 5 + START_HOUR * 60
      const endMin = Math.max(blockDragRef.current.startMin + 5, clamp(rawMin))
      const updated = { ...blockDragRef.current, endMin }
      blockDragRef.current = updated
      setBlockDrag(updated)
    }
    function onEnd() {
      const bd = blockDragRef.current
      if (bd && bd.endMin - bd.startMin >= 5) {
        setBlockConfirm({ action: 'create', barberId: bd.barberId, startMin: bd.startMin, endMin: bd.endMin })
      }
      blockDragRef.current = null
      setBlockDrag(null)
      blockDragJustEnded.current = true
      setTimeout(() => document.body.removeAttribute('data-dragging'), 500)
      setTimeout(() => { blockDragJustEnded.current = false }, 50)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onEnd); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
  }, [blockDrag, slotH])

  // ── Create / Block ─────────────────────────────────────────────────────────
  function openCreateBlock(barberId: string, startMin: number, durMin?: number) {
    // Owner/Admin: create block immediately, no modal
    if (isOwnerOrAdmin) {
      confirmCreateBlock(barberId, clamp(startMin), durMin || 30)
      return
    }
    // Barber/Student: show modal for approval request
    setBlockDurInput(String(durMin || 30))
    setBlockModal({ type: 'create', barberId, startMin: clamp(startMin), currentDur: durMin || 30, originalDur: 0 })
  }

  async function confirmCreateBlock(barberId: string, startMin: number, duration: number) {
    // Barber/Student sends block as request for approval
    if (!isOwnerOrAdmin) {
      try {
        const startAt = new Date(todayStr + 'T' + minToHHMM(clamp(startMin)) + ':00')
        const endAt = new Date(startAt.getTime() + duration * 60000)
        const barber = barbers.find(b => b.id === barberId)
        const reqData = { barber_id: barberId, barberId, barberName: barber?.name || '', date: todayStr, startMin, duration, start_min: startMin, duration_min: duration, startAt: startAt.toISOString(), endAt: endAt.toISOString() }
        const res = await apiFetch('/api/requests', {
          method: 'POST',
          body: JSON.stringify({ type: 'block_time', data: reqData })
        })
        // Immediately show pending block on calendar
        const newReqId = res?.id || 'pending_' + Date.now()
        setPendingBlockRequests(prev => [...prev, { id: newReqId, type: 'block_time', status: 'pending', data: reqData }])
        showToast('Block request sent for approval')
      } catch (e: any) { showToast('Failed to send request: ' + (e.message || 'Error')) }
      setBlockModal(null)
      return
    }
    // Owner/Admin: create block directly
    const id = 'block_' + Date.now()
    const barber = barbers.find(b => b.id === barberId)
    setEvents(prev => [...prev, { id, type: 'block', barberId, barberName: barber?.name || '', clientName: 'BLOCKED', clientPhone: '', serviceId: '', serviceName: 'Blocked', date: todayStr, startMin: clamp(startMin), durMin: duration, status: 'block', paid: false, notes: '', _raw: null }])
    const startAt = new Date(todayStr + 'T' + minToHHMM(clamp(startMin)) + ':00')
    try {
      const res = await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify({ barber_id: barberId, type: 'block', status: 'confirmed', client_name: 'BLOCKED', service_id: '', start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + duration*60000).toISOString(), notes: 'Blocked by manager' }) })
      const savedId = res?.booking?.id || res?.id
      if (savedId) setEvents(prev => prev.map((e: any) => e.id === id ? { ...e, _raw: { id: savedId } } : e))
      showToast('Block saved')
    } catch (e: any) {
      setEvents(prev => prev.filter(e => e.id !== id))
      showToast('Failed to save block: ' + (e.message || 'Error'))
    }
    setBlockModal(null)
  }

  function openCreate(barberId: string, startMin: number) {
    const id = uid()
    const barber = barbers.find(b => b.id === barberId)
    setEvents(prev => [...prev, { id, barberId, barberName: barber?.name || '', clientName: '', clientPhone: '', serviceId: '', serviceName: '', date: todayStr, startMin: clamp(startMin), durMin: 30, status: 'booked', paid: false, notes: '', _raw: null }])
    setModal({ open: true, eventId: id, isNew: true })
  }

  const savingRef = useRef(false)
  async function handleSave(patch: any) {
    if (savingRef.current) return // Prevent double-save from rapid taps
    savingRef.current = true
    try { await _handleSaveInner(patch) } finally { savingRef.current = false }
  }
  async function _handleSaveInner(patch: any) {
    const ev = events.find(e => e.id === modal.eventId); if (!ev) return
    const svcIds: string[] = patch.serviceIds || (patch.serviceId ? [patch.serviceId] : [])
    const svcNames = svcIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ')
    const updated = { ...ev, ...patch, serviceIds: svcIds, serviceName: svcNames || ev.serviceName,
      // 1 no-show = immediately at_risk
      ...(patch.status === 'noshow' ? { _raw: { ...ev._raw, client_status: 'at_risk' } } : {})
    }
    setEvents(prev => prev.map((e: any) => e.id === ev.id ? updated : e))
    // Track arrived + send notification BEFORE save (so it works even if save fails)
    // _forceArrivedNotify bypasses dedup — user explicitly changed status to arrived
    const shouldNotifyArrived = patch.status === 'arrived' && (patch._forceArrivedNotify || (!arrivedIdsRef.current.has(ev.id) && !arrivedIdsRef.current.has(String(ev._raw?.id || ''))))
    if (patch.status === 'arrived') {
      if (ev._raw?.id) markArrived(String(ev._raw.id))
      if (ev.id) markArrived(String(ev.id))
    }
    if (shouldNotifyArrived) {
      const barberName = barbers.find(b => b.id === updated.barberId)?.name || updated.barberName || ''
      const clientName = updated.clientName || 'Client'
      const msgText = `📍 ${clientName} arrived — ${barberName}`
      // Send as system notification (API key only, no user token) so it works even with expired session
      fetch(`${API}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatType: 'barbers', text: msgText, system: true })
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(() => showToast('Client arrived — team notified'))
        .catch(() => showToast('Arrived saved'))
    }
    try {
      if (!ev._raw?.id) {
        const startAt = new Date(updated.date + 'T' + minToHHMM(updated.startMin) + ':00')
        const endAt = new Date(startAt.getTime() + (updated.durMin || 30) * 60000)
        const postBody: any = { barber_id: updated.barberId, service_id: svcIds[0] || updated.serviceId || '', service_ids: svcIds, service_name: svcNames || updated.serviceName || '', client_name: updated.clientName, client_phone: updated.clientPhone || '', start_at: startAt.toISOString(), end_at: endAt.toISOString(), notes: updated.notes || '', status: 'booked' }
        if (updated.photoUrl) postBody.reference_photo_url = updated.photoUrl
        if (isStudent) { postBody.booking_type = 'model'; postBody.student_id = currentUser?.uid || '' }
        const res = await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(postBody) })
        const savedId = res?.booking?.id || res?.id
        if (savedId) setEvents(prev => prev.map((e: any) => e.id === ev.id ? { ...e, _raw: { ...e._raw, ...res, id: savedId }, id: String(savedId) } : e))
      } else {
        const patchStart = new Date(updated.date + 'T' + minToHHMM(updated.startMin) + ':00')
        const patchEnd = new Date(patchStart.getTime() + (updated.durMin || 30) * 60000)
        const patchBody: any = { barber_id: updated.barberId, service_id: svcIds[0] || updated.serviceId || '', service_ids: svcIds, service_name: svcNames || updated.serviceName || '', client_name: updated.clientName, status: updated.status, end_at: patchEnd.toISOString(), start_at: patchStart.toISOString() }
        if (updated.clientPhone) patchBody.client_phone = updated.clientPhone
        if (updated.notes != null) patchBody.notes = updated.notes || ''
        if (updated.photoUrl) patchBody.reference_photo_url = updated.photoUrl
        await apiFetch(`/api/bookings/${encodeURIComponent(String(ev._raw.id))}`, { method: 'PATCH', body: JSON.stringify(patchBody) })
      }
    } catch(e: any) {
      // Rollback optimistic update on error
      setEvents(prev => prev.map(e2 => e2.id === ev.id ? ev : e2))
      showToast('Save failed: ' + (e.message || 'Error'))
      throw e
    }
    // (arrived notification sent before save — see above)
    setModal({ open: false, eventId: null, isNew: false })
    // Reload bookings to get fresh data from server (2s delay to ensure server committed)
    setTimeout(() => { loadBookings(barbers, services).then(evs => {
      const serverIds = new Set(evs.map((e: any) => e.id))
      setEvents(prev => {
        // Merge: keep recently-saved events that server might not have returned yet
        const merged = evs.map((e: any) => { if ((e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id)) clearArrived(e.id); return !(e.paid || e.status === 'done' || e.status === 'completed') && arrivedIdsRef.current.has(e.id) ? { ...e, status: 'arrived' } : e })
        // Keep any event from prev that has a real server ID but wasn't in the reload (saved < 5s ago)
        const kept = prev.filter(pe => pe._raw?.id && !serverIds.has(pe.id) && !pe.id.startsWith('e_'))
        return [...merged, ...kept]
      })
    }).catch(console.warn) }, 2000)
  }

  async function handleDelete() {
    const ev = events.find(e => e.id === modal.eventId); if (!ev) return
    if (!window.confirm('Delete this booking?')) return
    setEvents(prev => prev.filter(e => e.id !== ev.id))
    setModal({ open: false, eventId: null, isNew: false })
    if (ev._raw?.id) { try { await apiFetch(`/api/bookings/${encodeURIComponent(String(ev._raw.id))}`, { method: 'DELETE' }) } catch(e: any) { console.warn(e.message) } }
  }

  function handlePayment(method: string, tip: number) {
    const ev = events.find(e => e.id === modal.eventId)
    if (ev) {
      clearArrived(ev.id)
      if (ev._raw?.id) clearArrived(String(ev._raw.id))
      // Update booking on backend with tip + status + payment_method
      if (ev._raw?.id) {
        const patchBody = JSON.stringify({ status: 'completed', paid: true, tip, tip_amount: tip, payment_method: method })
        const patchUrl = `/api/bookings/${encodeURIComponent(String(ev._raw.id))}`
        apiFetch(patchUrl, { method: 'PATCH', body: patchBody })
          .catch(e => { console.warn('Payment PATCH failed, retrying:', e); return apiFetch(patchUrl, { method: 'PATCH', body: patchBody }) })
          .catch(e => console.warn('Payment PATCH retry also failed:', e))
      }
    }
    setEvents(prev => prev.map((e: any) => e.id === modal.eventId ? { ...e, paid: true, status: 'done', paymentMethod: method, tipAmount: tip, _raw: { ...(e._raw || {}), tip, tip_amount: tip, paid: true, payment_method: method } } : e))
    // Reload bookings after payment to sync tips from server
    setTimeout(() => { loadBookings(barbers, services).then((evs: CalEvent[]) => {
      setEvents(prev => {
        const serverMap = new Map(evs.map((e: CalEvent) => [e.id, e]))
        return prev.map(pe => {
          const se = serverMap.get(pe.id)
          if (se && se.paid) return { ...se, status: pe.status === 'arrived' ? 'arrived' : se.status }
          return pe
        })
      })
    }).catch(console.warn) }, 3000)
    // Second reload after 10s to catch terminal tips that arrive later
    setTimeout(() => { loadBookings(barbers, services).then((evs: CalEvent[]) => {
      setEvents(prev => {
        const serverMap = new Map(evs.map((e: CalEvent) => [e.id, e]))
        return prev.map(pe => {
          const se = serverMap.get(pe.id)
          if (se && se.paid) return { ...se, status: pe.status === 'arrived' ? 'arrived' : se.status }
          if (se && !se.paid && pe.paid) return { ...pe, tip: se._raw?.tip ?? pe.tipAmount, tipAmount: se._raw?.tip ?? pe.tipAmount }
          if (se) return { ...se, status: (pe.status === 'arrived' && !se.paid) ? 'arrived' : se.status }
          return pe
        })
      })
    }).catch(console.warn) }, 10000)
  }

  return (
    <Shell page="calendar">
      {/* Stars now rendered by Shell */}
      {/* Loading — inline centered in calendar area */}
      {loading && events.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(1,1,1,.8)' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,.10)', borderTop: '2px solid rgba(255,255,255,.50)', borderRadius: '50%', animation: 'calLoadSpin 0.8s linear infinite' }} />
          <style>{`@keyframes calLoadSpin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      <style>{`
        .cal-container { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        .cal-event:hover { filter: brightness(1.08); }
        .barber-edit-card:hover { border-color: rgba(255,255,255,.22) !important; box-shadow: 0 2px 16px rgba(255,255,255,.04); }
        @keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
        @keyframes wlGhostPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,.05), inset 0 0 0 1px rgba(255,255,255,.04); border-color: rgba(255,255,255,.06); background: rgba(255,255,255,.03); }
          50% { box-shadow: 0 0 22px rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08); border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.04); }
        }
        .wl-ghost-pulse { animation: wlGhostPulse 2.6s ease-in-out infinite; transition: filter .2s; }
        .wl-ghost-pulse:hover { filter: brightness(1.25); }
        /* ── BLOCK PENDING: red nebula warning ── */
        @keyframes blockPendingPulse {
          0%, 100% {
            box-shadow: 0 0 6px rgba(255,60,60,.08), 0 0 16px rgba(255,40,40,.03), inset 0 0 10px rgba(255,60,60,.03);
            border-color: rgba(255,60,60,.20);
            background: rgba(255,40,40,.03);
          }
          35% {
            box-shadow: 0 0 14px rgba(255,60,60,.25), 0 0 30px rgba(255,40,40,.08), inset 0 0 18px rgba(255,60,60,.06);
            border-color: rgba(255,60,60,.45);
            background: rgba(255,40,40,.06);
          }
          55% {
            box-shadow: 0 0 8px rgba(255,60,60,.12), 0 0 20px rgba(255,40,40,.04);
            border-color: rgba(255,60,60,.28);
            background: rgba(255,40,40,.04);
          }
          80% {
            box-shadow: 0 0 12px rgba(255,60,60,.18), 0 0 26px rgba(255,40,40,.06), inset 0 0 14px rgba(255,60,60,.04);
            border-color: rgba(255,60,60,.35);
            background: rgba(255,40,40,.05);
          }
        }
        @keyframes blockPendingSweep {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        .block-pending-pulse {
          animation: blockPendingPulse 3s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        .block-pending-pulse::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,60,60,.06), rgba(255,80,80,.10), rgba(255,60,60,.06), transparent);
          animation: blockPendingSweep 4.5s ease-in-out infinite;
          pointer-events: none;
        }

        /* ── BLOCK APPROVED: cosmic void ── */
        @keyframes cosmicVoidBreathe {
          0%, 100% {
            box-shadow: 0 0 8px 1px rgba(120,100,180,.06), 0 0 20px 4px rgba(80,60,140,.02), inset 0 0 15px rgba(120,100,180,.03);
            border-color: rgba(120,100,180,.10);
          }
          50% {
            box-shadow: 0 0 14px 2px rgba(120,100,180,.12), 0 0 30px 6px rgba(80,60,140,.04), inset 0 0 25px rgba(120,100,180,.05);
            border-color: rgba(120,100,180,.18);
          }
        }
        @keyframes voidNebula {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes voidStardust {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .block-approved-stripes {
          background: radial-gradient(ellipse at 20% 50%, rgba(60,40,100,.12) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 50%, rgba(40,30,80,.10) 0%, transparent 50%),
                      rgba(8,6,16,.95) !important;
          background-size: 200% 200%;
          animation: cosmicVoidBreathe 5s ease-in-out infinite, voidNebula 12s ease-in-out infinite;
          overflow: hidden;
        }
        .block-approved-stripes::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            135deg,
            transparent 0px,
            transparent 8px,
            rgba(120,100,180,.03) 8px,
            rgba(120,100,180,.03) 9px
          );
          pointer-events: none;
          border-radius: inherit;
        }
        .block-approved-stripes::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 30%;
          background: linear-gradient(90deg, transparent, rgba(120,100,180,.04), rgba(160,140,220,.07), rgba(120,100,180,.04), transparent);
          animation: voidStardust 10s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes paidShimmer {
          0%, 80% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        /* ── VIP: golden cosmic glow — border + shadow only, no bg change ── */
        @keyframes vipPulse {
          0%, 100% {
            box-shadow: 0 0 8px rgba(255,215,0,.06), 0 0 20px rgba(255,180,0,.03);
            border-color: rgba(255,215,0,.15);
          }
          50% {
            box-shadow: 0 0 16px rgba(255,215,0,.18), 0 0 35px rgba(255,180,0,.07);
            border-color: rgba(255,215,0,.35);
          }
        }
        @keyframes vipStarTrail {
          0% { background-position: 200% 50%; }
          100% { background-position: -200% 50%; }
        }
        .vip-pulse {
          border: 1px solid rgba(255,215,0,.18);
          animation: vipPulse 3.2s ease-in-out infinite;
          position: relative;
        }
        .vip-pulse::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 25%, rgba(255,215,0,.03) 40%, rgba(255,230,100,.07) 50%, rgba(255,215,0,.03) 60%, transparent 75%);
          background-size: 300% 100%;
          animation: vipStarTrail 7s ease-in-out infinite;
          pointer-events: none;
          border-radius: inherit;
        }

        /* ── AT RISK: red warning — border + shadow only ── */
        @keyframes atRiskPulse {
          0%, 100% {
            box-shadow: 0 0 6px rgba(255,80,80,.05), 0 0 18px rgba(255,60,60,.02);
            border-color: rgba(255,80,80,.14);
          }
          40% {
            box-shadow: 0 0 14px rgba(255,80,80,.18), 0 0 30px rgba(255,60,60,.05);
            border-color: rgba(255,80,80,.35);
          }
          55% {
            box-shadow: 0 0 8px rgba(255,80,80,.10);
            border-color: rgba(255,80,80,.22);
          }
          70% {
            box-shadow: 0 0 12px rgba(255,80,80,.14), 0 0 26px rgba(255,60,60,.04);
            border-color: rgba(255,80,80,.30);
          }
        }
        @keyframes riskScanline {
          0% { transform: translateX(-100%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        .at-risk-pulse {
          border: 1px solid rgba(255,80,80,.16);
          animation: atRiskPulse 3s ease-in-out infinite;
          position: relative;
        }
        .at-risk-pulse::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,80,80,.04), transparent);
          animation: riskScanline 4.5s ease-in-out infinite;
          pointer-events: none;
          border-radius: inherit;
        }

        /* ── ARRIVED: subtle aurora border glow — no bg override ── */
        @keyframes arrivedGlow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(130,180,255,.04), 0 0 18px rgba(130,160,240,.02);
            border-color: rgba(130,180,255,.12);
          }
          50% {
            box-shadow: 0 0 14px rgba(130,180,255,.10), 0 0 28px rgba(130,160,240,.04);
            border-color: rgba(130,180,255,.22);
          }
        }
        .arrived-pulse {
          border: 1px solid rgba(130,180,255,.12);
          animation: arrivedGlow 3s ease-in-out infinite;
        }

        /* ── PAID: dim + subtle shimmer — only state that reduces opacity ── */
        @keyframes paidDrift {
          0%, 80% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .cal-event-paid {
          opacity: .50;
          position: relative;
          overflow: hidden;
        }
        .cal-event-paid::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(130,220,170,.03) 40%, rgba(130,220,170,.07) 50%, rgba(130,220,170,.03) 60%, transparent 100%);
          background-size: 200% 100%;
          animation: paidDrift 8s ease-in-out infinite;
          pointer-events: none;
          border-radius: inherit;
        }

        /* ── NEW CLIENT: soft blue border glow ── */
        @keyframes newClientGlow {
          0%, 100% {
            box-shadow: 0 0 6px rgba(122,186,255,.04);
            border-color: rgba(122,186,255,.10);
          }
          50% {
            box-shadow: 0 0 12px rgba(122,186,255,.10);
            border-color: rgba(122,186,255,.20);
          }
        }
        .new-client-pulse {
          border: 1px solid rgba(122,186,255,.12);
          animation: newClientGlow 4s ease-in-out infinite;
        }
        /* Gravity lens day transition */
        @keyframes gravityOut {
          0% { transform: scale(1); filter: blur(0px) brightness(1); border-radius: 0; opacity: 1; }
          60% { transform: scale(.88,.92); filter: blur(2px) brightness(.85); border-radius: 12px; opacity: .9; }
          100% { transform: scale(.3,.4); filter: blur(8px) brightness(.6); border-radius: 50%; opacity: .4; }
        }
        @keyframes gravityIn {
          0% { transform: scale(.3,.4); filter: blur(8px) brightness(.6); border-radius: 50%; opacity: .4; }
          40% { transform: scale(.88,.92); filter: blur(2px) brightness(.85); border-radius: 12px; opacity: .9; }
          100% { transform: scale(1); filter: blur(0px) brightness(1); border-radius: 0; opacity: 1; }
        }
        .day-transition-out { animation: gravityOut .18s cubic-bezier(.4,0,1,.6) forwards; pointer-events: none; }
        .day-transition-in { animation: gravityIn .22s cubic-bezier(0,.4,.2,1) forwards; }
        /* Drag lift + neon + tilt */
        @keyframes dragLift {
          0% { transform: scale(1) perspective(600px) rotateX(0deg); box-shadow: 0 2px 6px rgba(0,0,0,.2); }
          100% { transform: scale(1.06) perspective(600px) rotateX(0deg); box-shadow: 0 16px 40px rgba(0,0,0,.50), 0 0 20px rgba(255,255,255,.08); }
        }
        .cal-event-dragging {
          animation: dragLift .2s ease-out forwards !important;
          border: 1.5px solid rgba(255,255,255,.25) !important;
          z-index: 50 !important;
          opacity: 1 !important;
          filter: brightness(1.15);
        }
        .cal-event-drag-ghost {
          border: 2px dashed rgba(255,255,255,.10) !important;
          background: rgba(255,255,255,.03) !important;
          box-shadow: 0 0 16px rgba(255,255,255,.06), inset 0 0 12px rgba(255,255,255,.02);
        }
        /* Date dot morph + glow animations */
        @keyframes dotPillGlow {
          0%, 100% { box-shadow: 0 0 4px rgba(130,150,220,.12); border-color: rgba(130,150,220,.25); }
          50% { box-shadow: 0 0 8px rgba(130,150,220,.25); border-color: rgba(130,150,220,.40); }
        }
        .date-dot {
          transition: all .25s cubic-bezier(.4,0,.2,1);
        }
        .date-dot:active { transform: scale(.85) }
        .date-dot-current {
          animation: dotPillGlow 3s ease-in-out infinite;
        }
        @keyframes calPickerIn {
          0% { opacity:0; transform: scale(.3); }
          100% { opacity:1; transform: scale(1); }
        }
        @keyframes calPickerBgIn {
          0% { opacity:0 }
          100% { opacity:1 }
        }
        .cal-picker-bg { animation: calPickerBgIn .2s ease-out }
        .cal-picker-card { animation: calPickerIn .3s cubic-bezier(.2,1,.3,1); transform-origin: center bottom; }
        /* Desktop: hide mobile-only elements */
        .cal-search-icon{ display:none !important; }
        .cal-settings-icon{ display:none !important; }
        .cal-date-mobile{ display:none !important; }
        .cal-today-desktop{ display:inline-flex !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 3px; }
        /* Mobile: prevent scroll bounce and pinch zoom */
        @media(max-width:768px){
          body { overscroll-behavior: none; touch-action: pan-x pan-y; }
          .cal-scroll-lock { touch-action: none !important; overflow: hidden !important; }
          /* Mobile topbar — single row, title centered */
          .cal-topbar-row{
            flex-direction:row !important;
            align-items:center !important;
            justify-content:center !important;
            gap:4px !important;
            flex-wrap:nowrap !important;
          }
          .cal-topbar-left{ display:none !important; }
          .cal-topbar-btns{
            flex-wrap:nowrap !important;
            gap:4px !important;
            justify-content:center !important;
            width:100% !important;
            overflow-x:auto !important;
          }
          .cal-topbar-btns button, .cal-topbar-btns label, .cal-topbar-btns div {
            flex-shrink:0 !important;
          }
          /* Hide desktop Date btn, show date pill instead */
          .cal-btn-date{ display:none !important; }
          .cal-date-mobile{ display:inline-flex !important; }
          .cal-today-desktop{ display:none !important; }
          /* Hide text labels on mobile — show only icons */
          .cal-btn-text{ display:none !important; }
          .cal-btn-date{ display:none !important; }
          .cal-search-full{ display:none !important; }
          .cal-search-icon{ display:none !important; }
          .cal-settings-btn{ display:none !important; }
          .cal-settings-icon{ display:none !important; }
          .cal-new-btn{ display:none !important; }
          .cal-student-btn{ display:none !important; }
          /* Hide arrows + date pill on mobile — moved to bottom dots */
          .cal-topbar-left{ display:none !important; }
          .cal-nav-arrows{ display:none !important; }
          /* Hide topbar on mobile — everything moved to bottom bar */
          .cal-topbar-wrap{ display:none !important; }
        }
        input[type=range] { -webkit-appearance: none; appearance: none; background: rgba(255,255,255,.12); border-radius: 4px; height: 4px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,.7); cursor: pointer; border: 2px solid rgba(0,0,0,.40); box-shadow: 0 1px 4px rgba(0,0,0,.3); }
        input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,.7); cursor: pointer; border: 2px solid rgba(0,0,0,.40); box-shadow: 0 1px 4px rgba(0,0,0,.3); }
        select option { background: #111; }
        input[type=date],input[type=time] { color-scheme: dark; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Calendar controls — rendered into Shell topbar via portal */}
        {portalTarget && createPortal(
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {/* Date/Today nav hidden — dates are in bottom date strip */}

              {/* Settings */}
              {(isOwnerOrAdmin || isStudent || isBarber) && <button onClick={() => setSettingsOpen(true)} style={{ height: 26, width: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className="cal-settings-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>}

              {/* New booking — students see "+ Model" */}
              {isStudent && (
                <button onClick={() => {
                  const freeSlots: { min: number; mentorId: string; mentorName: string }[] = []
                  for (let m = START_HOUR * 60; m <= END_HOUR * 60 - 90; m += 5) {
                    const mid = studentSlotMentorMap.get(m)
                    if (!mid) continue
                    let ok = true
                    for (let c = m; c < m + 90; c += 5) { if (!studentSlotMentorMap.has(c)) { ok = false; break } }
                    if (ok) {
                      const mentor = barbers.find(b => b.id === mid)
                      if (!freeSlots.length || freeSlots[freeSlots.length-1].min + 5 < m || freeSlots[freeSlots.length-1].mentorId !== mid) {
                        freeSlots.push({ min: m, mentorId: mid, mentorName: mentor?.name || '' })
                      }
                    }
                  }
                  if (!freeSlots.length) { showToast('No free 90min slot available today'); return }
                  setSlotPicker(freeSlots)
                }} className="cal-student-btn" style={{ height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(168,107,255,.40)', background: 'rgba(168,107,255,.06)', color: 'rgba(180,140,220,.6)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>+ Model</button>
              )}
          </div>,
          portalTarget
        )}

        {/* Calendar grid */}
        {(() => {
          // On mobile: show ALL barbers with narrower columns
          const pageBarbers = visibleBarbers
          const timeColW = isMobile ? 24 : 45
          // Dynamic column min-width: shrink columns to fit all barbers on screen
          const mobileColMin = isMobile && pageBarbers.length > 1
            ? Math.max(60, Math.floor((window.innerWidth - timeColW) / pageBarbers.length))
            : COL_MIN
          const colMin = isMobile ? mobileColMin : COL_MIN
          return (
        <div className={`cal-container${dayTransition === 'out' ? ' day-transition-out' : dayTransition === 'in' ? ' day-transition-in' : ''}`} style={{ flex: 1, position: 'relative', overflowY: (drag || blockDrag) ? 'hidden' : 'auto', overflowX: 'hidden', touchAction: (drag || blockDrag) ? 'none' : 'pan-x pan-y', transformOrigin: 'center 40%' }} ref={scrollContainerRef} onTouchStart={onPinchStart} onTouchMove={onPinchMove} onTouchEnd={onPinchEnd}>
          <div style={{ minWidth: timeColW + pageBarbers.length * colMin }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: `${timeColW}px repeat(${pageBarbers.length}, minmax(${colMin}px,1fr))`, borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 10 }}>
              <div style={{ padding: isMobile ? '10px 2px' : '10px 12px', borderRight: '1px solid rgba(255,255,255,.10)', color: 'rgba(255,255,255,.40)', fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', textAlign: 'center' }}>{isMobile ? '' : 'Time'}</div>
              {pageBarbers.map((b, i) => {
                const attachedStudents = studentUsers.filter(s => s.mentorIds.includes(b.id))
                const compact = isMobile && pageBarbers.length > 2
                const photoSize = compact ? 22 : 32
                return (
                  <div key={b.id} style={{ padding: compact ? '6px 4px' : '10px 12px', borderRight: i < visibleBarbers.length-1 ? '1px solid rgba(255,255,255,.08)' : 'none', display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: 'center', gap: compact ? 2 : 10, overflow: 'hidden' }}>
                    {b.id === '__student__' ? (
                      <div style={{ width: photoSize, height: photoSize, borderRadius: compact ? 7 : 10, background: 'rgba(168,107,255,.20)', border: '1px solid rgba(168,107,255,.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width={compact ? 11 : 15} height={compact ? 11 : 15} viewBox="0 0 24 24" fill="none" stroke="rgba(180,140,220,.6)" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>
                      </div>
                    ) : b.photo ? <img src={b.photo} alt={b.name} style={{ width: photoSize, height: photoSize, borderRadius: compact ? 7 : 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)', flexShrink: 0 }} onError={e => (e.currentTarget.style.display='none')} /> : <div style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: 999, background: b.color, flexShrink: 0 }} />}
                    <div style={{ minWidth: 0, textAlign: compact ? 'center' : 'left', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', justifyContent: compact ? 'center' : 'flex-start' }}>
                        <span style={{ fontWeight: 900, fontSize: compact ? 9 : 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{compact ? b.name.split(' ')[0] : b.name}</span>
                        {!compact && attachedStudents.length > 0 && attachedStudents.map(s => (
                          <span key={s.id} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 999, border: '1px solid rgba(168,107,255,.25)', background: 'rgba(168,107,255,.08)', color: 'rgba(168,107,255,.65)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {s.name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                      {!compact && b.level && <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,.35)' }}>{b.level}</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Body */}
            <div style={{ display: 'grid', gridTemplateColumns: `${timeColW}px repeat(${pageBarbers.length}, minmax(${colMin}px,1fr))`, height: totalH, position: 'relative' }}>
              {/* Time labels */}
              <div style={{ borderRight: '1px solid rgba(255,255,255,.04)', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', position: 'relative' }}>
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                  const h = START_HOUR + i
                  const label = _is24h ? `${pad2(h)}` : (() => { const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return String(h12) })()
                  const ampm = _is24h ? '' : (h < 12 ? 'AM' : 'PM')
                  return (
                    <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i*slotH*12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: isMobile ? 2 : 8, color: 'rgba(255,255,255,.35)', fontSize: isMobile ? 9 : 11, lineHeight: 1, fontWeight: isMobile ? 600 : 400 }}>
                      <span>{label}</span>
                      {!_is24h && isMobile && <span style={{ fontSize: 7, opacity: .5, marginTop: 1 }}>{ampm}</span>}
                      {!_is24h && !isMobile && <span> {ampm}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Columns */}
              {pageBarbers.map((barber, bi) => {
                // Student: all model events go to the single student column
                const colEvents = isStudent
                  ? filtered.filter(e => e._raw?.booking_type === 'model' || e._raw?.booking_type === 'training')
                  : filtered.filter(e => e.barberId === barber.id)
                return (
                  <div key={barber.id} ref={el => { colRefs.current[bi] = el }}
                    style={{ position: 'relative', borderRight: bi < visibleBarbers.length-1 ? '1px solid rgba(255,255,255,.03)' : 'none', background: blockDrag?.barberIdx === bi ? 'rgba(255,107,107,.02)' : drag?.ghostBarberIdx === bi ? 'rgba(255,255,255,.015)' : bi % 2 === 0 ? 'rgba(255,255,255,.008)' : 'transparent', transition: 'background .15s', touchAction: (drag || blockDrag) ? 'none' : 'pan-y' }}
                    onMouseDown={e => {
                      if (e.button !== 0) return
                      if ((e.target as HTMLElement).closest('.cal-event')) return
                      if (isStudent) return
                      const canBlock = isOwnerOrAdmin || (isBarber && barber.id === myBarberId)
                      if (!canBlock) return
                      const min = Math.round((e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top) / slotH) * 5 + START_HOUR * 60
                      const bId = barber.id
                      // Long press to start block (desktop)
                      clearTimeout(blockLongPressTimer.current)
                      blockLongPressTimer.current = setTimeout(() => { e.preventDefault(); startBlockDrag(bId, bi, min) }, 400)
                    }}
                    onMouseUp={() => { clearTimeout(blockLongPressTimer.current) }}
                    onMouseLeave={() => { clearTimeout(blockLongPressTimer.current) }}
                    onTouchStart={e => {
                      clearTimeout(blockLongPressTimer.current)
                      clearTimeout(touchDelayTimer.current)
                      // Cleanup previous listeners
                      if (touchColRef.current.moveHandler) { window.removeEventListener('touchmove', touchColRef.current.moveHandler); touchColRef.current.moveHandler = null }
                      if (touchColRef.current.endHandler) { window.removeEventListener('touchend', touchColRef.current.endHandler); touchColRef.current.endHandler = null }
                      touchColRef.current.active = false
                      if ((e.target as HTMLElement).closest('.cal-event')) return
                      const col = e.currentTarget as HTMLElement
                      const colRect = col.getBoundingClientRect()
                      const touchMin = Math.round((e.touches[0].clientY - colRect.top) / slotH) * 5 + START_HOUR * 60
                      const startX = e.touches[0].clientX, startY = e.touches[0].clientY
                      touchColRef.current = { barberId: barber.id, barberIdx: bi, colEl: col, startX, startY, active: false, moveHandler: null, endHandler: null }
                      // 200ms — activate crosshair with window listeners (like blockDrag)
                      touchDelayTimer.current = setTimeout(() => {
                        touchColRef.current.active = true
                        setTouchIndicator({ min: touchMin, y: 0 })
                        // Add window-level listeners with passive:false to block scroll
                        const onMove = (te: TouchEvent) => {
                          if (!touchColRef.current.active) return
                          te.preventDefault() // block scroll
                          clearTimeout(blockLongPressTimer.current)
                          const cRect = col.getBoundingClientRect()
                          const newMin = Math.round((te.touches[0].clientY - cRect.top) / slotH) * 5 + START_HOUR * 60
                          setTouchIndicator({ min: newMin, y: te.touches[0].clientY - cRect.top })
                        }
                        const onEnd = () => {
                          clearTimeout(blockLongPressTimer.current)
                          window.removeEventListener('touchmove', onMove)
                          window.removeEventListener('touchend', onEnd)
                          touchColRef.current.moveHandler = null; touchColRef.current.endHandler = null
                          const bId = touchColRef.current.barberId
                          const curIndicator = touchColRef.current.active
                          touchColRef.current.active = false
                          if (!curIndicator) { setTouchIndicator(null); return }
                          // Get current indicator min from DOM (state may be stale in closure)
                          const cRect = col.getBoundingClientRect()
                          setTouchIndicator(prev => {
                            if (!prev) return null
                            setTimeout(() => {
                              if (isBarber && bId !== myBarberId) return
                              if (isStudent) return
                              const x2 = window.innerWidth / 2, y2 = window.innerHeight / 2
                              ;(isOwnerOrAdmin || (isBarber && bId === myBarberId)) ? setContextMenu({ x: x2, y: y2, barberId: bId, min: clamp(prev.min) }) : openCreate(bId, clamp(prev.min))
                            }, 10)
                            return null
                          })
                        }
                        window.addEventListener('touchmove', onMove, { passive: false })
                        window.addEventListener('touchend', onEnd)
                        touchColRef.current.moveHandler = onMove; touchColRef.current.endHandler = onEnd
                      }, 200)
                      // 600ms — block drag (if finger didn't move)
                      if (!isStudent) {
                        const canBlock = isOwnerOrAdmin || (isBarber && barber.id === myBarberId)
                        if (canBlock && e.touches.length === 1) {
                          const bId = barber.id
                          blockLongPressTimer.current = setTimeout(() => {
                            clearTimeout(touchDelayTimer.current)
                            if (touchColRef.current.moveHandler) { window.removeEventListener('touchmove', touchColRef.current.moveHandler) }
                            if (touchColRef.current.endHandler) { window.removeEventListener('touchend', touchColRef.current.endHandler) }
                            touchColRef.current.active = false; touchColRef.current.moveHandler = null; touchColRef.current.endHandler = null
                            setTouchIndicator(null)
                            startBlockDrag(bId, bi, touchMin)
                          }, 600)
                        }
                      }
                    }}
                    onTouchEnd={() => { clearTimeout(touchDelayTimer.current); clearTimeout(blockLongPressTimer.current) }}
                    onTouchMove={e => {
                      if (touchColRef.current.active) return // handled by window listener
                      const dy = Math.abs(e.touches[0].clientY - touchColRef.current.startY)
                      const dx = Math.abs(e.touches[0].clientX - touchColRef.current.startX)
                      if (dy > 8 || dx > 8) { clearTimeout(touchDelayTimer.current); clearTimeout(blockLongPressTimer.current) }
                    }}
                    onClick={e => {
                      if (contextMenu) return // already opened by touchEnd
                      if (blockDrag || blockDragRef.current || blockDragJustEnded.current) return
                      if ((e.target as HTMLElement).closest('.cal-event')) return
                      if (isBarber && barber.id !== myBarberId) return
                      const min = Math.round((e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top) / slotH) * 5 + START_HOUR * 60
                      // Student: find which mentor is free at this slot
                      if (isStudent) {
                        const slotMin = clamp(min)
                        const mentorId = studentSlotMentorMap.get(slotMin)
                        if (!mentorId) return // slot is blocked — no free mentor
                        // Check if model would conflict (90min block)
                        const modelDur = 90
                        let hasConflict = false
                        for (let m = slotMin; m < slotMin + modelDur; m += 5) {
                          if (!studentSlotMentorMap.has(m)) { hasConflict = true; break }
                        }
                        if (hasConflict) { showToast('Not enough free time for 90min model at this slot'); return }
                        openCreate(mentorId, slotMin)
                        return
                      }
                      setTouchIndicator(null)
                      ;(isOwnerOrAdmin || (isBarber && barber.id === myBarberId)) ? setContextMenu({ x: e.clientX, y: e.clientY, barberId: barber.id, min: clamp(min) }) : openCreate(barber.id, clamp(min))
                    }}>
                    {/* Student: blocked slots overlay (where no mentor is free) */}
                    {isStudent && barber.id === '__student__' && studentBlockedRanges.map((range, ri) => {
                      return (
                        <div key={ri} style={{ position: 'absolute', left: 0, right: 0, top: minToY(range.startMin), height: minToY(range.endMin) - minToY(range.startMin), zIndex: 2, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px) saturate(120%)', WebkitBackdropFilter: 'blur(8px) saturate(120%)', cursor: 'not-allowed', pointerEvents: 'none' } as React.CSSProperties} />
                      )
                    })}
                    {/* Off-hours blocks — gray, like red block but for non-working time */}
                    {(() => {
                      const wh = (workHours as any)[barber.id]
                      if (!wh) return null
                      const { startMin, endMin, dayOff } = wh as { startMin: number; endMin: number; dayOff: boolean }
                      const totalPx = minToY(END_HOUR * 60)
                      const sy = minToY(startMin)
                      const ey = minToY(endMin)

                      // Frosted glass effect for off-hours
                      const GLASS = { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as React.CSSProperties
                      const BG = 'rgba(0,0,0,.15)'
                      const BORDER_COLOR = 'rgba(255,255,255,.12)'
                      const TIME_PILL = { fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(0,0,0,.50)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.55)', letterSpacing: '.04em', fontFamily: 'Inter,sans-serif' } as React.CSSProperties

                      if (dayOff) return (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: BG, ...GLASS, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed', pointerEvents: 'none' }}>
                          <span style={{ ...TIME_PILL, fontSize: 11 }}>Day off</span>
                        </div>
                      )

                      return (
                        <>
                          {/* TOP — before work */}
                          {sy > 0 && (
                            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: sy, zIndex: 2, background: BG, ...GLASS, cursor: 'default', pointerEvents: 'none' }}>
                              {/* Border bottom = work start */}
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: BORDER_COLOR, pointerEvents: 'none' }} />
                              {/* Label */}
                              {sy > 32 && (
                                <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <span style={TIME_PILL}>{minToAMPM(startMin)}</span>
                                </div>
                              )}
                              {/* Handle zone — owner/admin/barber(own column) can drag */}
                              {(isOwnerOrAdmin || (isBarber && barber.id === myBarberId)) && (
                                <div
                                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, cursor: 'ns-resize', pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}
                                  onMouseDown={e => { e.stopPropagation(); offResize.current = { barberId: barber.id, type: 'top', startY: e.clientY, origMin: startMin } }}
                                  onTouchStart={e => { e.stopPropagation(); const t = e.touches[0]; const bId = barber.id; const sm = startMin; clearTimeout(eventLongPressTimer.current); eventLongPressTimer.current = setTimeout(() => { offResize.current = { barberId: bId, type: 'top', startY: t.clientY, origMin: sm } }, 400) }}
                                  onTouchEnd={() => clearTimeout(eventLongPressTimer.current)}
                                  onTouchMove={() => clearTimeout(eventLongPressTimer.current)}>
                                  <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.35)' }} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* BOTTOM — after work */}
                          {ey < totalPx && (
                            <div style={{ position: 'absolute', left: 0, right: 0, top: ey, height: totalPx - ey, zIndex: 2, background: BG, ...GLASS, cursor: 'default', pointerEvents: 'none' }}>
                              {/* Border top = work end */}
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: BORDER_COLOR, pointerEvents: 'none' }} />
                              {/* Handle zone — owner/admin/barber(own column) can drag */}
                              {(isOwnerOrAdmin || (isBarber && barber.id === myBarberId)) && (
                                <div
                                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28, cursor: 'ns-resize', pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}
                                  onMouseDown={e => { e.stopPropagation(); offResize.current = { barberId: barber.id, type: 'bottom', startY: e.clientY, origMin: endMin } }}
                                  onTouchStart={e => { e.stopPropagation(); const t = e.touches[0]; const bId = barber.id; const em = endMin; clearTimeout(eventLongPressTimer.current); eventLongPressTimer.current = setTimeout(() => { offResize.current = { barberId: bId, type: 'bottom', startY: t.clientY, origMin: em } }, 400) }}
                                  onTouchEnd={() => clearTimeout(eventLongPressTimer.current)}
                                  onTouchMove={() => clearTimeout(eventLongPressTimer.current)}>
                                  <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.35)' }} />
                                </div>
                              )}
                              {/* Label */}
                              {(totalPx - ey) > 32 && (
                                <div style={{ position: 'absolute', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <span style={TIME_PILL}>{minToAMPM(endMin)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )
                    })()}
                    {/* Grid lines */}
                    {Array.from({ length: (END_HOUR-START_HOUR)*12 }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i*slotH, height: 1, background: i%12===0 ? 'rgba(255,255,255,.10)' : i%4===0 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.015)', pointerEvents: 'none' }} />
                    ))}
                    {/* Now line — full width across all columns */}
                    {showNow && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: nowY, height: 2, background: 'rgba(255,255,255,.5)', boxShadow: '0 0 14px rgba(255,255,255,.10)', pointerEvents: 'none', zIndex: 20 }}>
                        {bi === 0 && <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,.7)', boxShadow: '0 0 0 3px rgba(255,255,255,.06)' }} />}
                      </div>
                    )}
                    {/* Touch indicator — crosshair + time tooltip */}
                    {touchIndicator && bi === 0 && (() => {
                      const indY = minToY(touchIndicator.min)
                      const h = touchIndicator.min % (12 * 60) === 0 ? 12 : (touchIndicator.min % (12 * 60)) / 60
                      const hour = Math.floor(touchIndicator.min / 60)
                      const mins = touchIndicator.min % 60
                      const ampm = hour < 12 ? 'AM' : 'PM'
                      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                      return (
                        <>
                          {/* Highlight row */}
                          <div style={{ position: 'absolute', left: -timeColW, right: -(pageBarbers.length - 1) * colMin, top: indY - slotH * 3, height: slotH * 6, background: 'rgba(255,255,255,.02)', pointerEvents: 'none', zIndex: 1 }} />
                          {/* Crosshair line */}
                          <div style={{ position: 'absolute', left: -timeColW, right: -(pageBarbers.length - 1) * colMin, top: indY, height: 1, background: 'rgba(255,255,255,.08)', pointerEvents: 'none', zIndex: 25, boxShadow: '0 0 6px rgba(255,255,255,.06)' }} />
                          {/* Time tooltip */}
                          <div style={{ position: 'absolute', left: -timeColW, top: indY - 11, zIndex: 26, pointerEvents: 'none', background: 'rgba(255,255,255,.5)', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                            {displayHour}:{String(mins).padStart(2, '0')} {ampm}
                          </div>
                        </>
                      )
                    })()}
                    {/* Ghost */}
                    {drag?.ghostBarberIdx===bi && (() => {
                      const dragEv = events.find(e => e.id === drag.eventId); if (!dragEv) return null
                      return <div className="cal-event-drag-ghost" style={{ position: 'absolute', left: 8, right: 8, top: minToY(drag.ghostMin), height: Math.max(slotH*6, (dragEv.durMin/5)*slotH)-2, borderRadius: 14, pointerEvents: 'none', zIndex: 40 }}><div style={{ padding: '6px 10px', fontWeight: 900, fontSize: 11, color: 'rgba(130,150,220,.6)' }}>{dragEv.clientName} — {minToAMPM(drag.ghostMin)}</div></div>
                    })()}
                    {/* Block drag ghost */}
                    {blockDrag?.barberIdx === bi && (() => {
                      const h = minToY(blockDrag.endMin) - minToY(blockDrag.startMin)
                      return <div className="block-approved-stripes" style={{ position: 'absolute', left: 4, right: 4, top: minToY(blockDrag.startMin), height: Math.max(slotH * 2, h), borderRadius: 10, border: '1px solid rgba(120,100,180,.18)', pointerEvents: 'none', zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(120,100,180,.50)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(160,140,220,.45)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{minToAMPM(blockDrag.startMin)}–{minToAMPM(blockDrag.endMin)}</span>
                        <span style={{ fontSize: 9, color: 'rgba(120,100,180,.30)' }}>{blockDrag.endMin - blockDrag.startMin}min</span>
                      </div>
                    })()}
                    {/* Events */}
                    {colEvents.map(ev => {
                      const top = minToY(ev.startMin)
                      const height = Math.max(slotH*6, (ev.durMin/5)*slotH)
                      const isBlock = ev.type === 'block' || ev.status === 'block' || ev.clientName === 'BLOCKED'
                      const canDrag = isStudent ? false : (isBlock ? isOwnerOrAdmin : (!isBarber || ev.barberId === myBarberId))

                      const isPending = ev.status === 'block_pending' || !!(ev as any)._pendingResize
                      const approvedDur = (ev as any)._approvedDur || (isPending ? 0 : ev.durMin)
                      const hasPendingExtension = !isPending && (ev as any)._pendingResize && approvedDur > 0 && ev.durMin > approvedDur
                      if (isBlock) return (
                        <div key={ev.id} className={drag?.eventId===ev.id ? 'cal-event-dragging' : ''} style={{ position: 'absolute', left: 4, right: 4, top, height: height-2, borderRadius: 10, zIndex: drag?.eventId===ev.id ? 50 : 3, overflow: 'visible', cursor: isOwnerOrAdmin ? (drag?.eventId===ev.id ? 'grabbing' : 'pointer') : 'pointer', userSelect: 'none', transition: 'transform .15s, box-shadow .15s' }}
                          onMouseDown={e => { if (!isOwnerOrAdmin || e.button!==0) return; e.stopPropagation(); startDrag(e, ev, bi) }}
                          onTouchStart={e => { if (!isOwnerOrAdmin) return; e.stopPropagation(); clearTimeout(eventLongPressTimer.current); const touch = e.touches[0]; const evCopy = ev; const biCopy = bi; eventLongPressTimer.current = setTimeout(() => { const fakeEvt = { preventDefault(){}, stopPropagation(){}, touches: [touch] } as any; startDrag(fakeEvt, evCopy, biCopy) }, 400) }}
                          onTouchEnd={() => clearTimeout(eventLongPressTimer.current)}
                          onTouchMove={() => clearTimeout(eventLongPressTimer.current)}
                          onClick={e => {
                            e.stopPropagation()
                            if (drag || blockDragJustEnded.current) return
                            const canDelete = isOwnerOrAdmin || (isBarber && ev.barberId === myBarberId)
                            if (!canDelete) return
                            setBlockConfirm({ action: 'delete', barberId: ev.barberId, startMin: ev.startMin, endMin: ev.startMin + ev.durMin, evId: ev.id, rawId: ev._raw?.id ? String(ev._raw.id) : undefined })
                          }}>
                          {/* Approved part (moving stripes) */}
                          {!isPending && <div className="block-approved-stripes" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hasPendingExtension ? (approvedDur / ev.durMin * 100) + '%' : '100%', borderRadius: hasPendingExtension ? '10px 10px 0 0' : 10, border: `1px solid ${drag?.eventId===ev.id ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)'}` }} />}
                          {/* Pending part (breathing red) */}
                          {(isPending || hasPendingExtension) && <div className="block-pending-pulse" style={{ position: 'absolute', left: 0, right: 0, top: hasPendingExtension ? (approvedDur / ev.durMin * 100) + '%' : 0, bottom: 0, borderRadius: hasPendingExtension ? '0 0 10px 10px' : 10, border: '1px solid rgba(255,107,107,.45)' }} />}
                          {/* Content */}
                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isPending ? 'rgba(255,80,80,.50)' : 'rgba(120,100,180,.45)'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                              <span style={{ fontSize: 10, textTransform: 'uppercase', color: isPending ? 'rgba(255,120,120,.50)' : 'rgba(160,140,220,.40)', fontWeight: 400, letterSpacing: '.08em' }}>{isPending ? 'Pending' : hasPendingExtension ? 'Blocked + Pending' : 'Blocked'} {minToAMPM(ev.startMin)}–{minToAMPM(ev.startMin+ev.durMin)}</span>
                            </div>
                            {/* ✕ button removed — tap block to delete */}
                          </div>
                          {(isOwnerOrAdmin || (isBarber && ev.barberId === currentUser?.barber_id)) && (() => {
                            const handleResize = (startY: number, getY: (e: any) => number, evId: string, startDur: number, rawObj: any, startMin: number, dateStr: string, addMove: (fn: any) => void, addEnd: (fn: any) => void, rmMove: (fn: any) => void, rmEnd: (fn: any) => void) => {
                              let currentDur = startDur
                              const onMove = (e: any) => {
                                if (e.preventDefault) e.preventDefault()
                                const dy = getY(e) - startY
                                currentDur = Math.max(5, startDur + Math.round(dy / slotH) * 5)
                                setEvents(prev => prev.map(x => x.id === evId ? { ...x, durMin: currentDur } : x))
                              }
                              const onEnd = () => {
                                rmMove(onMove); rmEnd(onEnd)
                                if (currentDur === startDur) return
                                // Revert to original
                                setEvents(prev => prev.map(x => x.id === evId ? { ...x, durMin: startDur } : x))
                                const sa = new Date(dateStr + 'T' + minToHHMM(startMin) + ':00')
                                if (isBarber && !isOwnerOrAdmin) {
                                  setBlockModal({ type: 'resize_confirm', barberId: currentUser?.barber_id || '', startMin, currentDur, originalDur: startDur, evId, rawId: String(rawObj?.id || '') })
                                } else {
                                  setBlockModal({ type: 'owner_resize', barberId: '', startMin, currentDur, originalDur: startDur, evId, rawId: String(rawObj?.id || '') })
                                }
                              }
                              addMove(onMove); addEnd(onEnd)
                            }
                            return <div
                              onMouseDown={e => {
                                e.stopPropagation(); e.preventDefault()
                                handleResize(e.clientY, (me: MouseEvent) => me.clientY, ev.id, ev.durMin, ev._raw, ev.startMin, ev.date,
                                  fn => window.addEventListener('mousemove', fn),
                                  fn => window.addEventListener('mouseup', fn),
                                  fn => window.removeEventListener('mousemove', fn),
                                  fn => window.removeEventListener('mouseup', fn))
                              }}
                              onTouchStart={e => {
                                e.stopPropagation()
                                handleResize(e.touches[0].clientY, (te: TouchEvent) => te.touches[0].clientY, ev.id, ev.durMin, ev._raw, ev.startMin, ev.date,
                                  fn => window.addEventListener('touchmove', fn, { passive: false }),
                                  fn => window.addEventListener('touchend', fn),
                                  fn => window.removeEventListener('touchmove', fn),
                                  fn => window.removeEventListener('touchend', fn))
                              }}
                              style={{ position: 'absolute', left: 10, right: 10, bottom: 4, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.15)', boxShadow: '0 0 4px rgba(255,255,255,.08)', cursor: 'ns-resize', touchAction: 'none' }} />
                          })()}
                        </div>
                      )

                      const tinyCol = isMobile && pageBarbers.length > 2
                      const isArrived = ev.status === 'arrived'
                      const isDone = ev.status === 'done' || ev.status === 'completed'
                      const isPaid = !!ev.paid || isDone
                      const isNoshow = ev.status === 'noshow'
                      const isAtRisk = ev._raw?.client_status === 'at_risk' && ev.status === 'booked' && !isPaid
                      const isVip = ev._raw?.client_status === 'vip' && ev.status === 'booked' && !isPaid
                      const isNewClient = ev._raw?.client_status === 'new' && ev.status === 'booked' && !isPaid && !isArrived
                      // Hide no-show if another booking overlaps the same slot for this barber
                      if (isNoshow) {
                        const hasReplacement = colEvents.some(other => other.id !== ev.id && other.status !== 'noshow' && other.status !== 'cancelled' && other.startMin < ev.startMin + ev.durMin && other.startMin + other.durMin > ev.startMin)
                        if (hasReplacement) return null
                      }
                      return (
                        <div key={ev.id} className={`cal-event${isArrived ? ' arrived-pulse' : ''}${isPaid ? ' cal-event-paid' : ''}${isAtRisk ? ' at-risk-pulse' : ''}${isVip ? ' vip-pulse' : ''}${isNewClient ? ' new-client-pulse' : ''}${drag?.eventId===ev.id ? ' cal-event-dragging' : ''}`}
                          style={{ position: 'absolute', left: tinyCol ? 2 : 6, right: tinyCol ? 2 : 6, top, height: height-2, borderRadius: tinyCol ? 14 : 20, background: isNoshow ? 'rgba(255,107,107,.03)' : isPaid ? 'rgba(130,220,170,.04)' : 'rgba(255,255,255,.04)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', boxShadow: '0 2px 12px rgba(0,0,0,.25)', ...(!isArrived && !isAtRisk && !isVip && !isNewClient && drag?.eventId!==ev.id ? { border: `1px solid ${isPaid ? 'rgba(130,220,170,.10)' : isNoshow ? 'rgba(255,107,107,.08)' : 'rgba(255,255,255,.08)'}` } : {}), ...(isNoshow ? { opacity: 0.3 } : {}), padding: tinyCol ? '3px 4px 3px 8px' : '7px 12px 7px 14px', cursor: canDrag ? (drag ? 'grabbing' : 'grab') : 'pointer', userSelect: 'none', overflow: 'hidden', zIndex: drag?.eventId===ev.id ? 50 : isNoshow ? 2 : 5, transition: 'all .2s ease' }}
                          onMouseDown={e => { if (!canDrag || e.button!==0) return; startDrag(e, ev, bi) }}
                          onTouchStart={e => { if (!canDrag) return; e.stopPropagation(); clearTimeout(eventLongPressTimer.current); const touch = e.touches[0]; const evCopy = ev; const biCopy = bi; eventLongPressTimer.current = setTimeout(() => { const fakeEvt = { preventDefault(){}, stopPropagation(){}, touches: [touch] } as any; startDrag(fakeEvt, evCopy, biCopy) }, 400) }}
                          onTouchEnd={() => clearTimeout(eventLongPressTimer.current)}
                          onTouchMove={() => clearTimeout(eventLongPressTimer.current)}
                          onClick={e => { e.stopPropagation(); if (!drag) setModal({ open: true, eventId: ev.id, isNew: false }) }}>
                          {/* Barber color indicator — left glow strip */}
                          <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: barbers[bi]?.color || 'rgba(255,255,255,.3)', boxShadow: `0 0 8px ${barbers[bi]?.color || 'transparent'}`, opacity: 0.7 }} />
                          {tinyCol ? (<>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ fontWeight: 900, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{ev.clientName.split(' ')[0]}</span>
                              {(() => { const cs = ev._raw?.client_status || (ev.status === 'noshow' ? 'at_risk' : ''); const m: Record<string,{l:string,c:string,bg:string}> = { vip:{l:'V',c:'#ffd700',bg:'rgba(255,215,0,.25)'}, active:{l:'A',c:'rgba(130,220,170,.8)',bg:'rgba(143,240,177,.20)'}, new:{l:'N',c:'#7abaff',bg:'rgba(255,255,255,.06)'}, at_risk:{l:'!',c:'#ff6b6b',bg:'rgba(255,107,107,.25)'}, risk:{l:'!',c:'#ff6b6b',bg:'rgba(255,107,107,.25)'} }; const b = m[cs]; return b ? <span style={{ fontSize: 7, fontWeight: 900, color: b.c, background: b.bg, borderRadius: 3, padding: '0 2px', lineHeight: '11px', flexShrink: 0 }}>{b.l}</span> : null })()}
                            </div>
                            {height > 24 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{minToAMPM(ev.startMin)}</div>}
                            {height > 36 && ev.serviceName && ev.serviceName !== 'Service' && <div style={{ fontSize: 7, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.serviceName.split(' + ')[0]}</div>}
                            {height > 36 && <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                              {ev.paid && <span style={{ fontSize: 6, color: 'rgba(143,240,177,.70)', fontWeight: 700 }}>✓</span>}
                              {(ev._raw?.has_reference_photo || ev._raw?.reference_photo_url || ev._raw?.client_photo || ev._raw?.haircut_photo || ev._raw?.photo_url || ev._raw?.attachment_url) && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#7abaff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>}
                              {ev.notes && ev.notes.replace(/Reference photo attached on website:\s*\S+/gi, '').trim() && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#ffd18a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                            </div>}
                          </>) : (<>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>{ev.clientName}{(() => { const cs = ev._raw?.client_status; const badges: Record<string,{label:string,color:string,bg:string,border:string}> = { vip:{label:'VIP',color:'#ffd700',bg:'rgba(255,215,0,.18)',border:'rgba(255,215,0,.35)'}, active:{label:'ACTIVE',color:'rgba(130,220,170,.8)',bg:'rgba(143,240,177,.14)',border:'rgba(143,240,177,.30)'}, new:{label:'NEW',color:'#7abaff',bg:'rgba(255,255,255,.05)',border:'rgba(255,255,255,.08)'}, at_risk:{label:'RISK',color:'#ff6b6b',bg:'rgba(255,107,107,.18)',border:'rgba(255,107,107,.35)'} }; const b = badges[cs] || badges[(cs === 'risk' ? 'at_risk' : '')]; return b ? <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '.04em', color: b.color, background: b.bg, border: `1px solid ${b.border}`, borderRadius: 4, padding: '1px 4px', lineHeight: '12px', flexShrink: 0 }}>{b.label}</span> : null })()}</div>
                            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                              {ev._raw?.booking_type === 'membership' && <Chip label="Member" type="arrived" />}
                              {ev._raw?.booking_type === 'model' && <Chip label="Model" type="model" />}
                              {ev._raw?.booking_type === 'training' && <Chip label="Training" type="model" />}
                              {(ev._raw?.booking_type === 'model' || ev._raw?.booking_type === 'training') ? (
                                ev.status === 'completed' || ev.status === 'done'
                                  ? <Chip label="✓ Done" type="paid" />
                                  : <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (ev._raw?.id) { apiFetch('/api/bookings/'+encodeURIComponent(String(ev._raw.id)),{method:'PATCH',body:JSON.stringify({status:'completed'})}).then(()=>setEvents(prev=>prev.map(x=>x.id===ev.id?{...x,status:'completed'}:x))).catch(console.warn) } else { setEvents(prev=>prev.map(x=>x.id===ev.id?{...x,status:'completed'}:x)) } }} style={{ height: 20, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'inherit' }}>Mark done</button>
                              ) : (
                                ev.paid ? <>{ev.tipAmount != null && ev.tipAmount > 0 && <Chip label={`$${ev.tipAmount.toFixed(0)} tip`} type="paid" />}<Chip label="Paid" type="paid" /></> : <Chip label={ev.status} type={ev.status} />
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: 2, fontSize: height > 40 ? 11 : 9, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                            <span>{minToAMPM(ev.startMin)}</span>
                            {ev.serviceName && ev.serviceName !== 'Service' && <span style={{ color: 'rgba(255,255,255,.40)' }}> · {ev.serviceName}</span>}
                          </div>
                          {/* Photo & notes indicators — below service */}
                          {height > 50 && ((ev._raw?.has_reference_photo || ev._raw?.reference_photo_url || ev._raw?.client_photo || ev._raw?.haircut_photo || ev._raw?.photo_url || ev._raw?.attachment_url) || (ev.notes && ev.notes.replace(/Reference photo attached on website:\s*\S+/gi, '').trim())) && (
                            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                              {(ev._raw?.has_reference_photo || ev._raw?.reference_photo_url || ev._raw?.client_photo || ev._raw?.haircut_photo || ev._raw?.photo_url || ev._raw?.attachment_url) && (
                                <span title="Has reference photo" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 5, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7abaff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                                </span>
                              )}
                              {ev.notes && ev.notes.replace(/Reference photo attached on website:\s*\S+/gi, '').trim() && (
                                <span title="Has notes" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 5, background: 'rgba(255,207,63,.14)', border: '1px solid rgba(255,207,63,.25)', flexShrink: 0 }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffd18a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                </span>
                              )}
                            </div>
                          )}
                          </>)}
                        </div>
                      )
                    })}
                    {/* Pending block request ghosts */}
                    {pendingBlockRequests.filter(r => (r.data?.barberId || r.data?.barber_id) === barber.id).map((r, ri) => {
                      const reqStartMin = Number(r.data?.startMin || 0)
                      const reqDur = Number(r.data?.duration || 30)
                      if (!reqStartMin) return null
                      const top = minToY(reqStartMin)
                      const height = Math.max(24, (reqDur / 5) * slotH) - 2
                      return (
                        <div key={`pblock-${r.id}`} className="block-pending-pulse" style={{ position: 'absolute', left: 4, right: 4, top, height, borderRadius: 10, zIndex: 3, padding: '5px 8px', overflow: 'hidden', pointerEvents: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,107,.80)" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'rgba(255,107,107,.85)', fontWeight: 900 }}>Pending {minToAMPM(reqStartMin)}–{minToAMPM(reqStartMin + reqDur)}</span>
                          </div>
                        </div>
                      )
                    })}
                    {/* Waitlist ghost entries */}
                    {!isStudent && waitlistEntries.filter(w => w.barber_id === barber.id).map((w, wi) => {
                      // Place at first available slot for this barber
                      const dur = w.duration_minutes || 30
                      // Find a free slot in working hours
                      const wh = (workHours as any)[barber.id]
                      if (!wh || wh.dayOff) return null
                      const prefStart = Number(w.preferred_start_min || wh.startMin)
                      const prefEnd = Number(w.preferred_end_min || wh.endMin)
                      const startSearch = Math.max(wh.startMin, prefStart)
                      const endSearch = Math.min(wh.endMin, prefEnd)
                      let slotMin = -1
                      for (let m = startSearch; m <= endSearch - dur; m += 5) {
                        const hasConflict = colEvents.some(e => {
                          const eEnd = e.startMin + e.durMin
                          return m < eEnd && (m + dur) > e.startMin
                        })
                        if (!hasConflict) { slotMin = m; break }
                      }
                      if (slotMin < 0) return null
                      const top = minToY(slotMin)
                      const height = Math.max(24, (dur / 5) * slotH) - 2
                      return (
                        <div key={`wl-${w.id}`} className="wl-ghost-pulse" style={{ position: 'absolute', left: 8, right: 8, top, height, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', zIndex: 3, padding: '6px 10px', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 0 12px rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.05)' }}
                          onClick={() => setWlConfirm({ w, barberId: barber.id, barberName: barber.name, slotMin, dur })}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#bfe0ff' }}>{w.client_name || 'Waitlist'}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 1 }}>{minToAMPM(slotMin)} · {dur}min · {prefStart !== wh.startMin || prefEnd !== wh.endMin ? `${minToAMPM(prefStart)}-${minToAMPM(prefEnd)}` : 'WAITLIST'}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
          )
        })()}

        {/* Bottom date dots — Apple-style pill for current day */}
        {(() => {
          const dots: { date: Date; day: number; label: string; dayName: string; isCurrent: boolean; isToday: boolean }[] = []
          for (let i = -3; i <= 3; i++) {
            const d = new Date(anchor); d.setDate(d.getDate() + i)
            const today = new Date(); today.setHours(0,0,0,0)
            const dNorm = new Date(d); dNorm.setHours(0,0,0,0)
            dots.push({
              date: d,
              day: d.getDate(),
              label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
              isCurrent: i === 0,
              isToday: dNorm.getTime() === today.getTime(),
            })
          }
          return (
            <>
            {/* Date dots + Gear/Plus — all portaled to body so they escape .content stacking context */}
            {typeof document !== 'undefined' && createPortal(
            <div className="date-dot-wrap" style={{ position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, padding: '3px 0', pointerEvents: 'auto' }}>
              {dots.slice(1, -1).map((dot, i, arr) => {
                const distFromCenter = Math.abs(i - Math.floor(arr.length / 2))
                const dotSize = dot.isCurrent ? 0 : distFromCenter <= 0 ? 22 : distFromCenter === 1 ? 18 : 15
                const fontSize = dot.isCurrent ? 9 : distFromCenter <= 0 ? 9 : distFromCenter === 1 ? 8 : 7
                return (
                <button key={dot.day + '-' + dot.date.getMonth()}
                  className={`date-dot${dot.isCurrent ? ' date-dot-current' : ''}`}
                  onClick={() => {
                    if (dot.isCurrent) { setDatePickerOpen(true); return }
                    if (dayTransition !== 'idle') return
                    setDayTransition('out')
                    const targetDate = new Date(dot.date); targetDate.setHours(0,0,0,0)
                    setTimeout(() => { setAnchor(targetDate); setDayTransition('in'); setTimeout(() => setDayTransition('idle'), 220) }, 180)
                  }}
                  style={{
                    height: dot.isCurrent ? 20 : dotSize,
                    padding: dot.isCurrent ? '0 8px' : '0',
                    width: dot.isCurrent ? 'auto' : dotSize,
                    minWidth: dot.isCurrent ? 'auto' : dotSize,
                    borderRadius: 999,
                    border: dot.isCurrent ? '1px solid rgba(255,255,255,.12)' : 'none',
                    background: dot.isCurrent ? 'rgba(0,0,0,.95)' : dot.isToday ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.10)',
                    color: dot.isCurrent ? 'rgba(255,255,255,.75)' : dot.isToday ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.40)',
                    cursor: 'pointer',
                    fontWeight: dot.isCurrent ? 700 : 600,
                    fontSize,
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}>
                  {dot.isCurrent ? <span>{dot.dayName} {dot.day}</span> : <span>{dot.day}</span>}
                </button>
              )})}
            </div>, document.body)}
            {/* Gear left + Plus right — portaled to body */}
            {typeof document !== 'undefined' && createPortal(
            <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 10002, padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
              <button onClick={() => setSettingsOpen(true)} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'transparent', color: 'rgba(255,255,255,.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              <button onClick={() => {
                if (isStudent) {
                  const freeSlots: { min: number; mentorId: string; mentorName: string }[] = []
                  for (let m = START_HOUR * 60; m <= END_HOUR * 60 - 90; m += 5) {
                    const mid = studentSlotMentorMap.get(m)
                    if (!mid) continue
                    let ok = true
                    for (let c = m; c < m + 90; c += 5) { if (!studentSlotMentorMap.has(c)) { ok = false; break } }
                    if (ok) {
                      const mentor = barbers.find(b => b.id === mid)
                      if (!freeSlots.length || freeSlots[freeSlots.length-1].min + 5 < m || freeSlots[freeSlots.length-1].mentorId !== mid) {
                        freeSlots.push({ min: m, mentorId: mid, mentorName: mentor?.name || '' })
                      }
                    }
                  }
                  if (!freeSlots.length) { showToast('No free 90min slot available today'); return }
                  setSlotPicker(freeSlots)
                } else {
                  openCreate(isBarber ? myBarberId : (barbers[0]?.id || ''), clamp(new Date().getHours()*60))
                }
              }} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'transparent', color: 'rgba(255,255,255,.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>, document.body)}
          </>
          )
        })()}

        {loading && dayTransition === 'idle' && !isMobile && <div style={{ position: 'fixed', bottom: 20, right: 20, padding: '8px 16px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)', color: 'rgba(130,150,220,.6)', fontSize: 12, zIndex: 99 }}>Loading…</div>}
      </div>

      {/* Context menu */}
      {contextMenu && (() => {
        const cmBarber = barbers.find(b=>b.id===contextMenu.barberId)
        const hasStudents = studentUsers.some(s => s.mentorIds.includes(contextMenu.barberId))
        const cmItems = [
          { label: 'Booking', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.6)" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>, bg: 'rgba(255,255,255,.05)', brd: 'rgba(255,255,255,.08)', col: 'rgba(130,150,220,.6)', fn: () => { setContextMenu(null); openCreate(contextMenu.barberId, contextMenu.min) } },
          ...(hasStudents ? [{
            label: 'Training', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(180,140,220,.6)" strokeWidth="2.2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>, bg: 'rgba(168,107,255,.18)', brd: 'rgba(168,107,255,.35)', col: 'rgba(180,140,220,.6)', fn: () => { setContextMenu(null); setTrainingModal({ barberId: contextMenu.barberId, barberName: cmBarber?.name || '', min: contextMenu.min }) }
          }] : []),
        ]
        // Clamp position to screen
        const top = Math.max(8, Math.min(contextMenu.y - 24, window.innerHeight - 120))
        const left = Math.max(8, Math.min(contextMenu.x - 90, window.innerWidth - 200))
        return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,.25)' }} onClick={() => setContextMenu(null)}>
          <div style={{ position: 'fixed', left, top, zIndex: 151, borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.80)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 16px 40px rgba(0,0,0,.65), inset 0 0 0 0.5px rgba(255,255,255,.06)', padding: '10px 10px 8px', fontFamily: 'Inter,sans-serif' }} onClick={e => e.stopPropagation()}>
            {/* Time + barber */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{minToAMPM(contextMenu.min)}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{cmBarber?.name}</span>
            </div>
            {/* Buttons in a row */}
            <div style={{ display: 'flex', gap: 4 }}>
              {cmItems.map(item => (
                <button key={item.label} onClick={item.fn} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 6px', borderRadius: 10, border: `1px solid ${item.brd}`, background: item.bg, color: item.col, cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Drag confirm */}
      {dragConfirm && (() => {
        const ev = events.find(e => e.id === dragConfirm.eventId); if (!ev) return null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ width: 'min(380px,92vw)', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.55), inset 0 0 0 0.5px rgba(255,255,255,.06)', padding: 20, color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13, color: 'rgba(255,255,255,.70)', marginBottom: 14 }}>Move booking</div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{dragConfirm.newBarberName}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{minToAMPM(dragConfirm.newMin)}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)' }}>{ev.clientName} · {ev.serviceName}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDragConfirm(null)} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
                <button onClick={confirmDragMove} style={{ height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.05)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13 }}>Move</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Block confirm dialog */}
      {blockConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.50)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setBlockConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(340px,88vw)', borderRadius: 22, border: `1px solid ${blockConfirm.action === 'delete' ? 'rgba(255,107,107,.20)' : 'rgba(255,107,107,.15)'}`, background: 'rgba(8,8,8,.75)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60), inset 0 0 0 0.5px rgba(255,255,255,.06)', padding: '22px 20px', color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: blockConfirm.action === 'delete' ? 'rgba(255,107,107,.10)' : 'rgba(255,107,107,.08)', border: `1px solid ${blockConfirm.action === 'delete' ? 'rgba(255,107,107,.25)' : 'rgba(255,107,107,.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={blockConfirm.action === 'delete' ? 'rgba(255,107,107,.80)' : 'rgba(255,107,107,.65)'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontFamily: '"Inter",sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 13, marginBottom: 8 }}>
              {blockConfirm.action === 'delete' ? 'Remove Block' : 'Block Time'}
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '.02em' }}>
                {minToAMPM(blockConfirm.startMin)} – {minToAMPM(blockConfirm.endMin)}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.40)', marginTop: 4 }}>{blockConfirm.endMin - blockConfirm.startMin} minutes</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setBlockConfirm(null)} style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.65)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => {
                if (blockConfirm.action === 'create') { openCreateBlock(blockConfirm.barberId, blockConfirm.startMin, blockConfirm.endMin - blockConfirm.startMin) }
                else { if (blockConfirm.evId) setEvents(prev => prev.filter(x => x.id !== blockConfirm.evId)); if (blockConfirm.rawId) apiFetch('/api/bookings/' + encodeURIComponent(blockConfirm.rawId), { method: 'DELETE' }).catch(console.warn); showToast('Block removed') }
                setBlockConfirm(null)
              }} style={{ flex: 1, height: 44, borderRadius: 14, border: `1px solid ${blockConfirm.action === 'delete' ? 'rgba(255,107,107,.50)' : 'rgba(255,107,107,.40)'}`, background: blockConfirm.action === 'delete' ? 'rgba(255,107,107,.12)' : 'rgba(255,107,107,.08)', color: blockConfirm.action === 'delete' ? 'rgba(220,130,160,.5)' : '#ffb0b0', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit' }}>
                {blockConfirm.action === 'delete' ? 'Remove' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training modal */}
      {trainingModal && (() => {
        const barberStudents = studentUsers.filter(s => s.mentorIds.includes(trainingModal!.barberId))
        const TRAINING_TYPES = [
          { value: 'model', label: 'Model haircut', durMin: 90 },
          { value: 'beard', label: 'Beard training', durMin: 90 },
          { value: 'head', label: 'Head training', durMin: 90 },
          { value: 'beard_head', label: 'Beard + Head', durMin: 90 },
          { value: 'theory', label: 'Theory', durMin: 60 },
        ]
        function TrainingForm() {
          const [studentId, setStudentId] = React.useState(barberStudents[0]?.id || '')
          const [trainingType, setTrainingType] = React.useState('model')
          const [tNotes, setTNotes] = React.useState('')
          const [tSaving, setTSaving] = React.useState(false)
          const tt = TRAINING_TYPES.find(t => t.value === trainingType) || TRAINING_TYPES[0]
          const student = barberStudents.find(s => s.id === studentId)
          async function saveTraining() {
            if (!studentId || !student || !trainingModal) return
            setTSaving(true)
            const clientName = `Training · ${student.name} · ${tt.label}`
            const startAt = new Date(todayStr + 'T' + minToHHMM(trainingModal!.min) + ':00')
            const endAt = new Date(startAt.getTime() + tt.durMin * 60000)
            const id = uid()
            setEvents(prev => [...prev, { id, type: 'booking' as const, barberId: trainingModal!.barberId, barberName: trainingModal!.barberName, clientName, clientPhone: '', serviceId: '', serviceName: tt.label, date: todayStr, startMin: clamp(trainingModal!.min), durMin: tt.durMin, status: 'model', paid: false, notes: tNotes, _raw: { booking_type: 'training', student_id: studentId, training_type: trainingType } }])
            try {
              const res = await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify({ barber_id: trainingModal!.barberId, client_name: clientName, start_at: startAt.toISOString(), end_at: endAt.toISOString(), notes: tNotes || tt.label, status: 'booked', booking_type: 'training', student_id: studentId, training_type: trainingType }) })
              const savedId = res?.id || res?.booking?.id
              if (savedId) setEvents(prev => prev.map((e: any) => e.id === id ? { ...e, _raw: { ...e._raw, id: savedId }, id: String(savedId) } : e))
            } catch (e: any) { console.warn('training save:', e.message) }
            setTSaving(false); setTrainingModal(null)
          }
          const mInp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
          const mLbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)' }}>
                  <div style={{ ...mLbl, marginBottom: 2 }}>Time</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{minToAMPM(trainingModal!.min)} — {minToAMPM(trainingModal!.min + tt.durMin)}</div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)' }}>
                  <div style={{ ...mLbl, marginBottom: 2 }}>Duration</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{tt.durMin} min</div>
                </div>
              </div>
              {barberStudents.length > 1 && (
                <div>
                  <label style={mLbl}>Student</label>
                  <select value={studentId} onChange={e => setStudentId(e.target.value)} style={mInp}>
                    {barberStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={mLbl}>Training type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {TRAINING_TYPES.map(t => (
                    <button key={t.value} onClick={() => setTrainingType(t.value)}
                      style={{ height: 36, padding: '0 14px', borderRadius: 999, border: `1px solid ${trainingType === t.value ? 'rgba(168,107,255,.65)' : 'rgba(255,255,255,.12)'}`, background: trainingType === t.value ? 'rgba(168,107,255,.16)' : 'rgba(255,255,255,.04)', color: trainingType === t.value ? 'rgba(180,140,220,.6)' : 'rgba(255,255,255,.65)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={mLbl}>Notes</label>
                <textarea value={tNotes} onChange={e => setTNotes(e.target.value)} placeholder="Lesson details…" rows={2}
                  style={{ ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setTrainingModal(null)} style={{ height: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
                <button onClick={saveTraining} disabled={tSaving || !studentId} style={{ height: 42, padding: '0 20px', borderRadius: 999, border: '1px solid rgba(168,107,255,.55)', background: 'rgba(168,107,255,.18)', color: 'rgba(180,140,220,.6)', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13, opacity: tSaving ? .5 : 1 }}>
                  {tSaving ? 'Saving…' : 'Schedule training'}
                </button>
              </div>
            </div>
          )
        }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setTrainingModal(null) }}>
            <div style={{ width: 'min(480px,100%)', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60), inset 0 0 0 0.5px rgba(255,255,255,.07)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>Schedule training</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 3, letterSpacing: '.08em' }}>{todayStr} · {trainingModal!.barberName}</div>
                </div>
                <button onClick={() => setTrainingModal(null)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
              </div>
              <div style={{ padding: '16px 20px 20px' }}>
                <TrainingForm />
              </div>
            </div>
          </div>
        )
      })()}

      {/* Date picker */}
      {/* Schedule change confirm */}
      {scheduleConfirm && (() => {
        const { barberId, barberName, dow, startMin, endMin } = scheduleConfirm
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        const dayName = dayNames[dow]
        const fmt = minToAMPM
        async function confirm() {
          setScheduleConfirm(null)
          try {
            // Barber sends request instead of direct save
            if (isBarber && !isOwnerOrAdmin) {
              // Build per-day schedule with the change applied
              const barber = barbers.find(b => b.id === barberId)
              const rawSched = barber?.schedule || barber?.work_schedule
              const baseSched = Array.isArray(rawSched) ? rawSched :
                (rawSched?.perDay ? rawSched.perDay :
                  Array.from({length:7}, (_, i) => ({
                    enabled: rawSched?.days ? rawSched.days.includes(i) : i !== 0,
                    startMin: rawSched?.startMin ?? 10*60,
                    endMin: rawSched?.endMin ?? 20*60
                  })))
              const newSched = baseSched.map((d: any, i: number) => i === dow ? { enabled: true, startMin, endMin } : {
                enabled: d.enabled !== false,
                startMin: d.startMin ?? 600,
                endMin: d.endMin ?? 1200,
              })
              const enabledDays = newSched.map((d: any, i: number) => d.enabled ? i : -1).filter((i: number) => i >= 0)
              const enabledScheds = newSched.filter((d: any) => d.enabled)
              const globalStart = enabledScheds.length ? Math.min(...enabledScheds.map((d: any) => d.startMin)) : startMin
              const globalEnd = enabledScheds.length ? Math.max(...enabledScheds.map((d: any) => d.endMin)) : endMin

              await apiFetch('/api/requests', { method: 'POST', body: JSON.stringify({
                type: 'schedule_change',
                data: {
                  barberName, barberId, dayName, dow,
                  startTime: fmt(startMin), endTime: fmt(endMin),
                  startMin, endMin,
                  // Full per-day schedule for backend to apply on approve
                  schedule: { startMin: globalStart, endMin: globalEnd, days: enabledDays, perDay: newSched },
                  work_schedule: { startMin: globalStart, endMin: globalEnd, days: enabledDays, perDay: newSched },
                }
              })})
              showToast('Schedule change request sent for approval')
              loadBarbers().then(list => setBarbers(list))
              return
            }
            // Save as one-time override for today's date only (not permanent)
            await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}/schedule-override`, {
              method: 'PATCH',
              body: JSON.stringify({ date: todayStr, startMin, endMin, enabled: true })
            })
            showToast('Schedule updated for today')
            loadBarbers().then(list => setBarbers(list))
          } catch(e) { console.warn('Schedule save error:', e) }
        }
        function cancel() {
          // Revert visual change
          setScheduleConfirm(null)
          loadBarbers().then(list => setBarbers(list))
        }
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
            <div style={{ width:'min(360px,92vw)', borderRadius:22, border:'1px solid rgba(255,255,255,.10)', background:'rgba(0,0,0,.65)', backdropFilter:'saturate(180%) blur(40px)', WebkitBackdropFilter:'saturate(180%) blur(40px)', boxShadow:'0 32px 80px rgba(0,0,0,.55)', padding:22, color:'#e8e8ed', fontFamily:'Inter,sans-serif' }}>
              <div style={{ fontFamily:'"Inter",sans-serif', letterSpacing:'.16em', textTransform:'uppercase', fontSize:13, marginBottom:14 }}>{isBarber && !isOwnerOrAdmin ? 'Request schedule change' : 'Update schedule'}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.70)', lineHeight:1.6, marginBottom:18 }}>
                {isBarber && !isOwnerOrAdmin ? 'Request to change' : 'Change'} <span style={{ color:'#fff', fontWeight:700 }}>{barberName}</span>'s schedule for <span style={{ color:'#fff', fontWeight:700 }}>{dayName}, {new Date(todayStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> to:
                <div style={{ marginTop:10, fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'.04em' }}>
                  {fmt(startMin)} — {fmt(endMin)}
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={cancel} style={{ flex:1, height:42, borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.70)', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>Cancel</button>
                <button onClick={confirm} style={{ flex:1, height:42, borderRadius:12, border:'1px solid rgba(255,255,255,.22)', background:'rgba(255,255,255,.12)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>{isBarber && !isOwnerOrAdmin ? 'Send request' : 'Save'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {datePickerOpen && <DatePickerModal current={anchor} onSelect={d => { const x=new Date(d); x.setHours(0,0,0,0); setAnchor(x) }} onClose={() => setDatePickerOpen(false)} />}

      {/* Settings */}
      {settingsOpen && <SettingsModal barbers={barbers} services={services} onClose={() => setSettingsOpen(false)} onReload={reloadAll}
        isStudent={isStudent} isBarber={isBarber} myBarberId={myBarberId}
        studentSchedule={studentSchedule} onStudentScheduleChange={(s: DaySchedule[]) => {
          setStudentSchedule(s); localStorage.setItem('VB_STUDENT_SCHEDULE', JSON.stringify(s))
          // Save to user profile
          const uid = currentUser?.uid; if (uid) apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ schedule: s }) }).catch(() => {})
        }} />}

      {/* Booking modal */}
      {modal.open && (
        <BookingModal
          isOpen={modal.open}
          barberId={selectedEvent?.barberId || barbers[0]?.id || ''}
          barberName={selectedEvent?.barberName || barbers[0]?.name || ''}
          date={selectedEvent?.date || todayStr}
          startMin={selectedEvent?.startMin || 9*60}
          barbers={barbers} services={services}
          isOwnerOrAdmin={isOwnerOrAdmin} myBarberId={myBarberId}
          isStudent={isStudent} mentorBarberIds={mentorBarberIds}
          existingEvent={selectedEvent ? { id: selectedEvent.id, clientName: selectedEvent.clientName, clientPhone: selectedEvent.clientPhone, serviceId: selectedEvent.serviceId, serviceIds: selectedEvent.serviceIds, status: selectedEvent.status, notes: selectedEvent.notes, paid: selectedEvent.paid, paymentMethod: selectedEvent.paymentMethod, isModelEvent: selectedEvent._raw?.booking_type === 'model' || selectedEvent._raw?.booking_type === 'training', hasReferencePhoto: !!(selectedEvent._raw?.has_reference_photo), backendId: selectedEvent._raw?.id ? String(selectedEvent._raw.id) : '', photoUrl: (() => {
              const r = selectedEvent._raw
              return r?.reference_photo_url || r?.photo_url || r?.client_photo || r?.client_photo_url || r?.attachment_url || r?.image_url || r?.photo || r?.haircut_photo || r?.style_photo || ''
            })(), _raw: { ...selectedEvent._raw, start_min: selectedEvent.startMin, date: selectedEvent.date } } : null}
          allEvents={events.map((e: any) => ({ id: e.id, barberId: e.barberId, startMin: e.startMin, durMin: e.durMin, status: e.status, paid: e.paid, clientName: e.clientName, date: e.date, paymentStatus: (e._raw as any)?.payment_status || '' }))}
          onClose={() => { if (modal.isNew) setEvents(prev => prev.filter(e => e.id !== modal.eventId)); setModal({ open: false, eventId: null, isNew: false }) }}
          terminalEnabled={terminalEnabled}
          onSave={handleSave} onDelete={handleDelete} onPayment={handlePayment}
          onOpenEvent={(eventId) => { setModal({ open: false, eventId: null, isNew: false }); setTimeout(() => setModal({ open: true, eventId, isNew: false }), 100) }}
        />
      )}

      {/* Slot picker for student */}
      {slotPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSlotPicker(null) }}>
          <div style={{ width: 'min(400px,100%)', maxHeight: 'min(600px,80vh)', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60), inset 0 0 0 0.5px rgba(255,255,255,.07)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>Available slots</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 3 }}>{slotPicker.length} free 90min slots today</div>
              </div>
              <button onClick={() => setSlotPicker(null)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {slotPicker.map((slot, i) => (
                <button key={i} onClick={() => { setSlotPicker(null); openCreate(slot.mentorId, slot.min) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', cursor: 'pointer', color: '#e8e8ed', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(168,107,255,.12)')} onMouseLeave={e => (e.currentTarget.style.background='rgba(255,255,255,.04)')}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{minToAMPM(slot.min)} — {minToAMPM(slot.min + 90)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>with {slot.mentorName}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(168,107,255,.80)', fontWeight: 700 }}>90 min</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Block duration / resize modal */}
      {blockModal && (() => {
        const bm = blockModal
        const isCreate = bm.type === 'create'
        const isResizeConfirm = bm.type === 'resize_confirm'
        const isOwnerResize = bm.type === 'owner_resize'
        const submitBlock = async () => {
          if (isCreate) {
            const dur = Math.max(5, Math.round(Number(blockDurInput) / 5) * 5) || 30
            await confirmCreateBlock(bm.barberId, bm.startMin, dur)
            return
          } else if (isResizeConfirm) {
            const sa = new Date(todayStr + 'T' + minToHHMM(bm.startMin) + ':00')
            if (bm.evId) setEvents(prev => prev.map(x => x.id === bm.evId ? { ...x, durMin: bm.currentDur, _pendingResize: true, _approvedDur: bm.originalDur } as any : x))
            apiFetch('/api/requests', { method: 'POST', body: JSON.stringify({ type: 'block_time', data: { barberId: bm.barberId, date: todayStr, startMin: bm.startMin, duration: bm.currentDur, startAt: sa.toISOString(), endAt: new Date(sa.getTime() + bm.currentDur * 60000).toISOString(), bookingId: bm.rawId, originalDur: bm.originalDur } }) }).then(() => { showToast('Resize request sent'); loadPendingBlocks() }).catch(console.warn)
          } else if (isOwnerResize) {
            const sa = new Date(todayStr + 'T' + minToHHMM(bm.startMin) + ':00')
            if (bm.evId) setEvents(prev => prev.map(x => x.id === bm.evId ? { ...x, durMin: bm.currentDur } : x))
            apiFetch('/api/bookings/' + encodeURIComponent(String(bm.rawId)), { method: 'PATCH', body: JSON.stringify({ end_at: new Date(sa.getTime() + bm.currentDur * 60000).toISOString() }) }).catch(console.warn)
          }
          setBlockModal(null)
        }
        const accentColor = isResizeConfirm ? 'rgba(255,107,107,' : (isOwnerResize ? 'rgba(255,255,255,' : 'rgba(255,107,107,')
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) { if (bm.evId && (isResizeConfirm || isOwnerResize)) setEvents(prev => prev.map(x => x.id === bm.evId ? { ...x, durMin: bm.originalDur } : x)); setBlockModal(null) } }}>
            <div style={{ width: 'min(380px,92vw)', borderRadius: 22, border: `1px solid ${accentColor}.25)`, background: 'rgba(0,0,0,.80)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60)', padding: '24px 22px', color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
              {/* Icon */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${accentColor}.10)`, border: `1px solid ${accentColor}.30)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isOwnerResize ? '#fff' : '#ff6b6b'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
              </div>
              {/* Title */}
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
                {isCreate ? 'Block Time' : 'Resize Block'}
              </div>

              {isCreate ? (<>
                {/* Create: duration picker */}
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', textAlign: 'center', marginBottom: 16 }}>Starting at {minToAMPM(bm.startMin)}</div>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 6 }}>Duration (minutes)</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    {[15, 30, 45, 60, 90, 120].map(d => (
                      <button key={d} onClick={() => setBlockDurInput(String(d))} style={{ height: 36, minWidth: 48, borderRadius: 10, border: `1px solid ${String(d) === blockDurInput ? 'rgba(255,107,107,.65)' : 'rgba(255,255,255,.14)'}`, background: String(d) === blockDurInput ? 'rgba(255,107,107,.15)' : 'rgba(255,255,255,.04)', color: String(d) === blockDurInput ? 'rgba(220,130,160,.5)' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>{d}</button>
                    ))}
                  </div>
                  <input type="number" value={blockDurInput} onChange={e => setBlockDurInput(e.target.value)} min={5} max={480} step={5} style={{ width: 80, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 900, outline: 'none', fontFamily: 'inherit' }} />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>{minToAMPM(bm.startMin)} — {minToAMPM(bm.startMin + (Number(blockDurInput) || 30))}</div>
                </div>
                {!isOwnerOrAdmin && <div style={{ fontSize: 11, color: 'rgba(255,107,107,.60)', textAlign: 'center', marginBottom: 16 }}>This will be sent for owner/admin approval</div>}
              </>) : (<>
                {/* Resize confirm: show old → new */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{minToAMPM(bm.startMin)} — {minToAMPM(bm.startMin + bm.currentDur)}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.50)' }}>{bm.originalDur}min → <span style={{ color: 'rgba(220,130,160,.5)', fontWeight: 700 }}>{bm.currentDur}min</span></div>
                </div>
                {isResizeConfirm && <div style={{ fontSize: 11, color: 'rgba(255,107,107,.60)', textAlign: 'center', marginBottom: 16 }}>Extended time will be sent for approval</div>}
              </>)}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { if (bm.evId && (isResizeConfirm || isOwnerResize)) setEvents(prev => prev.map(x => x.id === bm.evId ? { ...x, durMin: bm.originalDur } : x)); setBlockModal(null) }} style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
                <button onClick={submitBlock} style={{ flex: 2, height: 44, borderRadius: 999, border: `1px solid ${accentColor}.55)`, background: `${accentColor}.12)`, color: isOwnerResize ? '#fff' : 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13 }}>
                  {isCreate ? (isOwnerOrAdmin ? 'Block' : 'Request Block') : isResizeConfirm ? 'Send for Approval' : 'Confirm Resize'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pending block requests as ghost events in calendar */}

      {/* Waitlist confirm modal */}
      {wlConfirm && (() => {
        const { w, barberId, barberName, slotMin, dur } = wlConfirm
        const svcNames = Array.isArray(w.service_names) ? w.service_names : []
        async function doConfirm() {
          setWlConfirming(true)
          try {
            const startAt = new Date(todayStr + 'T' + minToHHMM(slotMin) + ':00')
            const endAt = new Date(startAt.getTime() + dur * 60000)
            const svcIds = Array.isArray(w.service_ids) ? w.service_ids : []
            await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify({
              barber_id: barberId, client_name: w.client_name || 'Waitlist client',
              client_phone: w.phone_raw || w.phone_norm || '',
              service_id: svcIds[0] || '', service_name: svcNames.join(', ') || 'Service',
              start_at: startAt.toISOString(), end_at: endAt.toISOString(),
              notes: 'From waitlist', source: 'waitlist',
            })})
            await apiFetch(`/api/waitlist/${encodeURIComponent(w.id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'confirm' }) })
            showToast(`${w.client_name || 'Client'} booked at ${minToAMPM(slotMin)}`)
            setWlConfirm(null); loadWaitlist(); reloadAll()
          } catch (e: any) { showToast('Error: ' + e.message) }
          setWlConfirming(false)
        }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget && !wlConfirming) setWlConfirm(null) }}>
            <div style={{ width: 'min(420px,92vw)', borderRadius: 22, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.70)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60), inset 0 0 0 0.5px rgba(255,255,255,.07)', padding: '24px 22px', color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
              {/* Icon */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7fbfff" strokeWidth="2" strokeLinecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 11 16 15 12"/></svg>
                </div>
              </div>
              {/* Title */}
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>Confirm from waitlist</div>
              {/* Details */}
              <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Client</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{w.client_name || 'Client'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Team Member</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{barberName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Time</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{minToAMPM(slotMin)} — {minToAMPM(slotMin + dur)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: svcNames.length ? 8 : 0 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Duration</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{dur} min</span>
                </div>
                {svcNames.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Service</span>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{svcNames.join(', ')}</span>
                  </div>
                )}
              </div>
              {/* Note */}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.40)', textAlign: 'center', marginBottom: 18 }}>This will create an appointment and remove from waitlist</div>
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setWlConfirm(null)} disabled={wlConfirming}
                  style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>
                  Cancel
                </button>
                <button onClick={doConfirm} disabled={wlConfirming}
                  style={{ flex: 2, height: 44, borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#bfe0ff', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13, opacity: wlConfirming ? .5 : 1 }}>
                  {wlConfirming ? 'Creating…' : 'Confirm & Book'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)', zIndex: 400, padding: '12px 24px', borderRadius: 16, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.80)', backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)', boxShadow: '0 12px 40px rgba(0,0,0,.50)', color: '#e8e8ed', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif', maxWidth: '90vw', textAlign: 'center', animation: 'slideUp .2s ease' }}
          onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </Shell>
  )
}
/* deploy 1774457169 */
