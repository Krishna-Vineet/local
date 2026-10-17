// Theme (light / dark) — stored per device, applied on <html data-theme>.
// The dark palette lives in index.css under html[data-theme="dark"].

const KEY = 'hp_theme'

export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'dark' || t === 'light' ? t : null
  } catch {
    return null
  }
}

export function systemTheme() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// First visit follows the system preference; after that the user's
// explicit choice (made in Login or Profile) always wins.
export function initialTheme() {
  return storedTheme() || systemTheme()
}

export function applyTheme(t) {
  const theme = t === 'dark' ? 'dark' : 'light'
  try {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  return theme
}
