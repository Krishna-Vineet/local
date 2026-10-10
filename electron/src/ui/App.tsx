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
import { cacheSnapshot, readCachedSnapshot } from './services/cache'
import { useIdleTimer } from './hooks/useIdleTimer'
import { IdleWarning } from './components/ScreenShell'
import { BoothProvider } from './context/BoothContext'
import { BootScreen, LoginScreen, WaitingScreen } from './screens/ConnectionScreens'
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
      try {
        setBootMessage('Looking for a saved booth pairing…')
        const saved = await bridge.getInstallation()
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
        await bridge.clearInstallation()
        installationRef.current = null
        setInstallation(null)
        setLoginError('The saved pairing could not be restored. Please sign in to pair this booth again.')
        setScreen('login')
      }
    }
    void boot()
    return () => {
      active = false
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
        // 401 = device deleted, 403 = org banned — force re-login
        if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('banned') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('inactive')) {
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
    const current = snapshotRef.current
    setScreen(current ? targetForSnapshot(current) : 'login')
  }, [])

  const timerScreens: ScreenId[] = ['orientation', 'templates', 'prints', 'photos', 'customize']
  const idleEnabled = timerScreens.includes(screen)
  const timeoutSeconds = snapshot?.settings.boothTimeoutSec ?? 90
  const { secondsLeft, reset: resetTimer } = useIdleTimer(idleEnabled, timeoutSeconds, resetGuestSession)

  const login = async (values: { email: string; password: string; locationLabel: string; coordinates?: GeolocationCoordinates }) => {
    setLoginBusy(true)
    setLoginError(null)
    try {
      const hardware = await bridge.hardware()
      const deviceUuid = crypto.randomUUID()
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
    await boothApi.completeFree(installation, quote.quoteId)
  }, [installation])

  const paymentComplete = (quote: CheckoutQuote, payment: PaymentOrder | null) => {
    setSession((current) => ({ ...current, quote, payment }))
    setScreen('camera')
  }

  const finishAndPrint = async () => {
    if (!installation || !session.template) return
    setPrinting(true)
    let printResult: { success: boolean; jobId?: string } = { success: false }
    let printError: string | null = null
    try {
      printResult = await bridge.print({
        copies: session.prints,
        layoutId: session.template.layout.id,
        templateName: session.template.name,
      })
    } catch (reason) {
      printError = reason instanceof Error ? reason.message : 'The printer did not accept this job.'
    }

    let shareUrl: string | null = null
    try {
      const completed = await boothApi.completeSession(installation, {
        sessionId: session.id,
        digitalCopy: session.digitalCopy,
      })
      shareUrl = completed.shareUrl
    } catch (reason) {
      if (!printError) printError = reason instanceof Error ? reason.message : 'Digital copy could not be prepared.'
    }

    setOutcome({
      success: printResult.success,
      jobId: printResult.jobId ?? null,
      error: printError,
      shareUrl,
    })
    setPrinting(false)
    setScreen('success')
  }

  if (screen === 'boot') return <BootScreen message={bootMessage}/>
  if (screen === 'login') return <LoginScreen busy={loginBusy} error={loginError} onLogin={login}/>
  if (!snapshot) return <BootScreen message="Loading booth configuration…"/>
  if (screen === 'waiting' || !snapshot.event) return <WaitingScreen snapshot={snapshot} refreshing={refreshing} onRefresh={() => void refreshEvent()}/>

  const event = snapshot.event
  let content
  switch (screen) {
    case 'start':
      content = <StartScreen event={event} onStart={() => { setSession(freshSession()); setScreen('orientation') }}/>
      break
    case 'orientation':
      content = <OrientationScreen value={session.orientation} secondsLeft={secondsLeft} onChange={(orientation) => setSession((current) => ({ ...current, orientation, template: null }))} onNext={() => setScreen('templates')} onBack={() => setScreen('start')}/>
      break
    case 'templates':
      content = <TemplateScreen event={event} session={session} secondsLeft={secondsLeft} onSelect={(template) => setSession((current) => ({ ...current, template }))} onNext={() => setScreen('prints')} onBack={() => setScreen('orientation')}/>
      break
    case 'prints':
      content = <PrintCountScreen event={event} session={session} maximumPrints={snapshot.settings.maximumPrints} secondsLeft={secondsLeft} onUpdate={(value) => setSession((current) => ({ ...current, ...value }))} onNext={() => setScreen('payment')} onBack={() => setScreen('templates')}/>
      break
    case 'payment':
      content = <PaymentScreen secondsLeft={timeoutSeconds} onBack={() => setScreen('prints')} requestQuote={requestQuote} createPayment={createPayment} paymentStatus={paymentStatus} completeFree={completeFree} onComplete={paymentComplete}/>
      break
    case 'camera':
      content = session.template ? <CameraScreen template={session.template} onComplete={(photos) => { setSession((current) => ({ ...current, photos, selectedPhotos: photos.slice(0, current.template?.layout.slots ?? 1) })); setScreen('photos') }}/> : null
      break
    case 'photos':
      content = session.template ? <PhotoSelectionScreen template={session.template} photos={session.photos} initial={session.selectedPhotos} secondsLeft={secondsLeft} onBack={() => setScreen('camera')} onComplete={(selectedPhotos) => { setSession((current) => ({ ...current, selectedPhotos })); setScreen('customize') }}/> : null
      break
    case 'customize':
      content = session.template ? <CustomizeScreen event={event} template={session.template} photos={session.selectedPhotos} value={session.customization} secondsLeft={secondsLeft} printing={printing} onChange={(customization) => setSession((current) => ({ ...current, customization }))} onBack={() => setScreen('photos')} onFinish={() => void finishAndPrint()}/> : null
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
      {idleEnabled && <IdleWarning secondsLeft={secondsLeft} onContinue={resetTimer}/>}
      {!online && <div className="offline-banner">Working from the saved event. Payment needs a connection.</div>}
    </BoothProvider>
  )
}

export default App
