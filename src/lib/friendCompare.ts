import type { UserProfileStats } from './profileStats';

export interface ComparisonRow {
  label: string;
  youValue: number;
  friendValue: number;
  /** 'you' | 'friend' | 'tie' — who leads this row. */
  leader: 'you' | 'friend' | 'tie';
}

export interface FriendComparison {
  rows: ComparisonRow[];
  youWins: number;
  friendWins: number;
  headline: string;
}

function leaderOf(you: number, friend: number): ComparisonRow['leader'] {
  if (you > friend) return 'you';
  if (friend > you) return 'friend';
  return 'tie';
}

/**
 * Head-to-head numeric comparison between the current user and a friend.
 * Stats-only: no messaging, no social actions — just who's ahead on pace.
 */
export function buildFriendComparison(
  you: UserProfileStats,
  friend: UserProfileStats,
  friendName: string,
): FriendComparison {
  const rows: ComparisonRow[] = [
    {
      label: 'Parties',
      youValue: you.totalSessions,
      friendValue: friend.totalSessions,
      leader: leaderOf(you.totalSessions, friend.totalSessions),
    },
    {
      label: 'Total pieces',
      youValue: you.totalPieces,
      friendValue: friend.totalPieces,
      leader: leaderOf(you.totalPieces, friend.totalPieces),
    },
    {
      label: 'Avg / party',
      youValue: you.averagePiecesPerSession,
      friendValue: friend.averagePiecesPerSession,
      leader: leaderOf(you.averagePiecesPerSession, friend.averagePiecesPerSession),
    },
  ];

  const youWins = rows.filter((row) => row.leader === 'you').length;
  const friendWins = rows.filter((row) => row.leader === 'friend').length;

  let headline: string;
  if (youWins > friendWins) headline = `You're out-eating ${friendName}`;
  else if (friendWins > youWins) headline = `${friendName} is ahead of you`;
  else headline = `You and ${friendName} are neck and neck`;

  return { rows, youWins, friendWins, headline };
}
