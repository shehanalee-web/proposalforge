function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeHex(hex, fallback = '#14b8a6') {
  if (typeof hex !== 'string') return fallback
  const value = hex.trim()
  if (/^#([0-9a-f]{3})$/i.test(value)) {
    const [, body] = value.match(/^#([0-9a-f]{3})$/i)
    return `#${body
      .split('')
      .map((char) => char + char)
      .join('')}`.toLowerCase()
  }
  if (/^#([0-9a-f]{6})$/i.test(value)) return value.toLowerCase()
  return fallback
}

export function hexToRgb(hex) {
  const value = normalizeHex(hex)
  const numeric = Number.parseInt(value.slice(1), 16)
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  }
}

export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

export function mixHex(a, b, amount) {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  return rgbToHex({
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount,
  })
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function contrastText(background) {
  return luminance(background) > 0.58 ? '#111111' : '#f4f4f5'
}

export function alpha(hex, opacity) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function deepMerge(base = {}, patch = {}) {
  const output = { ...base }
  Object.keys(patch).forEach((key) => {
    const next = patch[key]
    const current = base[key]
    if (
      next &&
      typeof next === 'object' &&
      !Array.isArray(next) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      output[key] = deepMerge(current, next)
    } else if (next !== undefined) {
      output[key] = next
    }
  })
  return output
}

export function setPath(source, path, value) {
  const keys = path.split('.')
  const next = structuredClone(source)
  let cursor = next
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value
      return
    }
    cursor[key] = { ...(cursor[key] ?? {}) }
    cursor = cursor[key]
  })
  return next
}
