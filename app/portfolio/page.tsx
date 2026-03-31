'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback, useRef } from 'react'

import { apiFetch } from '@/lib/api'

// ─── Photo Editor Modal (full-featured) ─────────────────────────────────────
type EditorTool = 'filter' | 'adjust' | 'draw' | 'dodge' | 'burn'

function PhotoEditor({ src, onSave, onClose }: { src: string; onSave: (dataUrl: string) => void; onClose: () => void }) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const [filter, setFilter] = useState('none')
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [tool, setTool] = useState<EditorTool>('filter')
  const [brushSize, setBrushSize] = useState(20)
  const [brushColor, setBrushColor] = useState('#ffffff')
  const [brushOpacity, setBrushOpacity] = useState(80)
  const [undoStack, setUndoStack] = useState<ImageData[]>([])
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const cw = useRef(0)
  const ch = useRef(0)

  const FILTERS = [
    { id: 'none', label: 'Original', css: '' },
    { id: 'bw', label: 'B&W', css: 'grayscale(100%)' },
    { id: 'sepia', label: 'Sepia', css: 'sepia(80%)' },
    { id: 'contrast', label: 'Contrast', css: 'contrast(130%) saturate(110%)' },
    { id: 'warm', label: 'Warm', css: 'sepia(25%) saturate(130%) brightness(105%)' },
    { id: 'cool', label: 'Cool', css: 'saturate(80%) hue-rotate(15deg) brightness(105%)' },
    { id: 'vivid', label: 'Vivid', css: 'saturate(160%) contrast(110%)' },
    { id: 'fade', label: 'Fade', css: 'saturate(70%) brightness(110%) contrast(90%)' },
  ]

  const COLORS = ['#ffffff','#000000','#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#af52de','#ff2d55','#8e8e93']

  const imgDataUrl = useRef<string>('')

  useEffect(() => {
    // Load image as data URL to guarantee clean (non-tainted) canvas on iOS
    async function loadImg() {
      try {
        let blob: Blob
        if (src.startsWith('data:')) {
          imgDataUrl.current = src
          const r = await fetch(src)
          blob = await r.blob()
        } else {
          const r = await fetch(src)
          blob = await r.blob()
          // Convert blob to data URL for guaranteed same-origin
          imgDataUrl.current = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        }
        const img = new Image()
        img.onload = () => {
          imgRef.current = img
          setTimeout(() => {
            const canvas = mainCanvasRef.current
            if (!canvas || !img.naturalWidth) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            const w = img.naturalWidth
            const h = img.naturalHeight
            canvas.width = w; canvas.height = h
            cw.current = w; ch.current = h
            ctx.drawImage(img, 0, 0)
            const dc = drawCanvasRef.current
            if (dc) { dc.width = w; dc.height = h }
          }, 50)
        }
        img.src = imgDataUrl.current
      } catch (e) {
        console.warn('Image load failed:', e)
        const img = new Image()
        img.onload = () => { imgRef.current = img; imgDataUrl.current = src; setTimeout(() => renderBase(), 100) }
        img.src = src
      }
    }
    loadImg()
  }, [src])

  // Build CSS filter string for live preview on canvas element
  const cssFilter = [
    FILTERS.find(f => f.id === filter)?.css || '',
    brightness !== 100 ? `brightness(${brightness}%)` : '',
    contrast !== 100 ? `contrast(${contrast}%)` : '',
    saturation !== 100 ? `saturate(${saturation}%)` : '',
  ].filter(Boolean).join(' ') || 'none'

  useEffect(() => { renderBase() }, [rotation])

  function renderBase() {
    const canvas = mainCanvasRef.current; const img = imgRef.current
    if (!canvas || !img || !img.naturalWidth) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rotated = rotation % 180 !== 0
    const w = rotated ? img.naturalHeight : img.naturalWidth
    const h = rotated ? img.naturalWidth : img.naturalHeight
    canvas.width = w; canvas.height = h; cw.current = w; ch.current = h
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()
    // Sync draw canvas size
    const dc = drawCanvasRef.current
    if (dc && (dc.width !== w || dc.height !== h)) {
      const oldData = (dc.width > 0 && dc.height > 0) ? dc.getContext('2d')?.getImageData(0, 0, dc.width, dc.height) : null
      dc.width = w; dc.height = h
      if (oldData) dc.getContext('2d')?.putImageData(oldData, 0, 0)
    }
  }

  function getCanvasPoint(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const dc = drawCanvasRef.current; if (!dc) return null
    const rect = dc.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY
    const scaleX = dc.width / rect.width; const scaleY = dc.height / rect.height
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function saveUndo() {
    const dc = drawCanvasRef.current; if (!dc) return
    const ctx = dc.getContext('2d')!
    setUndoStack(prev => [...prev.slice(-15), ctx.getImageData(0, 0, dc.width, dc.height)])
  }

  function handleUndo() {
    const dc = drawCanvasRef.current; if (!dc || undoStack.length === 0) return
    const prev = [...undoStack]; const last = prev.pop()!
    dc.getContext('2d')!.putImageData(last, 0, 0)
    setUndoStack(prev)
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (tool !== 'draw' && tool !== 'dodge' && tool !== 'burn') return
    e.preventDefault()
    const pt = getCanvasPoint(e); if (!pt) return
    saveUndo()
    drawing.current = true; lastPt.current = pt
    applyBrush(pt)
  }

  function moveDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const pt = getCanvasPoint(e); if (!pt) return
    if (tool === 'draw') drawLine(lastPt.current!, pt)
    else applyBrush(pt)
    lastPt.current = pt
  }

  function endDraw() { drawing.current = false; lastPt.current = null }

  function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dc = drawCanvasRef.current; if (!dc) return
    const ctx = dc.getContext('2d')!
    ctx.globalAlpha = brushOpacity / 100
    ctx.strokeStyle = brushColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    ctx.globalAlpha = 1
  }

  function applyBrush(pt: { x: number; y: number }) {
    if (tool === 'draw') { drawLine(lastPt.current || pt, pt); return }
    // Dodge (lighten) or Burn (darken) — work on main canvas
    const mc = mainCanvasRef.current; if (!mc) return
    const ctx = mc.getContext('2d')!
    const r = brushSize / 2
    ctx.save()
    ctx.globalCompositeOperation = tool === 'dodge' ? 'lighter' : 'multiply'
    ctx.globalAlpha = 0.08
    const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
    if (tool === 'dodge') { grad.addColorStop(0, 'rgba(255,255,255,.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)') }
    else { grad.addColorStop(0, 'rgba(0,0,0,.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)') }
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  function handleSave() {
    const dc = drawCanvasRef.current
    if (!imgDataUrl.current) { alert('Image not loaded'); return }
    // Create fresh image from data URL to guarantee clean canvas
    const img = new Image()
    img.onload = () => {
    try {
      const MAX = 1200
      const rotated = rotation % 180 !== 0
      let w = rotated ? img.naturalHeight : img.naturalWidth
      let h = rotated ? img.naturalWidth : img.naturalHeight
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX } else { w = Math.round(w * MAX / h); h = MAX } }
      const out = document.createElement('canvas'); out.width = w; out.height = h
      const octx = out.getContext('2d')!
      // Rotation
      if (rotation) { octx.translate(w / 2, h / 2); octx.rotate((rotation * Math.PI) / 180); octx.translate(-w / 2, -h / 2) }
      const dw = rotated ? h : w, dh = rotated ? w : h
      octx.drawImage(img, 0, 0, dw, dh)
      // Apply filters via pixel manipulation (ctx.filter not supported on iOS)
      const needsFilter = filter !== 'none' || brightness !== 100 || contrast !== 100 || saturation !== 100
      if (needsFilter && w > 0 && h > 0) {
        const imageData = octx.getImageData(0, 0, w, h)
        const d = imageData.data
        const br = brightness / 100, co = contrast / 100, sat = saturation / 100, fId = filter
        for (let i = 0; i < d.length; i += 4) {
          let r = d[i], g = d[i+1], b = d[i+2]
          if (br !== 1) { r *= br; g *= br; b *= br }
          if (co !== 1) { r = ((r/255-0.5)*co+0.5)*255; g = ((g/255-0.5)*co+0.5)*255; b = ((b/255-0.5)*co+0.5)*255 }
          if (fId === 'bw') { const gray = r*0.299+g*0.587+b*0.114; r=gray; g=gray; b=gray }
          else if (fId === 'sepia') { const gray = r*0.299+g*0.587+b*0.114; r=Math.min(255,gray+40); g=Math.min(255,gray+20); b=Math.max(0,gray-20) }
          else if (fId === 'contrast') { const f2=1.3; r=((r/255-0.5)*f2+0.5)*255*1.1; g=((g/255-0.5)*f2+0.5)*255*1.1; b=((b/255-0.5)*f2+0.5)*255*1.1 }
          else if (fId === 'warm') { r=Math.min(255,r*1.1+10); g=Math.min(255,g*1.05); b=b*0.9 }
          else if (fId === 'cool') { r=r*0.9; g=Math.min(255,g*1.02); b=Math.min(255,b*1.1+10) }
          else if (fId === 'vivid') { const avg=(r+g+b)/3; r=r+(r-avg)*0.6; g=g+(g-avg)*0.6; b=b+(b-avg)*0.6 }
          else if (fId === 'fade') { const avg=(r+g+b)/3; r=(r+(avg-r)*0.3)*1.1; g=(g+(avg-g)*0.3)*1.1; b=(b+(avg-b)*0.3)*1.1 }
          if (sat !== 1) { const gray=r*0.299+g*0.587+b*0.114; r=gray+(r-gray)*sat; g=gray+(g-gray)*sat; b=gray+(b-gray)*sat }
          d[i]=Math.max(0,Math.min(255,r)); d[i+1]=Math.max(0,Math.min(255,g)); d[i+2]=Math.max(0,Math.min(255,b))
        }
        octx.putImageData(imageData, 0, 0)
      }
      // Draw overlay on top
      if (dc && dc.width > 0) octx.drawImage(dc, 0, 0, w, h)
      let q = 0.82, dataUrl = out.toDataURL('image/jpeg', q)
      while (dataUrl.length > 600000 && q > 0.3) { q -= 0.08; dataUrl = out.toDataURL('image/jpeg', q) }
      onSave(dataUrl)
    } catch (e) {
      console.warn('Save failed:', e)
      alert('Could not save. Try a different photo.')
    }
    }
    img.onerror = () => alert('Could not load image for saving.')
    img.src = imgDataUrl.current
  }

  const TOOLS: { id: EditorTool; label: string; icon: string }[] = [
    { id: 'filter', label: 'Filters', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707' },
    { id: 'adjust', label: 'Adjust', icon: 'M12 3v18M6 8l-2 2 2 2M18 8l2 2-2 2' },
    { id: 'draw', label: 'Draw', icon: 'M12 19l7-7 3 3-7 7-3-3zM18 12l-1.5-1.5M2 12l10 0' },
    { id: 'dodge', label: 'Lighten', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m3.343-5.657L5.636 5.636m12.728 0l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
    { id: 'burn', label: 'Darken', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8' },
  ]

  const pill = (active: boolean): React.CSSProperties => ({ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${active ? 'rgba(10,132,255,.55)' : 'rgba(255,255,255,.12)'}`, background: active ? 'rgba(10,132,255,.14)' : 'rgba(255,255,255,.04)', color: active ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.65)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' as const, fontFamily: 'inherit', transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 6 })

  const sliderStyle: React.CSSProperties = { width: '100%', accentColor: 'rgba(130,150,220,.9)', height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 999, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.94)', backdropFilter: 'blur(24px)', zIndex: 6000, display: 'flex', flexDirection: 'column', fontFamily: 'Inter,sans-serif', color: '#e8e8ed' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ ...pill(false), height: 34 }}>Cancel</button>
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase' }}>Edit Photo</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...pill(false), height: 34, opacity: undoStack.length ? 1 : .3 }}>Undo</button>
          <button onClick={handleSave} style={{ ...pill(true), height: 34 }}>Save</button>
        </div>
      </div>
      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 12, position: 'relative', touchAction: (tool === 'draw' || tool === 'dodge' || tool === 'burn') ? 'none' : 'auto' }}>
        <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
          <canvas ref={mainCanvasRef} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, display: 'block', filter: cssFilter, transition: 'filter .2s ease' }} />
          <canvas ref={drawCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 12, cursor: (tool === 'draw' || tool === 'dodge' || tool === 'burn') ? 'crosshair' : 'default' }}
            onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
        </div>
      </div>
      {/* Tool tabs */}
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {TOOLS.map(t => <button key={t.id} onClick={() => setTool(t.id)} style={pill(tool === t.id)}>{t.label}</button>)}
        <button onClick={() => setRotation(r => (r + 90) % 360)} style={pill(false)}>Rotate</button>
      </div>
      {/* Tool panels */}
      <div style={{ padding: '10px 16px 16px', flexShrink: 0, minHeight: 80 }}>
        {tool === 'filter' && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ flexShrink: 0, width: 58, height: 58, borderRadius: 12, overflow: 'hidden', border: `2px solid ${filter === f.id ? 'rgba(10,132,255,.65)' : 'rgba(255,255,255,.08)'}`, background: '#000', cursor: 'pointer', position: 'relative', padding: 0, boxShadow: filter === f.id ? '0 0 10px rgba(10,132,255,.25)' : 'none', transition: 'all .2s' }}>
                <img src={src} alt={f.label} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.css || 'none' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.75)', padding: '2px 0', fontSize: 7, fontWeight: 700, letterSpacing: '.04em', textAlign: 'center', color: filter === f.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)' }}>{f.label}</div>
              </button>
            ))}
          </div>
        )}
        {tool === 'adjust' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Brightness {brightness}%</div><input type="range" min={30} max={200} value={brightness} onChange={e => setBrightness(+e.target.value)} style={sliderStyle} /></div>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Contrast {contrast}%</div><input type="range" min={30} max={200} value={contrast} onChange={e => setContrast(+e.target.value)} style={sliderStyle} /></div>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Saturation {saturation}%</div><input type="range" min={0} max={200} value={saturation} onChange={e => setSaturation(+e.target.value)} style={sliderStyle} /></div>
            <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100) }} style={{ ...pill(false), alignSelf: 'flex-start', marginTop: 2 }}>Reset</button>
          </div>
        )}
        {tool === 'draw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLORS.map(c => <button key={c} onClick={() => setBrushColor(c)} style={{ width: 28, height: 28, borderRadius: 999, border: `2px solid ${brushColor === c ? '#fff' : 'rgba(255,255,255,.12)'}`, background: c, cursor: 'pointer', boxShadow: brushColor === c ? '0 0 8px rgba(255,255,255,.3)' : 'none', transition: 'all .15s', padding: 0 }} />)}
            </div>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Size {brushSize}px</div><input type="range" min={2} max={60} value={brushSize} onChange={e => setBrushSize(+e.target.value)} style={sliderStyle} /></div>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Opacity {brushOpacity}%</div><input type="range" min={10} max={100} value={brushOpacity} onChange={e => setBrushOpacity(+e.target.value)} style={sliderStyle} /></div>
          </div>
        )}
        {(tool === 'dodge' || tool === 'burn') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.60)', lineHeight: 1.4 }}>{tool === 'dodge' ? 'Paint to lighten areas' : 'Paint to darken areas'}. Use small brush for precision.</div>
            <div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Brush Size {brushSize}px</div><input type="range" min={5} max={80} value={brushSize} onChange={e => setBrushSize(+e.target.value)} style={sliderStyle} /></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PortfolioPage() {
  const [photos, setPhotos] = useState<string[]>([])
  const [barberId, setBarberId] = useState('')
  const [barberName, setBarberName] = useState('')
  const [barbers, setBarbers] = useState<{ id: string; name: string; photo?: string }[]>([])
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<{ index: number; src: string } | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadBarbers = useCallback(async () => {
    try {
      const data = await apiFetch('/api/barbers')
      const list = (Array.isArray(data) ? data : (data?.barbers || [])).map((b: any) => ({ id: String(b.id), name: String(b.name || ''), photo: b.photo_url || '', portfolio: Array.isArray(b.portfolio) ? b.portfolio : [] }))
      setBarbers(list)
      return list
    } catch { return [] }
  }, [])

  const load = useCallback(async (overrideBarberId?: string) => {
    setLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}')
      const role = user.role || 'barber'
      const ownerAdmin = role === 'owner' || role === 'admin'
      setIsOwnerOrAdmin(ownerAdmin)

      const list = await loadBarbers()
      const bid = overrideBarberId || (ownerAdmin ? (list[0]?.id || '') : (user.barber_id || ''))
      setBarberId(bid)

      const found = list.find((b: any) => b.id === bid)
      setBarberName(found?.name || user.name || '')
      setPhotos(Array.isArray((found as any)?.portfolio) ? (found as any).portfolio : [])
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [loadBarbers])

  function switchBarber(bid: string) {
    const found = barbers.find(b => b.id === bid)
    setBarberId(bid)
    setBarberName(found?.name || '')
    setPhotos(Array.isArray((found as any)?.portfolio) ? (found as any).portfolio : [])
  }

  useEffect(() => { load() }, [load])

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const MAX = 1200
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX }
            else { w = Math.round(w * MAX / h); h = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
          let q = 0.78, out = canvas.toDataURL('image/jpeg', q)
          while (out.length > 600000 && q > 0.3) { q -= 0.08; out = canvas.toDataURL('image/jpeg', q) }
          resolve(out)
        }
        img.onerror = reject
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length || !barberId) return
    setUploading(true)
    let added = 0
    try {
      for (let i = 0; i < Math.min(files.length, 10); i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        if (file.size > 10 * 1024 * 1024) { showToast('Max 10MB per photo'); continue }
        const dataUrl = await compressImage(file)
        // Upload to Cloud Storage via dedicated endpoint
        const res = await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}/portfolio/upload`, {
          method: 'POST', body: JSON.stringify({ data_url: dataUrl })
        })
        if (res.portfolio) { setPhotos(res.portfolio); added++ }
        else if (res.url) { setPhotos(prev => [...prev, res.url]); added++ }
      }
      if (added > 0) showToast(`${added} photo${added > 1 ? 's' : ''} added ✓`)
    } catch (e: any) { showToast('Error: ' + e.message) }
    setUploading(false)
  }

  async function removePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    setSaving(true)
    try {
      await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}`, {
        method: 'PATCH', body: JSON.stringify({ portfolio: newPhotos })
      })
      showToast('Photo removed')
    } catch (e: any) { showToast('Error: ' + e.message); load() }
    setSaving(false)
  }

  async function movePhoto(from: number, to: number) {
    if (to < 0 || to >= photos.length) return
    const newPhotos = [...photos]
    const [item] = newPhotos.splice(from, 1)
    newPhotos.splice(to, 0, item)
    setPhotos(newPhotos)
    try {
      await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}`, {
        method: 'PATCH', body: JSON.stringify({ portfolio: newPhotos })
      })
    } catch { load() }
  }

  return (
    <Shell page="portfolio">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800;900&family=Julius+Sans+One&display=swap');
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        @keyframes photoIn { 0% { opacity:0; transform:scale(.9) } 100% { opacity:1; transform:scale(1) } }
        @keyframes emptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .port-photo { animation: photoIn .3s ease both; transition: transform .25s ease; }
        .port-photo:hover { transform: scale(1.03); }
        .port-photo:hover .port-overlay { opacity: 1 !important; }
        .port-shimmer { background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.04) 75%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; }
        @media(max-width:640px) { .port-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,.80)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,.08)', position: 'sticky', top: 0, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: '"Inter",sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 15 }}>Portfolio</h2>
            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,.40)', fontSize: 11, letterSpacing: '.08em' }}>
              {barberName ? `${barberName} — ${photos.length} photo${photos.length !== 1 ? 's' : ''}` : 'Your work gallery'}
            </p>
          </div>
          <label style={{
            height: 40, padding: '0 18px', borderRadius: 999,
            border: '1px solid rgba(10,132,255,.55)', background: 'rgba(10,132,255,.10)',
            color: 'rgba(130,150,220,.6)', cursor: uploading ? 'wait' : 'pointer',
            fontWeight: 900, fontSize: 12, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 0 14px rgba(10,132,255,.20)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {uploading ? 'Uploading…' : 'Add photos'}
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={uploading}
              onChange={e => handleUpload(e.target.files)} />
          </label>
        </div>
          {/* Barber selector for owner/admin */}
          {isOwnerOrAdmin && barbers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {barbers.map(b => (
                <button key={b.id} onClick={() => switchBarber(b.id)}
                  style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${barberId === b.id ? 'rgba(10,132,255,.50)' : 'rgba(255,255,255,.08)'}`, background: barberId === b.id ? 'rgba(10,132,255,.12)' : 'rgba(255,255,255,.03)', color: barberId === b.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 800, fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s ease', flexShrink: 0 }}>
                  {b.photo && <img src={b.photo} alt="" style={{ width: 18, height: 18, borderRadius: 999, objectFit: 'cover' }} />}
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.30)' }}>Loading…</div>
          ) : !barberId ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.30)' }}>
              <div style={{ marginBottom: 12, animation: 'emptyFloat 3s ease-in-out infinite' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.30)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div style={{ fontSize: 14 }}>No barber profile linked</div>
              <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,.20)' }}>Ask admin to link your account to a barber profile</div>
            </div>
          ) : photos.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.30)' }}>
              <div style={{ marginBottom: 12, animation: 'emptyFloat 3s ease-in-out infinite' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.30)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg></div>
              <div style={{ fontSize: 14 }}>No photos yet</div>
              <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,.20)' }}>Add your best work to show on the website</div>
            </div>
          ) : (
            <div className="port-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {uploading && (
                <div className="port-shimmer" style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', aspectRatio: '1' }} />
              )}
              {photos.map((url, i) => (
                <div key={i} className="port-photo" style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', aspectRatio: '1', animationDelay: `${i * 0.05}s` }}>
                  <img src={url} alt={`Work ${i + 1}`} onClick={() => setLightbox(url)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }} />
                  <div className="port-overlay" style={{
                    position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.8) 0%, transparent 50%)',
                    opacity: 0, transition: 'opacity .2s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: 8
                  }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i > 0 && (
                        <button onClick={e => { e.stopPropagation(); movePhoto(i, i - 1) }}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                      )}
                      {i < photos.length - 1 && (
                        <button onClick={e => { e.stopPropagation(); movePhoto(i, i + 1) }}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); setEditingPhoto({ index: i, src: url }) }}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(10,132,255,.35)', background: 'rgba(10,132,255,.15)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); removePhoto(i) }}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.15)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', fontSize: 11, color: 'rgba(255,255,255,.30)', lineHeight: 1.6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.40)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>Hover over photos to reorder or delete. Photos show on the public website in your ABOUT section. Max 50 photos.
            </div>
          )}
        </div>
      </div>

      {/* Photo Editor */}
      {editingPhoto && (
        <PhotoEditor
          src={editingPhoto.src}
          onClose={() => setEditingPhoto(null)}
          onSave={async (dataUrl) => {
            setEditingPhoto(null)
            try {
              // Upload edited photo to GCS
              const res = await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}/portfolio/upload`, {
                method: 'POST', body: JSON.stringify({ data_url: dataUrl })
              })
              // Remove old photo and use the new URL
              const newPhotos = [...photos]
              newPhotos[editingPhoto.index] = res.url || dataUrl
              setPhotos(newPhotos)
              await apiFetch(`/api/barbers/${encodeURIComponent(barberId)}`, {
                method: 'PATCH', body: JSON.stringify({ portfolio: newPhotos })
              })
              showToast('Photo updated')
            } catch (e: any) { showToast('Error: ' + (e?.message || '')); load() }
          }}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, cursor: 'zoom-out', padding: 20 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 20px 80px rgba(0,0,0,.6)' }} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 6000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: toast.includes('Error') ? '#ff6b6b' : 'rgba(130,220,170,.8)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </Shell>
  )
}
