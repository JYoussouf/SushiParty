import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function SessionModeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emoji}>🎮</Text>
        <Text style={styles.title}>Session Mode</Text>
        <Text style={styles.subtitle}>Single / Individual / Group — coming in M1</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#222' },
  subtitle: { fontSize: 16, color: '#888', marginTop: 8, textAlign: 'center' },
});
