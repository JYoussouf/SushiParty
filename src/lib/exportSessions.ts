import { getAttendeeNames, getParticipantTotalPieces } from './sessionSummary';
import type { SushiSession } from '../types';

function getUserPieces(session: SushiSession, userId: string): number {
  const participant = session.participants.find((item) => item.userId === userId);
  return participant ? getParticipantTotalPieces(participant) : 0;
}

export function buildSessionExportText(sessions: SushiSession[], userId: string): string {
  const lines = ['Sushi Party History Export', ''];

  for (const session of sessions) {
    const date = new Date(session.submittedAt ?? session.startedAt).toLocaleString();
    lines.push(`${date} — ${session.restaurantName}`);
    lines.push(`Mode: ${session.mode}`);
    lines.push(`Your pieces: ${getUserPieces(session, userId)}`);
    lines.push(`Attendees: ${getAttendeeNames(session).join(', ') || 'None'}`);
    if (session.note?.trim()) {
      lines.push(`Note: ${session.note.trim()}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildSessionExportCsv(sessions: SushiSession[], userId: string): string {
  const rows = [
    ['date', 'restaurant', 'mode', 'your_pieces', 'attendees', 'note'],
    ...sessions.map((session) => [
      new Date(session.submittedAt ?? session.startedAt).toISOString(),
      session.restaurantName,
      session.mode,
      String(getUserPieces(session, userId)),
      getAttendeeNames(session).join(' | '),
      session.note ?? '',
    ]),
  ];

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}
