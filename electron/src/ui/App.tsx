import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import type {
  BoothSession,
  BoothSnapshot,
  CheckoutQuote,
  Customization,
  Installation,
  PaymentOrder,
  PrintOutcome,
  ScreenId,
} from './types'
import { boothApi } from './services/api'
import { bridge } from './services/bridge'
import { renderCompositeDataUrl } from './utils/composite'
import { cacheSnapshot, readCachedSnapshot } from './services/cache'
import { useIdleTimer } from './hooks/useIdleTimer'
import { IdleWarning } from './components/ScreenShell'
import { BoothProvider } from './context/BoothContext'
import { BootScreen, LoginScreen, StandbyScreen, WaitingScreen } from './screens/ConnectionScreens'
import { OrientationScreen, PrintCountScreen, StartScreen, TemplateScreen } from './screens/ChoiceScreens'
import { PaymentScreen } from './screens/PaymentScreen'
import { CameraScreen } from './screens/CameraScreen'
import { PhotoSelectionScreen } from './screens/PhotoSelectionScreen'
import { CustomizeScreen } from './screens/CustomizeScreen'
import { SuccessScreen } from './screens/SuccessScreen'

const defaultCustomization = (): Customization => ({
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
})

const freshSession = (): BoothSession => ({
  id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  startedAt: new Date().toISOString(),
  orientation: null,
  template: null,
  prints: 1,
  digitalCopy: true,
  quote: null,
  payment: null,
  photos: [],
  selectedPhotos: [],
  customization: defaultCustomization(),
})

function targetForSnapshot(snapshot: BoothSnapshot): ScreenId {
  return snapshot.event?.status === 'live' ? 'start' : 'waiting'
}

function App() {
  const [screen, setScreen] = useState<ScreenId>('boot')
  const [bootMessage, setBootMessage] = useState('Checking this installation…')
  const [installation, setInstallation] = useState<Installation | null>(null)
  const [snapshot, setSnapshot] = useState<BoothSnapshot | null>(() => readCachedSnapshot())
  const [session, setSession] = useState<BoothSession>(() => freshSession())
  const [online, setOnline] = useState(true)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [outcome, setOutcome] = useState<PrintOutcome | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const installationRef = useRef<Installation | null>(null)
  const snapshotRef = useRef<BoothSnapshot | null>(snapshot)

  const applySnapshot = useCallback((value: BoothSnapshot) => {
    snapshotRef.current = value
    setSnapshot(value)
    cacheSnapshot(value)
    setScreen(targetForSnapshot(value))
  }, [])

  useEffect(() => {
    let active = true
    async function boot() {
      let saved: Installation | null = null
      try {
        setBootMessage('Looking for a saved booth pairing…')
        saved = await bridge.getInstallation()
        if (!active) return
        if (!saved) {
          setScreen('login')
          return
        }
        setBootMessage('Securely reconnecting to HappyPix…')
        const value = await boothApi.bootstrap(saved)
        if (!active) return
        installationRef.current = saved
        setInstallation(saved)
        setOnline(true)
        applySnapshot(value)
      } catch {
        if (!active) return
        installationRef.current = saved
        setInstallation(saved)
        setOnline(false)
        if (snapshotRef.current) {
          applySnapshot(snapshotRef.current)
        } else {
          setScreen('standby')
        }
      }
    }
    void boot()
    return () => {
      active = false
    }
  }, [applySnapshot])

  const reconnect = useCallback(async () => {
    setRefreshing(true)
    try {
      const saved = installationRef.current || (await bridge.getInstallation())
      if (!saved) {
        setScreen('login')
        return
      }
      const value = await boothApi.bootstrap(saved)
      installationRef.current = saved
      setInstallation(saved)
      setOnline(true)
      applySnapshot(value)
    } catch {
      setOnline(false)
    } finally {
      setRefreshing(false)
    }
  }, [applySnapshot])

  useEffect(() => {
    if (!installation) return
    const heartbeat = async () => {
      try {
        const current = snapshotRef.current
        const hardware = await bridge.hardware()
        const response = await boothApi.heartbeat(installation, {
          deviceUuid: installation.deviceUuid,
          eventId: current?.event?.id ?? null,
          knownRevision: current?.revision ?? null,
          clientDateTime: new Date().toISOString(),
          hardware,
        })
        setOnline(true)
        if (response.changed && response.snapshot) applySnapshot(response.snapshot)
      } catch (reason) {
        const msg = reason instanceof Error ? reason.message : ''
        const serverCode = (reason as { code?: string | null }).code ?? null
        const serverStatus = (reason as { status?: number }).status
        if (serverCode === 'DEVICE_DELETED' || serverStatus === 410) {
          await bridge.clearInstallation()
          await bridge.clearDeviceIdentity()
          installationRef.current = null
          setInstallation(null)
          setSnapshot(null)
          snapshotRef.current = null
          setLoginError('This booth was removed from HappyPix. Pair it again to continue.')
          setScreen('login')
        } else if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('banned') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('inactive')) {
          await bridge.clearInstallation()
          installationRef.current = null
          setInstallation(null)
          setSnapshot(null)
          snapshotRef.current = null
          setLoginError('This device has been removed or access was revoked. Please sign in again.')
          setScreen('login')
        } else {
          setOnline(false)
        }
      }
    }
    const first = window.setTimeout(() => void heartbeat(), 3000)
    const timer = window.setInterval(() => void heartbeat(), 2 * 60 * 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [installation, applySnapshot])

  const resetGuestSession = useCallback(() => {
    setSession(freshSession())
    setOutcome(null)
    setPrinting(false)
    setIsTransitioning(false)
    const current = snapshotRef.current
    setScreen(current ? targetForSnapshot(current) : 'login')
  }, [])

  // Transition helper: pause timer, navigate, restart timer on next screen
  const goToScreen = useCallback((next: ScreenId) => {
    setIsTransitioning(true)
    window.setTimeout(() => {
      setScreen(next)
      setIsTransitioning(false)
    }, 280)
  }, [])

  const timerScreens: ScreenId[] = ['orientation', 'templates', 'prints', 'photos', 'customize']
  const idleEnabled = timerScreens.includes(screen) && !isTransitioning && !printing
  const timeoutSeconds = snapshot?.settings.boothTimeoutSec ?? 90
  const { secondsLeft, reset: resetTimer } = useIdleTimer(idleEnabled, timeoutSeconds, resetGuestSession)

  // Reset timer whenever we arrive at a new timed screen (restart on next page)
  useEffect(() => {
    if (timerScreens.includes(screen)) {
      resetTimer()
    }
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (values: { email: string; password: string; locationLabel: string; coordinates?: GeolocationCoordinates }) => {
    setLoginBusy(true)
    setLoginError(null)
    try {
      const hardware = await bridge.hardware()
      const deviceUuid = await bridge.getDeviceUuid()
      const result = await boothApi.login({
        email: values.email,
        password: values.password,
        deviceUuid,
        deviceName: 'HappyPix Booth',
        clientDateTime: new Date().toISOString(),
        location: {
          label: values.locationLabel,
          latitude: values.coordinates?.latitude,
          longitude: values.coordinates?.longitude,
          accuracyM: values.coordinates?.accuracy,
        },
        platform: hardware.platform,
        appVersion: '0.1.0',
        display: {
          width: hardware.kioskScreen.width,
          height: hardware.kioskScreen.height,
          scaleFactor: hardware.kioskScreen.scaleFactor,
          external: hardware.kioskScreen.external,
        },
      })
      await bridge.saveInstallation(result.installation)
      installationRef.current = result.installation
      setInstallation(result.installation)
      setOnline(true)
      applySnapshot(result.snapshot)
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : 'Could not pair this booth.')
    } finally {
      setLoginBusy(false)
    }
  }

  const refreshEvent = async () => {
    if (!installation) return
    setRefreshing(true)
    try {
      const value = await boothApi.bootstrap(installation)
      setOnline(true)
      applySnapshot(value)
    } catch {
      setOnline(false)
    } finally {
      setRefreshing(false)
    }
  }

  const requestQuote = useCallback(async (coupon?: string): Promise<CheckoutQuote> => {
    if (!installation || !snapshot?.event || !session.template) throw new Error('The event or template is no longer available.')
    return boothApi.quote(installation, {
      eventId: snapshot.event.id,
      templateId: session.template.id,
      layoutId: session.template.layout.id,
      prints: session.prints,
      digitalCopy: session.digitalCopy,
      couponCode: coupon,
    })
  }, [installation, snapshot, session.template, session.prints, session.digitalCopy])

  const createPayment = useCallback(async (quote: CheckoutQuote) => {
    if (!installation) throw new Error('This booth is not paired.')
    return boothApi.createPayment(installation, quote)
  }, [installation])

  const paymentStatus = useCallback(async (paymentId: string) => {
    if (!installation) return 'failed' as const
    return boothApi.paymentStatus(installation, paymentId)
  }, [installation])

  const completeFree = useCallback(async (quote: CheckoutQuote) => {
    if (!installation) throw new Error('This booth is not paired.')
    await boothApi.completeFree(installation, quote)
  }, [installation])

  const paymentComplete = (quote: CheckoutQuote, payment: PaymentOrder | null) => {
    setSession((current) => ({ ...current, quote, payment }))
    goToScreen('camera')
  }

  const finishAndPrint = async () => {
    if (!installation || !session.template) return
    setPrinting(true)
    let printResult: { success: boolean; jobId?: string | null; error?: string } = { success: false }
    let printError: string | null = null

    let compositeUrl: string | undefined
    try {
      compositeUrl = await renderCompositeDataUrl({
        template: session.template,
        photos: session.selectedPhotos,
        customization: session.customization,
        eventName: snapshot?.event?.name,
      })
    } catch (reason) {
      printError = reason instanceof Error ? reason.message : 'The final print could not be prepared.'
    }

    if (compositeUrl) {
      try {
        // Guard against hanging printer IPC with timeout
        const printPromise = bridge.print({
          copies: session.prints,
          layoutId: session.template.layout.id,
          templateName: session.template.name,
          bitmapDataUrl: compositeUrl,
        })
        const timeout = new Promise<{ success: boolean; error: string }>((resolve) =>
          window.setTimeout(() => resolve({ success: false, error: 'The printer did not respond in time. Your digital copy is still available.' }), 15000)
        )
        const raced: any = await Promise.race([printPromise, timeout])
        printResult = raced
        if (!printResult.success && !printError) printError = printResult.error || 'The printer did not accept this job. Your digital copy is still available via QR.'
      } catch (reason) {
        printError = reason instanceof Error ? reason.message : 'The printer did not accept this job. Your digital copy is still available via QR.'
        printResult = { success: false, error: printError }
      }
    } else if (!printError) {
      printError = 'The final print could not be prepared. Please ask the operator for help — your session is saved.'
    }

    let shareUrl: string | null = null
    const resolveDownloadWebsiteBase = (snapshotUrl?: string): string => {
      if (snapshotUrl && typeof snapshotUrl === 'string' && snapshotUrl.trim().length > 0) {
        return snapshotUrl.trim().replace(/\/+$/, '')
      }
      const fromEnv = (import.meta as any).env?.VITE_WEBSITE_URL
      if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
        return fromEnv.trim().replace(/\/+$/, '')
      }
      return ''
    }
    const websiteBase = resolveDownloadWebsiteBase(snapshot?.settings?.websiteUrl)
    const guaranteedShareUrl = session.digitalCopy
      ? (websiteBase
          ? `${websiteBase}/download/${encodeURIComponent(session.id)}`
          : `/download/${encodeURIComponent(session.id)}`)
      : null
    try {
      const completed = await boothApi.completeSession(installation, {
        sessionId: session.id,
        digitalCopy: session.digitalCopy,
        guestConsent: session.customization.guestConsent ?? true,
        compositeUrl,
        photos: session.selectedPhotos.map((photo) => (photo as any).dataUrl).filter(Boolean),
        eventId: snapshot?.event?.id,
      })
      shareUrl = (completed as any).shareUrl ?? (completed as any).downloadUrl ?? null
    } catch (reason) {
      console.warn('[completeSession] Digital copy upload delayed/failed:', reason)
    }

    if (!shareUrl && session.digitalCopy) {
      shareUrl = guaranteedShareUrl
    }

    // Surface printer failure: never stay on loading — always show outcome
    setOutcome({
      success: printResult.success,
      jobId: printResult.jobId ?? null,
      error: printResult.success ? null : printError,
      shareUrl,
    })
    setPrinting(false)
    setScreen('success')
  }

  if (screen === 'boot') return <BootScreen message={bootMessage}/>
  if (screen === 'login') return <LoginScreen busy={loginBusy} error={loginError} onLogin={login}/>
  if (screen === 'standby' || !snapshot) return <StandbyScreen busy={refreshing} onRetry={() => void reconnect()} onPairNew={() => setScreen('login')}/>
  if (screen === 'waiting' || !snapshot.event) return <WaitingScreen snapshot={snapshot} refreshing={refreshing} onRefresh={() => void refreshEvent()}/>

  const event = snapshot.event
  let content
  // Helper to wrap screen transitions with pause
  const withPause = (next: ScreenId) => goToScreen(next)
  switch (screen) {
    case 'start':
      content = <StartScreen event={event} onStart={() => { setSession(freshSession()); resetTimer(); setScreen('orientation') }}/>
      break
    case 'orientation':
      content = <OrientationScreen value={session.orientation} secondsLeft={isTransitioning ? timeoutSeconds : secondsLeft} onChange={(orientation) => setSession((current) => ({ ...current, orientation, template: null }))} onNext={() => withPause('templates')} onBack={() => withPause('start')}/>
      break
    case 'templates':
      content = <TemplateScreen event={event} session={session} secondsLeft={isTransitioning ? timeoutSeconds : secondsLeft} onSelect={(template) => setSession((current) => ({ ...current, template }))} onNext={() => withPause('prints')} onBack={() => withPause('orientation')}/>
      break
    case 'prints':
      content = <PrintCountScreen event={event} session={session} maximumPrints={snapshot.settings.maximumPrints} secondsLeft={isTransitioning ? timeoutSeconds : secondsLeft} onUpdate={(value) => setSession((current) => ({ ...current, ...value }))} onNext={() => withPause('payment')} onBack={() => withPause('templates')}/>
      break
    case 'payment':
      content = <PaymentScreen secondsLeft={timeoutSeconds} onBack={() => withPause('prints')} requestQuote={requestQuote} createPayment={createPayment} paymentStatus={paymentStatus} completeFree={completeFree} onComplete={paymentComplete}/>
      break
    case 'camera':
      content = session.template ? <CameraScreen template={session.template} onComplete={(photos) => { setSession((current) => ({ ...current, photos, selectedPhotos: [] })); withPause('photos') }}/> : null
      break
    case 'photos':
      content = session.template ? <PhotoSelectionScreen template={session.template} photos={session.photos} initial={session.selectedPhotos} secondsLeft={isTransitioning ? timeoutSeconds : secondsLeft} onBack={() => withPause('camera')} onComplete={(selectedPhotos) => { setSession((current) => ({ ...current, selectedPhotos })); withPause('customize') }}/> : null
      break
    case 'customize':
      content = session.template ? <CustomizeScreen event={event} template={session.template} photos={session.selectedPhotos} value={session.customization} secondsLeft={isTransitioning || printing ? timeoutSeconds : secondsLeft} printing={printing} onChange={(customization) => setSession((current) => ({ ...current, customization }))} onBack={() => { if (!printing) withPause('photos') }} onFinish={() => void finishAndPrint()}/> : null
      break
    case 'success':
      content = outcome ? <SuccessScreen outcome={outcome} onDone={resetGuestSession}/> : null
      break
    default:
      content = <StartScreen event={event} onStart={() => setScreen('orientation')}/>
  }

  const orgName = snapshot.settings.organizationName || snapshot.organization.name || 'HappyPix'
  const orgLogoUrl = snapshot.settings.branding?.logoUrl || snapshot.organization.branding?.logoUrl || null

  return (
    <BoothProvider orgName={orgName} orgLogoUrl={orgLogoUrl}>
      {content}
      {timerScreens.includes(screen) && <IdleWarning secondsLeft={isTransitioning || printing ? timeoutSeconds : secondsLeft} onContinue={resetTimer}/>}
      {!online && <div className="offline-banner">Working from the saved event. Payment needs a connection.</div>}
    </BoothProvider>
  )
}

export default App
