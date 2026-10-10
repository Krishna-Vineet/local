import { createContext, useContext, type ReactNode } from 'react'

interface BoothContextValue {
  orgName: string
  orgLogoUrl: string | null
}

const BoothContext = createContext<BoothContextValue>({ orgName: 'HappyPix', orgLogoUrl: null })

export function BoothProvider({ orgName, orgLogoUrl, children }: BoothContextValue & { children: ReactNode }) {
  return <BoothContext.Provider value={{ orgName, orgLogoUrl }}>{children}</BoothContext.Provider>
}

export function useBoothContext() {
  return useContext(BoothContext)
}
