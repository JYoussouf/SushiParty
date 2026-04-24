import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getFriendById, getFriendSessions } from '../../src/lib/local/friends';
import { getSessionTotalPieces } from '../../src/lib/sessionSummary';
import type { SushiSession, User } from '../../src/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function FriendProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [friend, setFriend] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SushiSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const id = typeof params.id === 'string' ? params.id : '';
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [friendProfile, friendSessions] = await Promise.all([
        getFriendById(id),
        getFriendSessions(id),
      ]);
      setFriend(friendProfile);
      setSessions(friendSessions);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingState}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#e53935" />
      </SafeAreaView>
    );
  }

  if (!friend) {
    return (
      <SafeAreaView style={styles.loadingState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyText}>Friend not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(friend.displayName)}</Text>
          </View>
          <Text style={styles.name}>{friend.displayName}</Text>
          <Text style={styles.username}>@{friend.username}</Text>
          <Text style={styles.heroMeta}>{sessions.length} recent parties in local social mode</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Parties</Text>
          {sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.restaurantName}>{session.restaurantName}</Text>
                <Text style={styles.totalPieces}>{getSessionTotalPieces(session)} pcs</Text>
              </View>
              <Text style={styles.sessionMeta}>
                {new Date(session.submittedAt ?? session.startedAt).toLocaleDateString()} •{' '}
                {session.mode}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingState: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#fff6f3',
    borderWidth: 1,
    borderColor: '#f5ddd7',
    gap: 6,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e53935',
    marginBottom: 6,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
  },
  username: {
    fontSize: 15,
    color: '#888',
  },
  heroMeta: {
    fontSize: 13,
    color: '#777',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  sessionCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  restaurantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  totalPieces: {
    fontSize: 15,
    fontWeight: '800',
    color: '#e53935',
  },
  sessionMeta: {
    fontSize: 13,
    color: '#777',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
  },
});
