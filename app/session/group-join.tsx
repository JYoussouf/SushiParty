import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';

type CameraPermState = 'undetermined' | 'granted' | 'denied' | 'denied-permanent';

const CODE_LENGTH = 6;

function extractGroupCode(scanned: string): string | null {
  const match = /[?&]code=([A-Z0-9]{6})/i.exec(scanned);
  if (match?.[1]) return match[1].toUpperCase();
  const raw = scanned.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length === 6) return raw;
  return null;
}

export default function GroupJoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { joinGroup } = useSession();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermState>('undetermined');
  const [scanError, setScanError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const scannedRef = useRef(false);
  const handledDeepLinkRef = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const deepLinkedCode = useMemo(
    () => (Array.isArray(params.code) ? params.code[0] : params.code)?.toUpperCase() ?? '',
    [params.code],
  );

  const handleJoinGroup = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? joinCode).trim();
    if (code.length !== CODE_LENGTH) {
      Alert.alert('Invalid code', 'Enter the full 6-character party code first.');
      return;
    }

    setLoading(true);
    try {
      await joinGroup(code);
      router.replace('/session/lobby');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to join that party.';
      Alert.alert('Join failed', message);
    } finally {
      setLoading(false);
    }
  }, [joinCode, joinGroup, router]);

  useEffect(() => {
    if (!deepLinkedCode) return;
    if (handledDeepLinkRef.current === deepLinkedCode) return;

    const normalized = extractGroupCode(deepLinkedCode);
    if (!normalized) {
      setJoinCode(deepLinkedCode.replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH));
      return;
    }

    handledDeepLinkRef.current = deepLinkedCode;
    setJoinCode(normalized);
    void handleJoinGroup(normalized);
  }, [deepLinkedCode, handleJoinGroup]);

  // Focus the hidden input on mount so the keyboard is up immediately for
  // manual code entry. Skip when arriving via a deep link that auto-joins (the
  // keyboard would flash before we navigate away) or while the QR scanner is
  // open (the keyboard would fight the camera). The short delay lets the screen
  // transition settle — focusing synchronously mid-transition often fails to
  // raise the keyboard in React Native.
  useEffect(() => {
    if (deepLinkedCode || scanning) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenScanner = async () => {
    setScanError(null);
    const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setCameraPermission('granted');
      scannedRef.current = false;
      setScanning(true);
    } else {
      setCameraPermission(canAskAgain ? 'denied' : 'denied-permanent');
    }
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    const code = extractGroupCode(data);
    if (!code) {
      setScanError('Not a Sushi Party code - try again.');
      scannedRef.current = false;
      return;
    }

    setScanning(false);
    setJoinCode(code);
    void handleJoinGroup(code);
  };

  const handleCloseScanner = () => {
    setScanning(false);
    scannedRef.current = false;
    setScanError(null);
  };

  const focusInput = () => inputRef.current?.focus();
  const canJoin = joinCode.length === CODE_LENGTH;

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
      >

      {/* Top bar */}
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} disabled={loading} />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>Join</Text>
        </View>
        <Text style={styles.heroTitle}>
          Drop the{'\n'}6-letter <Text style={styles.heroTitleAccent}>code</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Ask the host - it's on their lobby screen.
        </Text>
      </View>

      {/* Code input */}
      <Pressable style={styles.codeWrap} onPress={focusInput}>
        <View style={styles.codeRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const char = joinCode[i] ?? '';
            const isFilled = !!char;
            const isActive = inputFocused && i === joinCode.length;
            return (
              <View
                key={i}
                style={[
                  styles.codeBox,
                  isFilled && styles.codeBoxFilled,
                  isActive && styles.codeBoxActive,
                ]}
              >
                <Text style={styles.codeBoxText}>{char}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={joinCode}
          onChangeText={(text) =>
            setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))
          }
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          caretHidden
          selectionColor="transparent"
        />
      </Pressable>

      {/* Permission banner */}
      {cameraPermission === 'denied' && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>Camera access is needed to scan QR codes.</Text>
          <TouchableOpacity onPress={() => void handleOpenScanner()}>
            <Text style={styles.permissionAction}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
      {cameraPermission === 'denied-permanent' && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>Camera access is blocked. Enable it in Settings.</Text>
          <TouchableOpacity onPress={() => void Linking.openSettings()}>
            <Text style={styles.permissionAction}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Submit actions — placed right under the code row so they stay
          visible above the keyboard instead of being pinned to the bottom. */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtnShadow, (!canJoin || loading) && styles.primaryBtnShadowDisabled]}
          onPress={() => void handleJoinGroup()}
          disabled={loading || !canJoin}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={(!canJoin || loading) ? [t.color.surfaceAlt, t.color.surfaceAlt] : t.color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            {loading ? (
              <ActivityIndicator color={t.color.onAccent} />
            ) : (
              <Text style={[styles.primaryBtnText, !canJoin && styles.primaryBtnTextDisabled]}>Join the party</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => void handleOpenScanner()}
          disabled={loading}
        >
          <Text style={styles.ghostBtnText}>Scan QR code instead</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      {/* QR scanner modal */}
      <Modal visible={scanning} animationType="fade" statusBarTranslucent>
        <View style={styles.cameraOverlay}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <SafeAreaView style={styles.cameraUI}>
            <TouchableOpacity
              style={[styles.closeButton, { top: insets.top + 16 }]}
              onPress={handleCloseScanner}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.scanCenter}>
              <View style={styles.scanFrame} />
              {scanError && (
                <View style={styles.scanErrorBanner}>
                  <Text style={styles.scanErrorText}>{scanError}</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  safe: {
    flex: 1,
  },
  kb: {
    flex: 1,
  },

  // ── Top bar ─────────────────────────────────────────────
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // ── Hero ────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 6,
  },
  ribbon: {
    alignSelf: 'flex-start',
    backgroundColor: t.color.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: t.radius.pill,
  },
  ribbonText: {
    fontSize: 11,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
    lineHeight: 40,
    letterSpacing: -1,
    marginTop: 12,
  },
  heroTitleAccent: {
    color: t.color.accent,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },

  // ── Code input boxes ────────────────────────────────────
  codeWrap: {
    paddingHorizontal: 24,
    paddingTop: 32,
    position: 'relative',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 0.84,
    borderRadius: t.radius.md,
    backgroundColor: t.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  codeBoxFilled: {
    borderColor: t.color.border,
  },
  codeBoxActive: {
    borderColor: t.color.accent,
    borderWidth: 2,
    ...t.shadow.glow(t.color.accent),
  },
  codeBoxText: {
    fontSize: 32,
    fontFamily: t.font.displayItalic,
    color: t.color.textPrimary,
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    color: 'transparent',
  },

  // ── Permission banner ───────────────────────────────────
  permissionBanner: {
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: t.radius.md,
    padding: 14,
    backgroundColor: t.color.accentSoft,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 6,
  },
  permissionText: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    lineHeight: 18,
  },
  permissionAction: {
    fontSize: 13,
    fontFamily: t.font.bodyBold,
    color: t.color.accent,
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 10,
  },
  primaryBtnShadow: {
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  primaryBtnShadowDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtn: {
    height: 56,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    letterSpacing: -0.2,
  },
  primaryBtnTextDisabled: {
    color: t.color.textTertiary,
  },
  ghostBtn: {
    height: 44,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },

  // ── Camera modal ────────────────────────────────────────
  cameraOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraUI: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  scanCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  scanErrorBanner: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  scanErrorText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});
