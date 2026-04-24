import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '../../src/hooks/useSession';

export default function GroupJoinScreen() {
  const router = useRouter();
  const { createGroup, joinGroup, groupCode } = useSession();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      await createGroup();
      router.replace('/(tabs)/scoreboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create a group.';
      Alert.alert('Create group failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Missing code', 'Enter the 6-character group code first.');
      return;
    }

    setLoading(true);
    try {
      await joinGroup(joinCode);
      router.replace('/(tabs)/scoreboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to join that group.';
      Alert.alert('Join failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.hero}>
        <Text style={styles.emoji}>🔗</Text>
        <Text style={styles.title}>Link a Group Party</Text>
        <Text style={styles.subtitle}>
          Create a 6-character code to share or enter one to join an active linked party.
        </Text>
        {groupCode && (
          <View style={styles.codePill}>
            <Text style={styles.codePillLabel}>Current code</Text>
            <Text style={styles.codePillValue}>{groupCode}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Group</Text>
        <Text style={styles.cardText}>
          Start a linked party on this device, then share the generated code with the table.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={() => void handleCreateGroup()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Group Code</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Join Group</Text>
        <Text style={styles.cardText}>
          Enter a host’s code. Linked participants appear on the shared scoreboard and update every second.
        </Text>
        <TextInput
          style={styles.input}
          value={joinCode}
          onChangeText={(text) => setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          placeholderTextColor="#aaa"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.secondaryButtonDisabled]}
          onPress={() => void handleJoinGroup()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Join with Code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    gap: 18,
  },
  hero: {
    backgroundColor: '#fff7f5',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f4d7d4',
    gap: 8,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#222',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
  },
  codePill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0d0cf',
  },
  codePillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#c26a62',
  },
  codePillValue: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#e53935',
  },
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#222',
  },
  primaryButton: {
    marginTop: 2,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#e53935',
  },
  primaryButtonDisabled: {
    backgroundColor: '#ffcdd2',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    marginTop: 2,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#ffeaea',
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e53935',
  },
});
