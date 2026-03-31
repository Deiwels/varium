'use client'
import { useRef, useState, useCallback, useEffect } from 'react'

interface ImageCropperProps {
  src: string
  onSave: (croppedDataUrl: string) => void
  onClose: () => void
  shape?: 'circle' | 'square'
}

const CROP_SIZE = 280
const OUTPUT_SIZE = 800
const MIN_SCALE = 1.0
const MAX_SCALE = 3.0

// ─── Adjustment slider row ───────────────────────────────────────────────────
function AdjustSlider({ label, value, min, max, step, onChange, icon }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; icon: React.ReactNode
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,.30)', fontVariantNumeric: 'tabular-nums' }}>{value > 0 && min < 0 ? '+' : ''}{value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', height: 3, appearance: 'none', WebkitAppearance: 'none', background: `linear-gradient(to right, rgba(255,255,255,.30) ${pct}%, rgba(255,255,255,.08) ${pct}%)`, borderRadius: 2, outline: 'none', cursor: 'pointer' }} />
      </div>
      <button onClick={() => onChange(min < 0 ? 0 : (min + max) / 2)} style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid rgba(255,255,255,.08)', background: 'transparent', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
    </div>
  )
}

// ─── Filter presets ──────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'fade', label: 'Fade' },
  { id: 'noir', label: 'Noir' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'dramatic', label: 'Drama' },
]

function getFilterCSS(id: string) {
  switch (id) {
    case 'bw': return 'grayscale(100%)'
    case 'sepia': return 'sepia(80%)'
    case 'vivid': return 'saturate(170%) contrast(110%)'
    case 'warm': return 'sepia(25%) saturate(130%) brightness(105%)'
    case 'cool': return 'saturate(80%) hue-rotate(15deg) brightness(105%)'
    case 'fade': return 'saturate(65%) brightness(115%) contrast(85%)'
    case 'noir': return 'grayscale(100%) contrast(140%) brightness(90%)'
    case 'chrome': return 'saturate(120%) contrast(120%) brightness(105%)'
    case 'dramatic': return 'contrast(150%) saturate(85%) brightness(90%)'
    default: return ''
  }
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const SunIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
const ContrastIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M12 2a10 10 0 0 1 0 20"/></svg>
const DropletIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
const ThermIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
const BlurIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" strokeDasharray="2 2"/><circle cx="12" cy="12" r="10" strokeDasharray="1 3"/></svg>
const SparkleIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

export default function ImageCropper({ src, onSave, onClose, shape = 'square' }: ImageCropperProps) {
  const [tab, setTab] = useState<'crop' | 'filter' | 'adjust'>('crop')
  const [scale, setScale] = useState(1.0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [dragging, setDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const [filter, setFilter] = useState('none')
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [warmth, setWarmth] = useState(0)
  const [sharpen, setSharpen] = useState(0)
  const [vignette, setVignette] = useState(0)
  const [rotation, setRotation] = useState(0)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const pinchStart = useRef({ dist: 0, scale: 1 })

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const fitted = fitImage(img.width, img.height, CROP_SIZE)
      setImgSize({ w: fitted.w, h: fitted.h })
      setOffset({ x: (CROP_SIZE - fitted.w) / 2, y: (CROP_SIZE - fitted.h) / 2 })
    }
    img.src = src
  }, [src])

  function fitImage(iw: number, ih: number, box: number) {
    const s = Math.max(box / iw, box / ih)
    return { w: Math.round(iw * s), h: Math.round(ih * s) }
  }

  const clamp = useCallback((ox: number, oy: number, s: number) => {
    const sw = imgSize.w * s, sh = imgSize.h * s
    return { x: Math.min(0, Math.max(CROP_SIZE - sw, ox)), y: Math.min(0, Math.max(CROP_SIZE - sh, oy)) }
  }, [imgSize])

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (tab !== 'crop') return
    e.preventDefault(); setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }, [offset, tab])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => { setOffset(clamp(dragStart.current.ox + e.clientX - dragStart.current.x, dragStart.current.oy + e.clientY - dragStart.current.y, scale)) }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, scale, clamp])

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (tab !== 'crop') return
    if (e.touches.length === 1) { const t = e.touches[0]; dragStart.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y } }
    else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; pinchStart.current = { dist: Math.hypot(dx, dy), scale } }
  }, [offset, scale, tab])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) { const t = e.touches[0]; setOffset(clamp(dragStart.current.ox + t.clientX - dragStart.current.x, dragStart.current.oy + t.clientY - dragStart.current.y, scale)) }
    else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStart.current.scale * (Math.hypot(dx, dy) / pinchStart.current.dist))); setScale(ns); setOffset(prev => clamp(prev.x, prev.y, ns)) }
  }, [scale, clamp])

  const handleScaleChange = useCallback((ns: number) => {
    setScale(ns)
    setOffset(prev => { const cx = (CROP_SIZE / 2 - prev.x) / (imgSize.w * scale), cy = (CROP_SIZE / 2 - prev.y) / (imgSize.h * scale); return clamp(CROP_SIZE / 2 - cx * imgSize.w * ns, CROP_SIZE / 2 - cy * imgSize.h * ns, ns) })
  }, [imgSize, scale, clamp])

  // Build combined CSS filter
  const combinedFilter = [
    getFilterCSS(filter),
    brightness !== 0 ? `brightness(${100 + brightness}%)` : '',
    contrast !== 0 ? `contrast(${100 + contrast}%)` : '',
    saturation !== 0 ? `saturate(${100 + saturation}%)` : '',
    warmth > 0 ? `sepia(${warmth}%)` : warmth < 0 ? `hue-rotate(${warmth * 0.5}deg)` : '',
  ].filter(Boolean).join(' ')

  // Save
  const handleSave = useCallback(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE; canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')!
      const fitted = fitImage(img.width, img.height, CROP_SIZE)
      const drawScale = scale * (fitted.w / img.width)
      const outScale = OUTPUT_SIZE / CROP_SIZE
      // Rotation
      if (rotation) { ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2); ctx.rotate((rotation * Math.PI) / 180); ctx.translate(-OUTPUT_SIZE / 2, -OUTPUT_SIZE / 2) }
      ctx.drawImage(img, 0, 0, img.width, img.height, offset.x * outScale, offset.y * outScale, img.width * drawScale * outScale, img.height * drawScale * outScale)
      // Apply filters via pixel manipulation (iOS Safari doesn't support ctx.filter)
      const hasFilter = filter !== 'none' || brightness !== 0 || contrast !== 0 || saturation !== 0 || warmth !== 0
      if (hasFilter) {
        try {
          const imageData = ctx.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
          const d = imageData.data
          const bFactor = (100 + brightness) / 100
          const cFactor = (100 + contrast) / 100
          const sFactor = (100 + saturation) / 100
          for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i+1], b = d[i+2]
            // Brightness
            if (brightness !== 0) { r *= bFactor; g *= bFactor; b *= bFactor }
            // Contrast
            if (contrast !== 0) { r = (r - 128) * cFactor + 128; g = (g - 128) * cFactor + 128; b = (b - 128) * cFactor + 128 }
            // Saturation
            if (saturation !== 0) { const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = gray + (r - gray) * sFactor; g = gray + (g - gray) * sFactor; b = gray + (b - gray) * sFactor }
            // Warmth
            if (warmth > 0) { const t = warmth / 100; const gray = 0.2126*r+0.7152*g+0.0722*b; r=r*(1-t*0.3)+gray*t*0.4+r*t*0.1; g=g*(1-t*0.1); b=b*(1-t*0.2) }
            else if (warmth < 0) { const t = -warmth / 100; b = b + (255-b)*t*0.15; r = r*(1-t*0.05) }
            // Filter presets
            if (filter === 'bw') { const gray = 0.2126*r+0.7152*g+0.0722*b; r=g=b=gray }
            else if (filter === 'sepia') { const gray = 0.2126*r+0.7152*g+0.0722*b; r=Math.min(255,gray*1.2+40); g=Math.min(255,gray*1.0+20); b=Math.min(255,gray*0.8) }
            else if (filter === 'contrast') { r=(r-128)*1.3+128; g=(g-128)*1.3+128; b=(b-128)*1.3+128 }
            else if (filter === 'warm') { r=Math.min(255,r*1.08); b=b*0.92 }
            else if (filter === 'cool') { b=Math.min(255,b*1.1); r=r*0.95 }
            d[i] = Math.max(0, Math.min(255, r))
            d[i+1] = Math.max(0, Math.min(255, g))
            d[i+2] = Math.max(0, Math.min(255, b))
          }
          ctx.putImageData(imageData, 0, 0)
        } catch (e) { console.warn('Filter apply error:', e) }
      }
      // Vignette
      if (vignette > 0) {
        const g = ctx.createRadialGradient(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE * 0.3, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE * 0.7)
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette / 100})`)
        ctx.fillStyle = g; ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      }
      let q = 0.85, out = canvas.toDataURL('image/jpeg', q)
      while (out.length > 900000 && q > 0.35) { q -= 0.08; out = canvas.toDataURL('image/jpeg', q) }
      onSave(out)
    }
    img.onerror = () => { console.warn('Image load failed for save'); onSave(src) }
    img.src = src
  }, [src, offset, scale, combinedFilter, rotation, vignette, onSave])

  function resetAll() {
    setBrightness(0); setContrast(0); setSaturation(0); setWarmth(0); setSharpen(0); setVignette(0); setFilter('none'); setRotation(0)
  }

  const cropBorder = shape === 'circle' ? '50%' : '16px'
  const TABS = [
    { id: 'crop' as const, label: 'Crop', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.13 1L6 16a2 2 0 002 2h15"/><path d="M1 6.13L16 6a2 2 0 012 2v15"/></svg> },
    { id: 'filter' as const, label: 'Filter', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> },
    { id: 'adjust' as const, label: 'Adjust', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.70)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, opacity: visible ? 1 : 0, transition: 'opacity .25s ease' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(400px, 100%)', maxHeight: '92vh', borderRadius: 24, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 0 0 0.5px rgba(255,255,255,.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transform: visible ? 'scale(1)' : 'scale(0.95)', transition: 'transform .25s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 11 }}>Edit Photo</div>
          <button onClick={handleSave} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(10,132,255,.50)', background: 'rgba(10,132,255,.12)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 11, fontFamily: 'inherit', boxShadow: '0 0 10px rgba(10,132,255,.15)' }}>Save</button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 10px', flexShrink: 0 }}>
          <div style={{ position: 'relative', width: CROP_SIZE, height: CROP_SIZE }}>
            <div onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => {}}
              style={{ width: CROP_SIZE, height: CROP_SIZE, overflow: 'hidden', borderRadius: cropBorder, cursor: tab === 'crop' ? (dragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none', position: 'relative', border: '2px solid rgba(255,255,255,.15)', boxShadow: '0 0 0 4000px rgba(0,0,0,.40)' }}>
              {imgSize.w > 0 && (
                <img src={src} alt="" draggable={false}
                  style={{ position: 'absolute', left: 0, top: 0, width: imgSize.w, height: imgSize.h, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', filter: combinedFilter || undefined }} />
              )}
              {vignette > 0 && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: cropBorder, background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${vignette / 100}) 100%)`, pointerEvents: 'none' }} />
              )}
            </div>
            {tab === 'crop' && <>
              <div style={{ position: 'absolute', top: '33.3%', left: 8, right: 8, height: 1, background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '66.6%', left: 8, right: 8, height: 1, background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: '33.3%', top: 8, bottom: 8, width: 1, background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: '66.6%', top: 8, bottom: 8, width: 1, background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
            </>}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px', justifyContent: 'center', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ height: 32, padding: '0 14px', borderRadius: 999, border: `1px solid ${tab === t.id ? 'rgba(10,132,255,.40)' : 'rgba(255,255,255,.08)'}`, background: tab === t.id ? 'rgba(10,132,255,.12)' : 'rgba(255,255,255,.03)', color: tab === t.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.45)', cursor: 'pointer', fontWeight: 800, fontSize: 10, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s ease' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px', minHeight: 0 }}>

          {/* CROP tab */}
          {tab === 'crop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <input type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.01} value={scale} onChange={e => handleScaleChange(parseFloat(e.target.value))}
                  style={{ flex: 1, height: 3, appearance: 'none', WebkitAppearance: 'none', background: `linear-gradient(to right, rgba(255,255,255,.30) ${((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100}%, rgba(255,255,255,.08) ${((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100}%)`, borderRadius: 2, outline: 'none', cursor: 'pointer' }} />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
              </div>
              {/* Rotate */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 90, 180, 270].map(deg => (
                  <button key={deg} onClick={() => setRotation(deg)}
                    style={{ flex: 1, height: 34, borderRadius: 10, border: `1px solid ${rotation === deg ? 'rgba(10,132,255,.40)' : 'rgba(255,255,255,.08)'}`, background: rotation === deg ? 'rgba(10,132,255,.10)' : 'rgba(255,255,255,.03)', color: rotation === deg ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.45)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                    {deg === 0 ? 'Original' : `${deg}°`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FILTER tab */}
          {tab === 'filter' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: 0, border: `2px solid ${filter === f.id ? 'rgba(10,132,255,.60)' : 'rgba(255,255,255,.06)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#000', position: 'relative', aspectRatio: '1', boxShadow: filter === f.id ? '0 0 10px rgba(10,132,255,.20)' : 'none', transition: 'all .2s ease' }}>
                  <img src={src} alt={f.label} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getFilterCSS(f.id) || 'none', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.75)', padding: '3px 0', fontSize: 7, fontWeight: 800, letterSpacing: '.06em', textAlign: 'center', color: filter === f.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)', textTransform: 'uppercase' }}>{f.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* ADJUST tab */}
          {tab === 'adjust' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AdjustSlider label="Brightness" value={brightness} min={-50} max={50} step={1} onChange={setBrightness} icon={SunIcon} />
              <AdjustSlider label="Contrast" value={contrast} min={-50} max={50} step={1} onChange={setContrast} icon={ContrastIcon} />
              <AdjustSlider label="Saturation" value={saturation} min={-100} max={100} step={1} onChange={setSaturation} icon={DropletIcon} />
              <AdjustSlider label="Warmth" value={warmth} min={-30} max={30} step={1} onChange={setWarmth} icon={ThermIcon} />
              <AdjustSlider label="Vignette" value={vignette} min={0} max={80} step={1} onChange={setVignette} icon={BlurIcon} />
              <AdjustSlider label="Sharpen" value={sharpen} min={0} max={100} step={1} onChange={setSharpen} icon={SparkleIcon} />
              <button onClick={resetAll} style={{ marginTop: 4, height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontWeight: 700, fontSize: 10, fontFamily: 'inherit', letterSpacing: '.06em', textTransform: 'uppercase' }}>Reset all</button>
            </div>
          )}
        </div>

        {/* Slider thumb styling */}
        <style>{`
          .image-cropper-root input[type=range]::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,.20);box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer; }
          .image-cropper-root input[type=range]::-moz-range-thumb { width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,.20);box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer; }
        `}</style>
      </div>
    </div>
  )
}
