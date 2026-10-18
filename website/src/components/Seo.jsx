import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { resolveRouteSeo, SITE_ORIGIN, SITE_ORIGIN_AU, SITE_NAME } from '../lib/seo.js'

function setMetaTag(attrName, attrValue, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLinkTag(rel, href, extraAttrs = {}) {
  if (!href) return
  const selectorParts = [`link[rel="${rel}"]`]
  for (const [k, v] of Object.entries(extraAttrs)) {
    selectorParts.push(`[${k}="${v}"]`)
  }
  const selector = selectorParts.join('')
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    for (const [k, v] of Object.entries(extraAttrs)) {
      el.setAttribute(k, v)
    }
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function Seo({ title, description, keywords, robots, image, imageAlt, schema }) {
  const { pathname } = useLocation()

  useEffect(() => {
    const routeDef = resolveRouteSeo(pathname)
    const finalTitle = title || routeDef.title
    const finalDesc = description || routeDef.description
    const finalKeywords = keywords || routeDef.keywords || ''
    const finalRobots = robots || routeDef.robots
    const finalImage = image || routeDef.image
    const finalImageAlt = imageAlt || routeDef.imageAlt || SITE_NAME
    const canonicalPath = routeDef.canonicalPath || pathname || '/'
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`
    const alternateAuUrl = `${SITE_ORIGIN_AU}${canonicalPath === '/' ? '/' : canonicalPath}`

    document.title = finalTitle

    // Primary SEO meta tags
    setMetaTag('name', 'description', finalDesc)
    if (finalKeywords) setMetaTag('name', 'keywords', finalKeywords)
    setMetaTag('name', 'robots', finalRobots)
    setMetaTag('name', 'googlebot', finalRobots)

    // Canonical & hreflang tags
    setLinkTag('canonical', canonicalUrl)
    setLinkTag('alternate', canonicalUrl, { hreflang: 'en-IN' })
    setLinkTag('alternate', alternateAuUrl, { hreflang: 'en-AU' })
    setLinkTag('alternate', canonicalUrl, { hreflang: 'x-default' })

    // Open Graph meta tags
    setMetaTag('property', 'og:type', 'website')
    setMetaTag('property', 'og:site_name', SITE_NAME)
    setMetaTag('property', 'og:title', finalTitle)
    setMetaTag('property', 'og:description', finalDesc)
    setMetaTag('property', 'og:url', canonicalUrl)
    setMetaTag('property', 'og:image', finalImage)
    setMetaTag('property', 'og:image:alt', finalImageAlt)

    // Twitter Card meta tags
    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', finalTitle)
    setMetaTag('name', 'twitter:description', finalDesc)
    setMetaTag('name', 'twitter:image', finalImage)
    setMetaTag('name', 'twitter:image:alt', finalImageAlt)

    // Route-specific JSON-LD structured data
    const resolvedSchema = typeof schema === 'function'
      ? schema()
      : schema !== undefined
        ? schema
        : typeof routeDef.schema === 'function'
          ? routeDef.schema()
          : routeDef.schema

    const scriptId = 'hp-route-jsonld'
    let scriptEl = document.getElementById(scriptId)
    if (resolvedSchema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script')
        scriptEl.id = scriptId
        scriptEl.type = 'application/ld+json'
        document.head.appendChild(scriptEl)
      }
      scriptEl.textContent = JSON.stringify(resolvedSchema)
    } else if (scriptEl) {
      scriptEl.remove()
    }
  }, [pathname, title, description, keywords, robots, image, imageAlt, schema])

  return null
}
