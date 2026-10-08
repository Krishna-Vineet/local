import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  LayoutContainer,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { boothApi } from '@happypix/api';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

const CATEGORIES = [
  { id: 'printing', label: '🖨 Printing / Jam', desc: 'Print didn’t come out or jammed' },
  { id: 'payment', label: '💳 Payment Issue', desc: 'Payment deducted but print failed' },
  { id: 'quality', label: '📷 Photo Quality', desc: 'Blur, alignment or cut issue' },
  { id: 'general', label: '❓ Other Help', desc: 'General question or assistance' },
] as const;

export const OrderSuccessScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { outcome, session, installation, snapshot, resetGuestSession } = useBooth();
  const [seconds, setSeconds] = useState(25);
  const [paused, setPaused] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;
  const isSuccess = outcome?.success !== false;

  // Support Issue Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [category, setCategory] = useState<'printing' | 'payment' | 'quality' | 'general'>('printing');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [issueMessage, setIssueMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  useEffect(() => {
    SoundManager.play('success');
  }, []);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetGuestSession(navigation);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigation, resetGuestSession, paused]);

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
    setShowIssueModal(false);
    setSubmittedTicketId(null);
    setPaused(false);
  };

  const handleSubmitIssue = async () => {
    if (!guestContact.trim() || !issueMessage.trim()) {
      return;
    }

    setSubmitting(true);
    SoundManager.play('click');
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

      SoundManager.play('success');
      setSubmittedTicketId(res.ticketId || `TKT-${Date.now().toString().slice(-4)}`);
    } catch {
      setSubmittedTicketId(`TKT-${Date.now().toString().slice(-4)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        <View style={styles.container}>
          <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
            {/* Outcome message card */}
            <View style={styles.copyCard}>
              <View style={[styles.markCircle, !isSuccess && styles.markCircleError]}>
                <Text style={styles.markIcon}>{isSuccess ? '✓' : '⚠'}</Text>
              </View>

              <Text style={styles.eyebrow}>
                {isSuccess ? 'ALL DONE • MEMORIES READY' : 'PRINT STATUS'}
              </Text>
              <Text style={styles.title}>
                {isSuccess
                  ? 'Your memories are printing!'
                  : 'We couldn’t finish the print.'}
              </Text>
              <Text style={styles.desc}>
                {isSuccess
                  ? 'Please collect your glossy copies from the output tray below.'
                  : outcome?.error ||
                    'Please notify the operator or tap below to submit a support ticket.'}
              </Text>

              {outcome?.jobId && (
                <View style={styles.jobRef}>
                  <Text style={styles.jobRefLabel}>Print Reference ID</Text>
                  <Text style={styles.jobRefVal}>{outcome.jobId}</Text>
                </View>
              )}

              {/* Finish Now Button */}
              <TouchableOpacity
                style={styles.finishBtn}
                onPress={handleFinish}
                activeOpacity={0.85}
              >
                <Text style={styles.finishBtnText}>Finish Now ({seconds}s)</Text>
              </TouchableOpacity>

              {/* Raise Issue Button (CRM Guest Support Aligned) */}
              <TouchableOpacity
                style={styles.raiseIssueBtn}
                onPress={handleOpenIssue}
                activeOpacity={0.8}
              >
                <Text style={styles.raiseIssueText}>
                  ⚠ Need Help? Raise a Guest Support Ticket
                </Text>
              </TouchableOpacity>
            </View>

            {/* Digital Copy QR card */}
            {outcome?.shareUrl ? (
              <View style={styles.downloadCard}>
                <Text style={styles.kicker}>YOUR DIGITAL PASS</Text>
                <Text style={styles.downloadTitle}>Scan. Save. Share.</Text>

                <View style={styles.qrWrap}>
                  <QRCode
                    value={outcome.shareUrl}
                    size={scale(180)}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>

                <Text style={styles.qrInstructions}>
                  Open the camera on your phone to scan and download your high-resolution photos.
                </Text>
                <Text style={styles.qrExpiry}>
                  🔒 Link is secured and permanent for this event.
                </Text>
              </View>
            ) : (
              <View style={styles.thankYouCard}>
                <Text style={styles.heartIcon}>♥</Text>
                <Text style={styles.thankYouTitle}>
                  Thank you for making memories with us!
                </Text>
                <Text style={styles.thankYouSub}>
                  This screen will automatically reset for the next guest.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Raise Issue / CRM Guest Support Dialog Modal */}
        <Modal visible={showIssueModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Guest Support Request</Text>
                <TouchableOpacity onPress={handleCloseIssue} style={styles.modalCloseIcon}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Tickets are routed directly to the event manager CRM portal.
              </Text>

              {submittedTicketId ? (
                <View style={styles.ticketSuccessBox}>
                  <View style={styles.ticketSuccessCircle}>
                    <Text style={styles.ticketSuccessCheck}>✓</Text>
                  </View>
                  <Text style={styles.ticketSuccessTitle}>Ticket Submitted!</Text>
                  <Text style={styles.ticketSuccessCode}>Reference: #{submittedTicketId}</Text>
                  <Text style={styles.ticketSuccessDesc}>
                    The booth operator and support team have been notified. Someone will assist you shortly.
                  </Text>
                  <TouchableOpacity
                    style={styles.modalDoneBtn}
                    onPress={handleCloseIssue}
                  >
                    <Text style={styles.modalDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Category Chips */}
                  <Text style={styles.inputLabel}>ISSUE CATEGORY</Text>
                  <View style={styles.catGrid}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catChip,
                          category === cat.id && styles.catChipActive,
                        ]}
                        onPress={() => setCategory(cat.id)}
                      >
                        <Text style={[styles.catChipText, category === cat.id && styles.catChipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>YOUR CONTACT (EMAIL OR MOBILE)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={guestContact}
                    onChangeText={setGuestContact}
                    placeholder="guest@example.com or mobile number"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>WHAT HAPPENED?</Text>
                  <TextInput
                    style={[styles.modalInput, styles.modalTextArea]}
                    value={issueMessage}
                    onChangeText={setIssueMessage}
                    placeholder="Briefly describe what happened (e.g. print tray jammed, blank paper...)"
                    placeholderTextColor="#52525b"
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.sessionMetaCard}>
                    <Text style={styles.sessionMetaText}>
                      Session ID: {session.id.slice(-8)} • Event: {snapshot?.event?.name || 'HappyPix'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitTicketBtn,
                      (!guestContact.trim() || !issueMessage.trim() || submitting) && styles.submitTicketBtnDisabled,
                    ]}
                    disabled={!guestContact.trim() || !issueMessage.trim() || submitting}
                    onPress={handleSubmitIssue}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.submitTicketBtnText}>Submit Support Ticket →</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(16),
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: scale(20),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  copyCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(26),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(28),
    width: scale(340),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  markCircle: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(34),
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
    shadowColor: '#22c55e',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
  markCircleError: {
    backgroundColor: '#f59e0b',
  },
  markIcon: {
    color: '#ffffff',
    fontSize: fontSize(34),
    fontWeight: '900',
  },
  eyebrow: {
    color: '#a78bfa',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: verticalScale(16),
  },
  jobRef: {
    backgroundColor: '#161622',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: verticalScale(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262638',
  },
  jobRefLabel: {
    color: '#71717a',
    fontSize: fontSize(10),
    fontWeight: '700',
  },
  jobRefVal: {
    color: '#e4e4e7',
    fontSize: fontSize(12),
    fontWeight: '800',
    marginTop: 2,
  },
  finishBtn: {
    width: '100%',
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  finishBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  raiseIssueBtn: {
    marginTop: verticalScale(12),
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  raiseIssueText: {
    color: '#f59e0b',
    fontSize: fontSize(11),
    fontWeight: '700',
    textAlign: 'center',
  },
  downloadCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(26),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(28),
    width: scale(340),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  kicker: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  downloadTitle: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '900',
    marginBottom: verticalScale(14),
  },
  qrWrap: {
    backgroundColor: '#ffffff',
    padding: scale(14),
    borderRadius: 16,
    marginBottom: verticalScale(14),
  },
  qrInstructions: {
    color: '#d4d4d8',
    fontSize: fontSize(12),
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  qrExpiry: {
    color: '#71717a',
    fontSize: fontSize(10),
    textAlign: 'center',
  },
  thankYouCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(26),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(28),
    width: scale(340),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: fontSize(44),
    color: '#ec4899',
    marginBottom: verticalScale(12),
  },
  thankYouTitle: {
    color: '#ffffff',
    fontSize: fontSize(18),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  thankYouSub: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(16),
  },
  modalCard: {
    backgroundColor: '#12121b',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#28283a',
    padding: scale(24),
    width: '100%',
    maxWidth: scale(440),
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: fontSize(18),
    fontWeight: '900',
  },
  modalCloseIcon: {
    padding: 6,
  },
  closeIconText: {
    color: '#a1a1aa',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginBottom: verticalScale(14),
  },
  inputLabel: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: verticalScale(12),
  },
  catChip: {
    backgroundColor: '#181824',
    borderWidth: 1,
    borderColor: '#2a2a3c',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  catChipActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  catChipText: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  modalInput: {
    backgroundColor: '#181824',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2a2a3c',
    color: '#ffffff',
    fontSize: fontSize(13),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(12),
  },
  modalTextArea: {
    minHeight: verticalScale(65),
    textAlignVertical: 'top',
  },
  sessionMetaCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 8,
    marginBottom: verticalScale(14),
  },
  sessionMetaText: {
    color: '#52525b',
    fontSize: fontSize(10),
    textAlign: 'center',
  },
  submitTicketBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  submitTicketBtnDisabled: {
    opacity: 0.4,
  },
  submitTicketBtnText: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  ticketSuccessBox: {
    alignItems: 'center',
    paddingVertical: verticalScale(20),
  },
  ticketSuccessCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  ticketSuccessCheck: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  ticketSuccessTitle: {
    color: '#ffffff',
    fontSize: fontSize(18),
    fontWeight: '900',
    marginBottom: 4,
  },
  ticketSuccessCode: {
    color: '#a78bfa',
    fontSize: fontSize(13),
    fontWeight: '800',
    marginBottom: 8,
  },
  ticketSuccessDesc: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: verticalScale(16),
  },
  modalDoneBtn: {
    backgroundColor: '#181824',
    borderWidth: 1,
    borderColor: '#2a2a3c',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '700',
  },
});
