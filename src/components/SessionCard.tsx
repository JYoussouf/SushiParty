import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SushiSession } from '../types';
import { getAttendeeNames, getSessionTotalPieces } from '../lib/sessionSummary';

interface SessionCardProps {
  session: SushiSession;
  onPress: () => void;
}

function getModeLabel(mode: SushiSession['mode']): string {
  if (mode === 'single') return 'Solo';
  if (mode === 'individual') return 'Individual';
  return 'Group';
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const totalPieces = getSessionTotalPieces(session);
  const attendeeNames = getAttendeeNames(session);
  const submittedAt = new Date(session.submittedAt ?? session.startedAt);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {session.restaurantName}
          </Text>
          <Text style={styles.dateText}>
            {submittedAt.toLocaleDateString()} at {submittedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.totalPieces}>{totalPieces} pcs</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{getModeLabel(session.mode)}</Text>
        </View>
        {attendeeNames.length > 0 && (
          <Text style={styles.attendeeText} numberOfLines={1}>
            {attendeeNames.join(' • ')}
          </Text>
        )}
      </View>
      {session.note?.trim() && (
        <Text style={styles.noteText} numberOfLines={2}>
          {session.note.trim()}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardPressed: {
    opacity: 0.86,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  dateText: {
    fontSize: 13,
    color: '#777',
  },
  totalPieces: {
    fontSize: 16,
    fontWeight: '800',
    color: '#e53935',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ffeaea',
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e53935',
  },
  attendeeText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555',
  },
});
