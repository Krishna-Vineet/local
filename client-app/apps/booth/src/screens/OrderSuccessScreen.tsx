import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

export const OrderSuccessScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { outcome, resetGuestSession } = useBooth();
  const [seconds, setSeconds] = useState(18);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const isSuccess = outcome?.success !== false;

  useEffect(() => {
    SoundManager.play('success');

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
  }, [navigation, resetGuestSession]);

  const handleFinish = () => {
    SoundManager.play('click');
    resetGuestSession(navigation);
  };

  return (
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.container}>
          <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
            {/* Outcome message card */}
            <View style={styles.copyCard}>
              <View style={[styles.markCircle, !isSuccess && styles.markCircleError]}>
                <Text style={styles.markIcon}>{isSuccess ? '✓' : '⚠'}</Text>
              </View>

              <Text style={styles.eyebrow}>
                {isSuccess ? 'ALL DONE' : 'PRINTING STATUS'}
              </Text>
              <Text style={styles.title}>
                {isSuccess
                  ? 'Your memories are printing!'
                  : 'We couldn’t finish the print.'}
              </Text>
              <Text style={styles.desc}>
                {isSuccess
                  ? 'Please collect your copies from the printer tray. They may still be warm.'
                  : outcome?.error ||
                    'Please ask the booth operator for assistance. Your session has been recorded.'}
              </Text>

              {outcome?.jobId && (
                <View style={styles.jobRef}>
                  <Text style={styles.jobRefLabel}>Print Reference</Text>
                  <Text style={styles.jobRefVal}>{outcome.jobId}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.finishBtn}
                onPress={handleFinish}
                activeOpacity={0.85}
              >
                <Text style={styles.finishBtnText}>Finish Now ({seconds}s)</Text>
              </TouchableOpacity>
            </View>

            {/* Digital Copy QR card */}
            {outcome?.shareUrl ? (
              <View style={styles.downloadCard}>
                <Text style={styles.kicker}>YOUR DIGITAL COPY</Text>
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
                  Open the camera on your phone to scan and download your high-res photos.
                </Text>
                <Text style={styles.qrExpiry}>
                  Link is temporary and expires securely.
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
    backgroundColor: '#121217',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(28),
    width: scale(330),
    alignItems: 'center',
    margin: scale(10),
  },
  markCircle: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
  },
  markCircleError: {
    backgroundColor: '#f59e0b',
  },
  markIcon: {
    color: '#ffffff',
    fontSize: fontSize(32),
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
    backgroundColor: '#18181f',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: verticalScale(16),
    alignItems: 'center',
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
    borderRadius: moderateScale(12),
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  finishBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  downloadCard: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(28),
    width: scale(330),
    alignItems: 'center',
    margin: scale(10),
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
    fontSize: fontSize(20),
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
    backgroundColor: '#121217',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(28),
    width: scale(330),
    alignItems: 'center',
    justifyContent: 'center',
    margin: scale(10),
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
});
