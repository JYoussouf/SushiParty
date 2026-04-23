import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../src/contexts/AuthContext';

export default function ProfileScreen() {
  const { userProfile, firebaseUser, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{userProfile?.displayName ?? '—'}</Text>
          <Text style={styles.username}>
            {userProfile?.username ? `@${userProfile.username}` : ''}
          </Text>
          <Text style={styles.email}>{firebaseUser?.email ?? ''}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Sessions" value="—" note="Coming in M3" />
            <StatCard label="Total pieces" value="—" note="Coming in M3" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.listRow}>
            <Text style={styles.listRowText}>Edit Profile</Text>
            <Text style={styles.listRowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listRow}>
            <Text style={styles.listRowText}>Notifications</Text>
            <Text style={styles.listRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {note && <Text style={statStyles.note}>{note}</Text>}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e53935',
  },
  label: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    color: '#ccc',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    padding: 24,
    gap: 28,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  username: {
    fontSize: 15,
    color: '#888',
  },
  email: {
    fontSize: 13,
    color: '#bbb',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  listRowText: {
    fontSize: 16,
    color: '#222',
  },
  listRowChevron: {
    fontSize: 20,
    color: '#ccc',
  },
  signOutBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff0f0',
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e53935',
  },
});
