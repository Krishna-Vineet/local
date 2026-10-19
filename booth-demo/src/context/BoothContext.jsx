import React, { createContext, useContext, useState, useCallback } from 'react'

const BoothContext = createContext(null)
export const useBooth = () => {
  const v = useContext(BoothContext)
  if(!v) throw new Error('useBooth outside provider')
  return v
}

export function BoothProvider({ children }) {
  const [config, setConfig] = useState({
    orgName: 'HappyPix Demo',
    orgLogo: null,
    orgLogoUrl: null,
    eventName: 'Annual Gala 2026',
    eventType: 'party',
    sponsorLogos: [], // urls
  })
  const [session, setSession] = useState(() => fresh())
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [photos, setPhotos] = useState([]) // captured
  const [selectedPhotos, setSelectedPhotos] = useState([]) // chosen for template
  const [customization, setCustomization] = useState({ filter:'original', stickers:[], logo:null, subtitle:'' })

  function fresh(){ return { orientation:null, template:null, prints:2, digitalCopy:true, quote:null } }
  const resetSession = useCallback(()=>{ setSession(fresh()); setPhotos([]); setSelectedPhotos([]); setCustomization({filter:'original', stickers:[], logo:null, subtitle:''}); setCoupon(''); setCouponApplied(false)},[])

  const value = { config, setConfig, session, setSession, photos, setPhotos, selectedPhotos, setSelectedPhotos, customization, setCustomization, coupon, setCoupon, couponApplied, setCouponApplied, resetSession }
  return <BoothContext.Provider value={value}>{children}</BoothContext.Provider>
}
