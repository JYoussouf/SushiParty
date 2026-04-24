import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../src/contexts/AuthContext';
import { buildSessionExportCsv, buildSessionExportText } from '../src/lib/exportSessions';
import {
  buildBackupPayload,
  restoreBackupPayload,
  type BackupPayload,
} from '../src/lib/local/backup';
import { getAllSessions } from '../src/lib/local/sessions';

export default function SettingsScreen() {
  const router = useRouter();
  const { userProfile, signOut, refreshProfile } = useAuth();
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleExportHistory = async () => {
    if (!userProfile) return;
    const sessions = await getAllSessions();
    await Share.share({
      title: 'Sushi Party History Export',
      message: `${buildSessionExportText(sessions, userProfile.uid)}\n\nCSV:\n${buildSessionExportCsv(
        sessions,
        userProfile.uid,
      )}`,
    });
  };

  const handleOpenBackup = async () => {
    const payload = await buildBackupPayload();
    setBackupText(JSON.stringify(payload, null, 2));
    setShowBackupModal(true);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const parsed = JSON.parse(restoreText) as BackupPayload;
      await restoreBackupPayload(parsed);
      await refreshProfile();
      setShowRestoreModal(false);
      setRestoreText('');
      Alert.alert('Backup restored', 'Local party data was restored on this device.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Restore failed.';
      Alert.alert('Restore failed', message);
    } finally {
      setRestoring(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Local Data', 'Clear this device profile and all local party history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Settings</Text>
          <Text style={styles.title}>Control the party extras</Text>
          <Text style={styles.subtitle}>
            History export, backup tools, and future sound controls live here.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History Data</Text>
          <TouchableOpacity style={styles.row} onPress={() => void handleExportHistory()}>
            <View>
              <Text style={styles.rowTitle}>Export party history</Text>
              <Text style={styles.rowNote}>Share a readable text and CSV summary of saved parties.</Text>
            </View>
            <Text style={styles.rowAction}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => void handleOpenBackup()}>
            <View>
              <Text style={styles.rowTitle}>Backup local data</Text>
              <Text style={styles.rowNote}>Generate a JSON backup for parties, profile, and templates.</Text>
            </View>
            <Text style={styles.rowAction}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => setShowRestoreModal(true)}>
            <View>
              <Text style={styles.rowTitle}>Restore from backup</Text>
              <Text style={styles.rowNote}>Replace current local party data from a JSON backup.</Text>
            </View>
            <Text style={styles.rowAction}>Paste</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound</Text>
          <View style={styles.row}>
            <View style={styles.soundCopy}>
              <Text style={styles.rowTitle}>Party sounds</Text>
              <Text style={styles.rowNote}>Coming soon: bites, counters, and celebration sound controls.</Text>
            </View>
            <Switch value={false} disabled trackColor={{ false: '#e8ddd6', true: '#e8ddd6' }} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          <TouchableOpacity style={[styles.row, styles.destructiveRow]} onPress={handleReset}>
            <View>
              <Text style={styles.destructiveTitle}>Reset local data</Text>
              <Text style={styles.rowNote}>Remove this device profile and all saved parties.</Text>
            </View>
            <Text style={styles.destructiveAction}>Reset</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showBackupModal} animationType="slide" onRequestClose={() => setShowBackupModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style="dark" />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Backup JSON</Text>
            <TouchableOpacity onPress={() => setShowBackupModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Copy this JSON somewhere safe. It contains your local profile, parties, and templates.
          </Text>
          <TextInput
            style={styles.modalInput}
            value={backupText}
            editable={false}
            multiline
            textAlignVertical="top"
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showRestoreModal} animationType="slide" onRequestClose={() => setShowRestoreModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style="dark" />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Restore Backup</Text>
            <TouchableOpacity onPress={() => setShowRestoreModal(false)} disabled={restoring}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Paste a backup JSON blob to replace the current local profile, parties, and templates.
          </Text>
          <TextInput
            style={styles.modalInput}
            value={restoreText}
            onChangeText={setRestoreText}
            placeholder="Paste backup JSON here"
            placeholderTextColor="#aa9a92"
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.restoreButton, restoring && styles.restoreButtonDisabled]}
            onPress={() => void handleRestore()}
            disabled={restoring}
          >
            {restoring ? <ActivityIndicator color="#fff" /> : <Text style={styles.restoreButtonText}>Restore Backup</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff6ee' },
  scroll: { padding: 20, gap: 18, paddingBottom: 32 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  backButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  backButtonText: { fontSize: 14, fontWeight: '800', color: '#6f4d3d' },
  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#ffead8',
    borderWidth: 1,
    borderColor: '#f5cfb7',
    gap: 8,
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#c46a3c' },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: '#2f221b' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6f5a50' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 21, fontWeight: '900', color: '#2f221b' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  rowTitle: { fontSize: 16, fontWeight: '800', color: '#2f221b' },
  rowNote: { marginTop: 4, fontSize: 13, lineHeight: 19, color: '#816c61', maxWidth: 240 },
  rowAction: { fontSize: 13, fontWeight: '800', color: '#d35a2f' },
  soundCopy: { flex: 1 },
  destructiveRow: { borderColor: '#f2b4a2', backgroundColor: '#fff4ef' },
  destructiveTitle: { fontSize: 16, fontWeight: '800', color: '#b33e1f' },
  destructiveAction: { fontSize: 13, fontWeight: '800', color: '#b33e1f' },
  modalContainer: { flex: 1, backgroundColor: '#fff8f2', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#2f221b' },
  modalClose: { fontSize: 16, fontWeight: '800', color: '#d35a2f' },
  modalText: { fontSize: 14, lineHeight: 21, color: '#6f5a50' },
  modalInput: {
    flex: 1,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efd8ca',
    backgroundColor: '#fff',
    padding: 16,
    fontSize: 14,
    color: '#2f221b',
  },
  restoreButton: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#d35a2f',
  },
  restoreButtonDisabled: { backgroundColor: '#efb49f' },
  restoreButtonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
