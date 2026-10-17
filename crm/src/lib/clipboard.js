// Clipboard helper that works outside secure contexts.
//
// navigator.clipboard exists ONLY on https:// and http://localhost. Opening
// the CRM on a LAN IP (http://192.168.x.x:5173) or plain http leaves it
// undefined, so we fall back to the legacy execCommand('copy') path, which
// works everywhere as long as it runs inside a user gesture.
export async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through */ }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch {
    return false
  }
}

// Save text as a file — the always-works fallback when copying is blocked.
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
