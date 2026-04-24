interface RateLimitRecord {
  count: number
  reset: number
}

const store = new Map<string, RateLimitRecord>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now    = Date.now()
  const record = store.get(key)

  if (!record || now > record.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return true
  }

  if (record.count >= max) return false

  record.count++
  return true
}

export function validateFileUpload(
  file: File
): { valid: true } | { valid: false; error: string } {
  const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
  const MAX_SIZE = 25 * 1024 * 1024

  if (!ALLOWED.includes(file.type)) {
    return { valid: false, error: 'Only PDF, JPG, and PNG files are accepted' }
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File is too large (max 25MB)' }
  }
  return { valid: true }
}
