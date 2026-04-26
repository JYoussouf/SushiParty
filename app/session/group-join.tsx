import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { useSession } from '../../src/hooks/useSession';

type CameraPermState = 'undetermined' | 'granted' | 'denied' | 'denied-permanent';

function extractGroupCode(scanned: string): string | null {
  // Deep-link: sushiparty://session/group-join?code=ABC123
  const match = /[?&]code=([A-Z0-9]{6})/i.exec(scanned);
  if (match?.[1]) return match[1].toUpperCase();
  // Raw 6-char code fallback
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
  const scannedRef = useRef(false);
  const handledDeepLinkRef = useRef<string | null>(null);

  const deepLinkedCode = useMemo(
    () => (Array.isArray(params.code) ? params.code[0] : params.code)?.toUpperCase() ?? '',
    [params.code],
  );

  const handleJoinGroup = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? joinCode).trim();
    if (code.length !== 6) {
      Alert.alert('Invalid code', 'Enter the full 6-character party code first.');
      return;
    }

    setLoading(true);
    try {
      await joinGroup(code);
      router.replace('/session/mode-select');
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
      setJoinCode(deepLinkedCode.replace(/[^A-Z0-9]/g, '').slice(0, 6));
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

  const canJoin = joinCode.length === 6;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.hero}>
        <Text style={styles.emoji}>🍣</Text>
        <Text style={styles.title}>Join a Sushi Party</Text>
        <Text style={styles.subtitle}>
          Scan your friend's QR code, or type the 6-character party code below.
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.scanButton, loading && styles.scanButtonDisabled]}
          onPress={() => void handleOpenScanner()}
          disabled={loading}
        >
          <Text style={styles.scanButtonText}>📷  Scan QR Code</Text>
        </TouchableOpacity>

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

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter code</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Party code</Text>
        <TextInput
          style={styles.input}
          value={joinCode}
          onChangeText={(text) =>
            setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
          }
          placeholder="ABC123"
          placeholderTextColor="#aa9a92"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.joinButton, (!canJoin || loading) && styles.joinButtonDisabled]}
          onPress={() => void handleJoinGroup()}
          disabled={loading || !canJoin}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.joinButtonText}>Jump In</Text>
          )}
        </TouchableOpacity>
      </View>

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
    backgroundColor: '#fff5ec',
    padding: 20,
    gap: 18,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#ffe4d1',
    borderWidth: 1,
    borderColor: '#f5c6aa',
    gap: 8,
  },
  emoji: { fontSize: 42 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: '#2d2019' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6f594d' },
  card: {
    borderRadius: 26,
    padding: 18,
    gap: 14,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  scanButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2d2019',
  },
  scanButtonDisabled: { backgroundColor: '#7a6a62' },
  scanButtonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  permissionBanner: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff0e8',
    borderWidth: 1,
    borderColor: '#f5c6aa',
    gap: 6,
  },
  permissionText: { fontSize: 13, color: '#6f594d' },
  permissionAction: { fontSize: 13, fontWeight: '800', color: '#df5a31' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ead5ca' },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#aa9a92',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#aa6a49',
  },
  input: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5d1c6',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#2d2019',
  },
  joinButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#df5a31',
  },
  joinButtonDisabled: { backgroundColor: '#efb39d' },
  joinButtonText: { fontSize: 16, fontWeight: '900', color: '#fff' },
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
  closeButtonText: { fontSize: 18, color: '#fff', fontWeight: '700' },
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
  scanErrorText: { fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
});
