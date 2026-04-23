import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SushiCounter } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';

export default function ScoreboardScreen() {
  const { increment, decrement, getCount, totalPieces, reset } = useSession('single');
  const { activeMenu } = useMenu();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sushi Smackdown</Text>
        <Text style={styles.headerSubtitle}>{totalPieces} pieces eaten</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {activeMenu.items.map((item) => (
          <SushiCounter
            key={item.id}
            name={item.name}
            count={getCount(item.id)}
            onIncrement={() => increment(item.id)}
            onDecrement={() => decrement(item.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, totalPieces === 0 && styles.submitBtnDisabled]}
          disabled={totalPieces === 0}
          onPress={() => {
            // TODO: M1 — submit session to Firestore
          }}
        >
          <Text style={styles.submitBtnText}>Submit ({totalPieces})</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e53935',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  list: {
    paddingBottom: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
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
