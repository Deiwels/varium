const PIN_HASH_KEY = 'VURIUMBOOK_PIN_HASH'
const PIN_CREDS_KEY = 'VURIUMBOOK_PIN_CREDS'
const PIN_USER_KEY = 'VURIUMBOOK_PIN_USER'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Derive AES key from PIN + username
async function deriveKey(pin: string, salt: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin + salt), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encrypt(text: string, pin: string, salt: string): Promise<string> {
  const key = await deriveKey(pin, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
  // Store as base64: iv + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ct).length)
  combined.set(iv)
  combined.set(new Uint8Array(ct), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decrypt(encoded: string, pin: string, salt: string): Promise<string> {
  const key = await deriveKey(pin, salt)
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ct = combined.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plain)
}

export function hasPinSetup(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PIN_HASH_KEY) && !!localStorage.getItem(PIN_CREDS_KEY)
}

export function getPinUsername(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PIN_USER_KEY) || ''
}

export async function savePin(pin: string, username: string, password: string): Promise<void> {
  const hash = await sha256(pin + ':' + username.toLowerCase())
  const creds = await encrypt(JSON.stringify({ username, password }), pin, username.toLowerCase())
  localStorage.setItem(PIN_HASH_KEY, hash)
  localStorage.setItem(PIN_CREDS_KEY, creds)
  localStorage.setItem(PIN_USER_KEY, username)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY)
  const username = localStorage.getItem(PIN_USER_KEY) || ''
  if (!stored || !username) return false
  const hash = await sha256(pin + ':' + username.toLowerCase())
  return hash === stored
}

export async function getCredentials(pin: string): Promise<{ username: string; password: string } | null> {
  const encoded = localStorage.getItem(PIN_CREDS_KEY)
  const username = localStorage.getItem(PIN_USER_KEY) || ''
  if (!encoded || !username) return null
  try {
    const json = await decrypt(encoded, pin, username.toLowerCase())
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function clearPin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
  localStorage.removeItem(PIN_CREDS_KEY)
  localStorage.removeItem(PIN_USER_KEY)
}
