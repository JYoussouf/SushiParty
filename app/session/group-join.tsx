import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';

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
      setScanError('Not a Sushi Party code — try again.');
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

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
          Ask the host — it's on their lobby screen.
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

      {/* Footer actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!canJoin || loading) && styles.primaryBtnDisabled]}
          onPress={() => void handleJoinGroup()}
          disabled={loading || !canJoin}
        >
          {loading ? (
            <ActivityIndicator color="#fffaf2" />
          ) : (
            <Text style={styles.primaryBtnText}>Join the party</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => void handleOpenScanner()}
          disabled={loading}
        >
          <Text style={styles.ghostBtnText}>Scan QR code instead</Text>
        </TouchableOpacity>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf3e3',
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
    backgroundColor: '#ffeed6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ribbonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a4a14',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#21160d',
    lineHeight: 40,
    letterSpacing: -1,
    marginTop: 12,
  },
  heroTitleAccent: {
    color: '#ee5d52',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#7a6452',
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
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.07)',
    shadowColor: '#28160c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  codeBoxFilled: {
    borderColor: 'rgba(40,22,12,0.12)',
  },
  codeBoxActive: {
    borderColor: '#ee5d52',
    borderWidth: 2,
    shadowColor: '#ee5d52',
    shadowOpacity: 0.30,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  codeBoxText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#21160d',
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
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffe5e0',
    borderWidth: 1,
    borderColor: 'rgba(238,93,82,0.25)',
    gap: 6,
  },
  permissionText: {
    fontSize: 13,
    color: '#7a6452',
    lineHeight: 18,
  },
  permissionAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b3372d',
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    gap: 10,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: '#ee5d52',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnDisabled: {
    backgroundColor: '#f7c9c6',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fffaf2',
    letterSpacing: -0.2,
  },
  ghostBtn: {
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3624',
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
