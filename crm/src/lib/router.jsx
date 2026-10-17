// Tiny hash router (no external deps, preview-iframe friendly).

import { useEffect, useState, useCallback } from 'react'

export function currentPath() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export function navigate(path) {
  if (currentPath() === path) return
  window.location.hash = '#' + path
}

export function useRoute() {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const h = () => setPath(currentPath())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return path
}

export function Link({ to, children, className = '', style, onClick }) {
  const go = useCallback(
    (e) => {
      e.preventDefault()
      navigate(to)
      onClick && onClick(e)
    },
    [to, onClick]
  )
  return (
    <a href={'#' + to} className={className} style={style} onClick={go}>
      {children}
    </a>
  )
}
