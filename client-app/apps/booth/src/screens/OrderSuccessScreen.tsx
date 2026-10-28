import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Eyebrow,
  Icon,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
  type IconName,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { useBooth } from '../context/BoothProvider';
import { boothApi } from '@happypix/api';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Post-print screen — a 1:1 translation of Electron's `SuccessScreen.tsx`
 * (`.success-screen`, `.success-layout`, `.download-card`, `.issue-modal-*`).
 *
 * Two changes of substance over the old dark screen:
 *  • the page is light, so it continues the flow instead of jumping to a
 *    different-looking product at the most photographed moment;
 *  • the support modal uses the same card, chip and field styling as the rest of
 *    the app. This modal is the shared design: Electron carries the identical
 *    markup, so a fix here belongs there too.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

const CATEGORIES = [
  { id: 'printing', label: 'Printing / jam', desc: 'Print didn’t come out or jammed', icon: 'printer' as IconName },
  { id: 'payment', label: 'Payment issue', desc: 'Charged but the print failed', icon: 'wallet' as IconName },
  { id: 'quality', label: 'Photo quality', desc: 'Blur, alignment or cut issue', icon: 'camera' as IconName },
  { id: 'general', label: 'Something else', desc: 'A question or general help', icon: 'info' as IconName },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

export const OrderSuccessScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const { outcome, session, installation, snapshot, resetGuestSession, retryPrint, retryShare, retrying } = useBooth();
  const [seconds, setSeconds] = useState(30);
  const [paused, setPaused] = useState(false);
  const autoSharedRef = useRef(false);

  const resolveDownloadWebsiteBase = (snapshotUrl?: string): string => {
    if (snapshotUrl && typeof snapshotUrl === 'string' && snapshotUrl.trim().length > 0) {
      return snapshotUrl.trim().replace(/\/+$/, '');
    }
    const fromEnv = process.env.EXPO_PUBLIC_WEBSITE_URL;
    if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
      return fromEnv.trim().replace(/\/+$/, '');
    }
    return 'https://happypix.vercel.app';
  };

  const websiteBase = resolveDownloadWebsiteBase(snapshot?.settings?.websiteUrl);
  const guaranteedShareUrl = session?.id
    ? websiteBase
      ? `${websiteBase}/download/${encodeURIComponent(session.id)}`
      : `/download/${encodeURIComponent(session.id)}`
    : null;
  const effectiveShareUrl = outcome?.shareUrl || guaranteedShareUrl;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSuccess = outcome?.success !== false;

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [category, setCategory] = useState<CategoryId>('printing');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [issueMessage, setIssueMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  useEffect(() => {
    SoundManager.play('success');
  }, []);

  // Whenever the QR is ready the guest gets a full 30 seconds to scan it.
  useEffect(() => {
    if (effectiveShareUrl) setSeconds(30);
  }, [effectiveShareUrl]);

  // If a digital copy was purchased but the share link has not synced yet, ask again in the background.
  useEffect(() => {
    if (!outcome?.shareUrl && session.digitalCopy !== false && !retrying && !autoSharedRef.current) {
      autoSharedRef.current = true;
      retryShare();
    }
  }, [outcome?.shareUrl, session.digitalCopy, retrying, retryShare]);

  useEffect(() => {
    if (paused || showIssueModal || retrying === 'share') return;
    const interval = setInterval(() => setSeconds((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [paused, showIssueModal, retrying]);

  useEffect(() => {
    if (seconds === 0 && !paused && retrying !== 'share') resetGuestSession(navigation);
  }, [seconds, paused, retrying, navigation, resetGuestSession]);

  const handleFinish = () => {
    SoundManager.play('click');
    resetGuestSession(navigation);
  };

  const handleOpenIssue = () => {
    SoundManager.play('click');
    setPaused(true);
    setShowIssueModal(true);
  };

  const handleCloseIssue = () => {
    SoundManager.play('click');
    setShowIssueModal(false);
    setSubmittedTicketId(null);
    setTicketError(null);
    setPaused(false);
  };

  const canSubmit = Boolean(guestContact.trim() && issueMessage.trim() && !submitting);

  const handleSubmitIssue = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setTicketError(null);
    try {
      const res = await boothApi.submitTicket(installation, {
        name: guestName.trim() || 'Booth Guest',
        email: guestContact.trim(),
        subject: `Booth issue: ${category.toUpperCase()}`,
        message: issueMessage.trim(),
        category,
        sessionId: session.id,
        paymentReference: session.payment?.paymentId || undefined,
        eventId: snapshot?.event?.id,
        deviceId: installation?.deviceId,
      });

      if (!res.ticketId) throw new Error('No ticket reference was returned.');
      SoundManager.play('success');
      setSubmittedTicketId(res.ticketId);
    } catch {
      // Never invent a reference — tell the guest honestly and let them retry.
      setTicketError('Could not reach HappyPix support. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      step="customize"
      hideProgress
      title="All done"
      subtitle={isSuccess ? 'Collect your prints and your digital copy' : 'Let’s get your prints sorted'}
      secondsLeft={seconds}
      testID="success-screen"
    >
      <View style={[styles.layout, isLandscape ? styles.layoutLandscape : styles.layoutPortrait]}>
        {/* ── outcome ─────────────────────────────────────────────────────── */}
        <View style={styles.copyColumn}>
          <View
            style={[
              styles.mark,
              { backgroundColor: isSuccess ? p.green : p.red, shadowColor: isSuccess ? p.green : p.red },
            ]}
          >
            <Icon name={isSuccess ? 'check' : 'x'} size={scale(52)} color="#ffffff" strokeWidth={2.2} />
          </View>

          <Eyebrow color={p.pinkDeep}>{isSuccess ? 'All done' : 'Printing needs help'}</Eyebrow>
          <Text style={[styles.title, { color: p.ink }]}>
            {isSuccess
              ? 'Your memories are printing!'
              : outcome?.error && outcome.error.toLowerCase().includes('printer')
              ? 'Printer not connected'
              : 'We couldn’t finish the print.'}
          </Text>
          <Text style={[styles.body, { color: p.muted }]}>
            {isSuccess
              ? 'Please collect every copy from the printer tray. They may still be warm.'
              : outcome?.error ||
                'No printer is connected right now. Your digital photos are safe — please ask the booth attendant to check the printer and tap retry.'}
          </Text>

          {outcome?.jobId ? (
            <Text style={[styles.jobRef, { color: p.faint }]}>
              Print job <Text style={{ color: p.ink, fontFamily: fonts.bodyHeavy }}>{outcome.jobId}</Text>
            </Text>
          ) : null}

          {!isSuccess ? (
            <Button
              label={retrying === 'print' ? 'Retrying…' : 'Retry print'}
              variant="secondary"
              icon="refresh"
              loading={retrying === 'print'}
              onPress={() => {
                SoundManager.play('click');
                retryPrint();
              }}
              fullWidth
              style={{ marginTop: verticalScale(10) }}
            />
          ) : null}

          <Button
            label="Finish now"
            iconRight="arrow-right"
            onPress={handleFinish}
            fullWidth
            style={{ marginTop: verticalScale(14) }}
            testID="success-finish"
          >
            <Text style={styles.finishInner}>Finish now · {seconds}s</Text>
          </Button>

          <Pressable
            onPress={handleOpenIssue}
            style={styles.raiseLink}
            accessibilityRole="button"
            accessibilityLabel="Raise a guest support ticket"
          >
            <Icon name="info" size={fontSize(14)} color={p.pinkDeep} />
            <Text style={[styles.raiseText, { color: p.pinkDeep }]}>Need help? Raise a support ticket</Text>
          </Pressable>
        </View>

        {/* ── digital pass / thank you ────────────────────────────────────── */}
        {session.digitalCopy !== false && effectiveShareUrl ? (
          <Card elevation="card" style={styles.sideCard}>
            <Eyebrow color={p.pinkDeep}>Your digital pass</Eyebrow>
            <Text style={[styles.sideTitle, { color: p.ink }]}>Scan. Save. Share.</Text>
            <View style={[styles.qrFrame, { borderColor: p.line }]}>
              <QRCode value={effectiveShareUrl} size={scale(190)} backgroundColor="#ffffff" color="#281637" />
            </View>
            <Text style={[styles.sideBody, { color: p.ink }]}>Open the camera on your phone and scan this code.</Text>
            <Text style={[styles.sideFine, { color: p.faint }]}>Secured link · valid for 24 hours</Text>
            <Text numberOfLines={2} style={[styles.sideUrl, { color: p.faint }]}>
              {effectiveShareUrl}
            </Text>
          </Card>
        ) : (
          <Card elevation="card" style={styles.sideCard}>
            <Icon name="heart" size={scale(46)} color={p.pinkDeep} />
            <Text style={[styles.sideTitle, { color: p.ink }]}>Thank you for making memories with us.</Text>
            <Text style={[styles.sideFine, { color: p.muted }]}>
              This screen resets automatically for the next guest.
            </Text>
          </Card>
        )}
      </View>

      {/* ── guest support modal ───────────────────────────────────────────── */}
      <Modal visible={showIssueModal} transparent animationType="fade" onRequestClose={handleCloseIssue}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: p.surface, borderColor: p.line }]}>
            <View style={styles.modalKickerRow}>
              <Icon name="sparkles" size={fontSize(14)} color={p.pinkDeep} />
              <Text style={[styles.modalKicker, { color: p.pinkDeep }]}>GUEST SUPPORT</Text>
            </View>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: p.ink }]}>How can we help?</Text>
              <Pressable
                onPress={handleCloseIssue}
                style={[styles.modalClose, { borderColor: p.line, backgroundColor: p.surfaceSoft }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="x" size={fontSize(15)} color={p.muted} />
              </Pressable>
            </View>
            <Text style={[styles.modalSub, { color: p.muted }]}>
              Tell us what went wrong — the ticket goes straight to this event’s manager, and someone will find
              you at the booth.
            </Text>

            {submittedTicketId ? (
              <View style={styles.ticketSuccess}>
                <View style={[styles.ticketSuccessCircle, { shadowColor: p.green }]}>
                  <Icon name="check" size={scale(28)} color="#ffffff" strokeWidth={2.2} />
                </View>
                <Text style={[styles.ticketSuccessTitle, { color: p.ink }]}>Ticket submitted</Text>
                <Text style={[styles.ticketRef, { color: p.pinkDeep }]}>Reference #{submittedTicketId}</Text>
                <Text style={[styles.ticketSuccessBody, { color: p.muted }]}>
                  The booth operator and the support team have been notified. Someone will assist you shortly.
                </Text>
                <Button label="Done" onPress={handleCloseIssue} fullWidth style={{ marginTop: verticalScale(16) }} />
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          SoundManager.play('select');
                          setCategory(cat.id);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.catChip,
                          {
                            borderColor: active ? '#f0a6c8' : p.line,
                            backgroundColor: active ? p.pinkSoft : p.surfaceSoft,
                          },
                          active ? styles.catChipActive : null,
                        ]}
                      >
                        <View style={[styles.catIcon, { backgroundColor: active ? '#ffffff' : p.surfaceMuted }]}>
                          <Icon name={cat.icon} size={fontSize(14)} color={active ? p.pinkDeep : p.violet} />
                        </View>
                        <View style={styles.catCopy}>
                          <Text style={[styles.catLabel, { color: active ? p.pinkDeep : p.ink }]}>{cat.label}</Text>
                          <Text style={[styles.catDesc, { color: active ? '#a8517a' : p.faint }]}>{cat.desc}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: '#655570' }]}>YOUR CONTACT (EMAIL OR MOBILE)</Text>
                <TextInput
                  value={guestContact}
                  onChangeText={setGuestContact}
                  placeholder="guest@example.com or mobile number"
                  placeholderTextColor={p.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink }]}
                />

                <Text style={[styles.label, { color: '#655570' }]}>GUEST NAME (OPTIONAL)</Text>
                <TextInput
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Your name"
                  placeholderTextColor={p.faint}
                  style={[styles.input, { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink }]}
                />

                <Text style={[styles.label, { color: '#655570' }]}>WHAT HAPPENED?</Text>
                <TextInput
                  value={issueMessage}
                  onChangeText={setIssueMessage}
                  placeholder="Briefly describe what happened (e.g. print tray jammed, blank paper…)"
                  placeholderTextColor={p.faint}
                  multiline
                  style={[styles.input, styles.textArea, { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink }]}
                />

                <View style={[styles.meta, { backgroundColor: p.violetSoft }]}>
                  <Text style={styles.metaText}>
                    Session {session.id ? session.id.slice(-8) : '—'} · Event {snapshot?.event?.name || 'HappyPix'}
                  </Text>
                </View>

                {ticketError ? (
                  <View style={[styles.error, { backgroundColor: p.redSoft, borderColor: '#f4cbd2' }]}>
                    <Icon name="info" size={fontSize(15)} color="#a9364a" />
                    <Text style={styles.errorText}>{ticketError}</Text>
                  </View>
                ) : null}

                <Button
                  label={submitting ? 'Submitting…' : 'Submit support ticket'}
                  iconRight="arrow-right"
                  loading={submitting}
                  disabled={!guestContact.trim() || !issueMessage.trim()}
                  onPress={handleSubmitIssue}
                  fullWidth
                  style={{ marginTop: verticalScale(14) }}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={handleCloseIssue}
                  fullWidth
                  style={{ marginTop: verticalScale(4) }}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </AppShell>
  );
};

const styles = StyleSheet.create({
  layout: { width: '100%', alignSelf: 'center', gap: scale(24) },
  layoutLandscape: { flexDirection: 'row', maxWidth: scale(1080), alignItems: 'center', justifyContent: 'space-between' },
  layoutPortrait: { flexDirection: 'column', maxWidth: scale(560) },

  copyColumn: { flex: 1.08, maxWidth: scale(620) },
  mark: {
    width: scale(96),
    height: scale(96),
    borderRadius: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
    transform: [{ rotate: '-3deg' }],
    shadowOpacity: 0.26,
    shadowRadius: scale(22),
    shadowOffset: { width: 0, height: verticalScale(12) },
    elevation: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize(46),
    lineHeight: Math.round(fontSize(46) * 1.02),
    letterSpacing: -1.2,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(12),
  },
  body: { fontFamily: fonts.body, fontSize: fontSize(15), lineHeight: fontSize(23), maxWidth: scale(560), marginBottom: verticalScale(14) },
  jobRef: { fontFamily: fonts.body, fontSize: fontSize(10), marginBottom: verticalScale(12) },

  finishInner: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(14), color: '#ffffff' },
  raiseLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(7), paddingVertical: verticalScale(12), marginTop: verticalScale(4) },
  raiseText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12), textDecorationLine: 'underline' },

  sideCard: {
    flex: 0.72,
    width: '100%',
    maxWidth: scale(390),
    alignSelf: 'center',
    alignItems: 'center',
    padding: scale(24),
    borderRadius: radii.card,
    gap: verticalScale(10),
  },
  sideTitle: { fontFamily: fonts.display, fontSize: fontSize(26), letterSpacing: -0.6, textAlign: 'center' },
  qrFrame: {
    width: scale(210),
    height: scale(210),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(9),
    marginVertical: verticalScale(4),
  },
  sideBody: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13), textAlign: 'center' },
  sideFine: { fontFamily: fonts.body, fontSize: fontSize(11), textAlign: 'center' },
  sideUrl: { fontFamily: fonts.body, fontSize: fontSize(9), textAlign: 'center' },

  /* modal ─────────────────────────────────────────────────────────────── */
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(22),
    backgroundColor: 'rgba(40,22,55,0.42)',
  },
  modalCard: {
    width: '100%',
    maxWidth: scale(600),
    maxHeight: '92%',
    borderRadius: radii.hero,
    borderWidth: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(22),
    paddingBottom: verticalScale(18),
    ...shadows.card,
  },
  modalKickerRow: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  modalKicker: { fontFamily: fonts.bodyBlack, fontSize: fontSize(10), letterSpacing: 1.7 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: verticalScale(8) },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSize(24), letterSpacing: -0.4 },
  modalClose: { width: scale(34), height: scale(34), borderRadius: scale(17), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalSub: { fontFamily: fonts.body, fontSize: fontSize(12.5), lineHeight: fontSize(18), marginTop: verticalScale(6), marginBottom: verticalScale(14) },
  modalScroll: { maxHeight: scale(520) },
  modalScrollContent: { paddingBottom: verticalScale(4) },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(9) },
  catChip: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(9),
    padding: scale(11),
    borderRadius: moderateScale(16),
    borderWidth: 1,
  },
  catChipActive: { shadowColor: '#d83585', shadowOpacity: 0.12, shadowRadius: scale(9), shadowOffset: { width: 0, height: verticalScale(6) }, elevation: 2 },
  catIcon: { width: scale(28), height: scale(28), borderRadius: moderateScale(9), alignItems: 'center', justifyContent: 'center' },
  catCopy: { flex: 1 },
  catLabel: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12.5) },
  catDesc: { fontFamily: fonts.body, fontSize: fontSize(11), lineHeight: fontSize(15), marginTop: verticalScale(3) },

  label: { fontFamily: fonts.bodyBlack, fontSize: fontSize(10), letterSpacing: 1.3, marginTop: verticalScale(14), marginBottom: verticalScale(7) },
  input: {
    minHeight: verticalScale(50),
    borderWidth: 1,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(15),
    paddingVertical: verticalScale(12),
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize(13.5),
  },
  textArea: { minHeight: verticalScale(84), textAlignVertical: 'top', lineHeight: fontSize(20) },

  meta: { marginTop: verticalScale(14), paddingVertical: verticalScale(9), paddingHorizontal: scale(12), borderRadius: moderateScale(12) },
  metaText: { fontFamily: fonts.bodyBold, fontSize: fontSize(10.5), color: '#6b5a86', textAlign: 'center' },

  error: { flexDirection: 'row', alignItems: 'center', gap: scale(8), borderWidth: 1, borderRadius: moderateScale(12), padding: scale(10), marginTop: verticalScale(10) },
  errorText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: fontSize(12), color: '#a9364a' },

  ticketSuccess: { alignItems: 'center', paddingVertical: verticalScale(10) },
  ticketSuccessCircle: {
    width: scale(62),
    height: scale(62),
    borderRadius: scale(31),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
    backgroundColor: '#21956d',
    shadowOpacity: 0.28,
    shadowRadius: scale(16),
    shadowOffset: { width: 0, height: verticalScale(8) },
    elevation: 6,
  },
  ticketSuccessTitle: { fontFamily: fonts.display, fontSize: fontSize(21), letterSpacing: -0.3 },
  ticketRef: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13), marginTop: verticalScale(4) },
  ticketSuccessBody: { fontFamily: fonts.body, fontSize: fontSize(13), lineHeight: fontSize(19), textAlign: 'center', marginTop: verticalScale(8) },
});

export default OrderSuccessScreen;
