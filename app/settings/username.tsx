import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';

export default function UsernameScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile, changeUsername } = useAuth();

  const [usernameInput, setUsernameInput] = useState(userProfile?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    setUsernameInput(userProfile?.username ?? '');
  }, [userProfile?.username]);

  const currentUsername = userProfile?.username ?? '';
  const trimmedUsername = usernameInput.trim().toLowerCase();
  const usernameDirty = trimmedUsername !== currentUsername;

  const handleChangeUsername = async () => {
    setUsernameError(null);
    setUsernameSaved(false);
    if (!usernameDirty) return;
    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      setUsernameError('Username must be 3-20 characters: letters, numbers, and underscores only.');
      return;
    }
    setUsernameSaving(true);
    try {
      await changeUsername(trimmedUsername);
      setUsernameSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : 'Could not change username.');
    } finally {
      setUsernameSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Username</Text>
          <View style={styles.usernameCard}>
            <View style={styles.usernameInputRow}>
              <View style={styles.usernameInputWrap}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={usernameInput}
                  onChangeText={(text) => {
                    setUsernameInput(text);
                    setUsernameError(null);
                    setUsernameSaved(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={20}
                  placeholder="username"
                  placeholderTextColor={t.color.textTertiary}
                  editable={!usernameSaving}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleChangeUsername()}
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, (!usernameDirty || usernameSaving) && styles.saveBtnDisabled]}
                activeOpacity={0.85}
                disabled={!usernameDirty || usernameSaving}
                onPress={() => void handleChangeUsername()}
              >
                <Text style={styles.saveBtnText}>{usernameSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            {usernameError ? (
              <Text style={styles.usernameError}>{usernameError}</Text>
            ) : usernameSaved ? (
              <Text style={styles.usernameSuccess}>Username updated.</Text>
            ) : (
              <Text style={styles.note}>You can change your username once every 7 days.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    scroll: { padding: 20, gap: 16 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
    usernameCard: {
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      padding: 16,
      gap: 10,
    },
    usernameInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    usernameInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      height: 44,
      borderRadius: t.radius.button,
      backgroundColor: t.color.surfaceAlt,
      borderWidth: 1.5,
      borderColor: t.color.border,
    },
    usernameAt: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textTertiary, marginRight: 2 },
    usernameInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: t.font.bodySemibold,
      color: t.color.textPrimary,
      padding: 0,
      includeFontPadding: false,
    },
    saveBtn: {
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderRadius: t.radius.button,
      backgroundColor: t.color.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontSize: 13,
      fontFamily: t.font.bodyBold,
      color: t.color.onAccent,
      includeFontPadding: false,
    },
    usernameError: { fontSize: 13, lineHeight: 19, fontFamily: t.font.bodySemibold, color: t.color.danger },
    usernameSuccess: { fontSize: 13, lineHeight: 19, fontFamily: t.font.bodySemibold, color: t.color.accent },
    note: { fontSize: 13, lineHeight: 19, fontFamily: t.font.body, color: t.color.textSecondary },
  });
