import { getParticipantTotalPieces } from './sessionSummary';
import type { FriendChallengeProgress, SushiSession } from '../types';

function sameMonth(date: string, reference: Date): boolean {
  const value = new Date(date);
  return (
    value.getFullYear() === reference.getFullYear() &&
    value.getMonth() === reference.getMonth()
  );
}

function sameWeek(date: string, reference: Date): boolean {
  const value = new Date(date);
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return value >= start && value < end;
}

function getUserSessions(sessions: SushiSession[], userId: string): SushiSession[] {
  return sessions.filter((session) =>
    session.participants.some((participant) => participant.userId === userId),
  );
}

function getUserPiecesFromSessions(sessions: SushiSession[], userId: string): number {
  return sessions.reduce((sum, session) => {
    const participant = session.participants.find((item) => item.userId === userId);
    return sum + (participant ? getParticipantTotalPieces(participant) : 0);
  }, 0);
}

export function getFriendChallenges(
  userSessions: SushiSession[],
  friendSessions: SushiSession[],
  currentUserId: string,
  friendIds: string[],
): FriendChallengeProgress[] {
  const now = new Date();
  const allFriendUserSessions = friendIds.flatMap((friendId) => getUserSessions(friendSessions, friendId));

  const currentWeekSessions = userSessions.filter((session) =>
    sameWeek(session.submittedAt ?? session.startedAt, now),
  );
  const currentMonthSessions = userSessions.filter((session) =>
    sameMonth(session.submittedAt ?? session.startedAt, now),
  );

  const friendMonthAverage =
    friendIds.length === 0
      ? 0
      : friendIds.reduce(
          (sum, friendId) =>
            sum +
            getUserSessions(allFriendUserSessions, friendId).filter((session) =>
              sameMonth(session.submittedAt ?? session.startedAt, now),
            ).length,
          0,
        ) / friendIds.length;

  return [
    {
      id: 'weekly-pieces',
      title: '50 Pieces This Week',
      description: 'Beat the table pace by reaching 50 personal pieces this week.',
      target: 50,
      currentUserProgress: getUserPiecesFromSessions(currentWeekSessions, currentUserId),
      friendAverageProgress:
        friendIds.length === 0
          ? 0
          : friendIds.reduce((sum, friendId) => {
              const sessions = allFriendUserSessions.filter((session) =>
                sameWeek(session.submittedAt ?? session.startedAt, now) &&
                session.participants.some((participant) => participant.userId === friendId),
              );
              return sum + getUserPiecesFromSessions(sessions, friendId);
            }, 0) / friendIds.length,
      unit: 'pieces',
    },
    {
      id: 'monthly-restaurants',
      title: '3 Spots This Month',
      description: 'Visit three sushi restaurants in the current month.',
      target: 3,
      currentUserProgress: new Set(currentMonthSessions.map((session) => session.restaurantName)).size,
      friendAverageProgress: friendMonthAverage,
      unit: 'restaurants',
    },
    {
      id: 'group-night',
      title: '2 Group Sessions',
      description: 'Complete two linked group sessions this month.',
      target: 2,
      currentUserProgress: currentMonthSessions.filter((session) => session.mode === 'group').length,
      friendAverageProgress:
        friendIds.length === 0
          ? 0
          : friendIds.reduce((sum, friendId) => {
              const sessions = allFriendUserSessions.filter((session) =>
                sameMonth(session.submittedAt ?? session.startedAt, now) &&
                session.mode === 'group' &&
                session.participants.some((participant) => participant.userId === friendId),
              );
              return sum + sessions.length;
            }, 0) / friendIds.length,
      unit: 'sessions',
    },
  ];
}
