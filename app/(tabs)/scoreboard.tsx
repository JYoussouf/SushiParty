import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SushiCounter } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';
import { useAuth } from '../../src/contexts/AuthContext';
import { submitSession } from '../../src/lib/firebase/sessions';

const CATEGORY_LABELS: Record<string, string> = {
  nigiri: 'Nigiri',
  sashimi: 'Sashimi',
  roll: 'Rolls',
  special: 'Specials',
  other: 'Other',
};

export default function ScoreboardScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { mode, increment, decrement, getCount, totalPieces, reset, participants } = useSession('single');
  const { activeMenu } = useMenu();
  const [submitting, setSubmitting] = useState(false);

  // Group items by category for section display
  const categorized = activeMenu.items.reduce<Record<string, typeof activeMenu.items>>(
    (acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(item);
      return acc;
    },
    {},
  );

  const handleSubmit = async () => {
    if (totalPieces === 0) return;
    if (!userProfile) {
      Alert.alert('Sign in required', 'Please sign in to save your session.');
      return;
    }
    setSubmitting(true);
    try {
      await submitSession({
        ownerUid: userProfile.uid,
        mode,
        restaurantId: 'unknown',
        restaurantName: 'Unknown Restaurant',
        menuId: activeMenu.id,
        menuVersion: activeMenu.version,
        location: { latitude: 0, longitude: 0 },
        participants,
      });
      Alert.alert(
        'Submitted!',
        `${totalPieces} pieces logged. Nice work${userProfile.displayName ? `, ${userProfile.displayName}` : ''}!`,
        [{ text: 'OK', onPress: reset }],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Submit failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Sushi Smackdown</Text>
          <TouchableOpacity
            style={styles.restaurantBadge}
            onPress={() => router.push('/restaurant/picker')}
          >
            <Text style={styles.restaurantBadgeText}>📍 Choose restaurant</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.modeBtn}
          onPress={() => router.push('/session/mode-select')}
        >
          <Text style={styles.modeBtnText}>
            {mode === 'single' ? '👤' : mode === 'group' ? '🔗' : '📱'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBar}>
        <Text style={styles.totalText}>
          {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'} eaten
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {Object.entries(categorized).map(([cat, items]) => {
          const catCount = items.reduce((s, item) => s + getCount(item.id), 0);
          return (
            <View key={cat}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat] ?? cat}</Text>
                {catCount > 0 && <Text style={styles.categoryCount}>{catCount}</Text>}
              </View>
              {items.map((item) => (
                <SushiCounter
                  key={item.id}
                  name={item.name}
                  count={getCount(item.id)}
                  onIncrement={() => increment(item.id)}
                  onDecrement={() => decrement(item.id)}
                />
              ))}
            </View>
          );
        })}
        <View style={styles.listPadding} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetBtn} onPress={reset} disabled={submitting}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (totalPieces === 0 || submitting) && styles.submitBtnDisabled,
          ]}
          disabled={totalPieces === 0 || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit ({totalPieces})</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#e53935',
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantBadgeText: {
    fontSize: 13,
    color: '#888',
  },
  modeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnText: {
    fontSize: 20,
  },
  totalBar: {
    backgroundColor: '#fff9f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffe0e0',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e53935',
  },
  list: {
    paddingTop: 4,
  },
  listPadding: {
    height: 120,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e53935',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  resetBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#ffcdd2',
  },
  submitBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
});
