import type { Achievement, SushiSession } from '../types';

function totalPiecesForUser(sessions: SushiSession[], userId: string): number {
  return sessions.reduce((sum, session) => {
    const participant = session.participants.find((item) => item.userId === userId);
    if (!participant) return sum;
    return sum + Object.values(participant.counts).reduce((acc, count) => acc + count, 0);
  }, 0);
}

function createAchievement(params: {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  earnedAt?: string;
}): Achievement {
  return {
    id: params.id,
    title: params.title,
    description: params.description,
    earned: params.earned,
    ...(params.earnedAt ? { earnedAt: params.earnedAt } : {}),
  };
}

export function getAchievements(sessions: SushiSession[], userId: string): Achievement[] {
  const userSessions = sessions.filter((session) =>
    session.participants.some((participant) => participant.userId === userId),
  );
  const totalPieces = totalPiecesForUser(userSessions, userId);
  const restaurants = new Set(
    userSessions
      .map((session) =>
        session.restaurantId !== 'unknown' ? session.restaurantId : session.restaurantName.trim().toLowerCase(),
      )
      .filter((restaurant) => !!restaurant && restaurant !== 'unknown restaurant'),
  );
  const firstSession = userSessions[0]?.submittedAt ?? userSessions[0]?.startedAt;
  const tenthSession = userSessions[9]?.submittedAt ?? userSessions[9]?.startedAt;
  const groupSession = userSessions.find((session) => session.mode === 'group');

  return [
    createAchievement({
      id: 'first-session',
      title: 'First Plate',
      description: 'Log your first sushi party.',
      earned: userSessions.length >= 1,
      ...(firstSession ? { earnedAt: firstSession } : {}),
    }),
    createAchievement({
      id: 'hundred-pieces',
      title: 'Century Club',
      description: 'Eat 100 total pieces across all parties.',
      earned: totalPieces >= 100,
      ...(totalPieces >= 100 && userSessions[userSessions.length - 1]?.submittedAt
        ? { earnedAt: userSessions[userSessions.length - 1]!.submittedAt! }
        : {}),
    }),
    createAchievement({
      id: 'ten-sessions',
      title: 'Regular',
      description: 'Complete 10 parties.',
      earned: userSessions.length >= 10,
      ...(tenthSession ? { earnedAt: tenthSession } : {}),
    }),
    createAchievement({
      id: 'five-restaurants',
      title: 'Sushi Explorer',
      description: 'Visit 5 different restaurants.',
      earned: restaurants.size >= 5,
      ...(restaurants.size >= 5 && userSessions[userSessions.length - 1]?.submittedAt
        ? { earnedAt: userSessions[userSessions.length - 1]!.submittedAt! }
        : {}),
    }),
    createAchievement({
      id: 'first-group',
      title: 'Party Table',
      description: 'Finish your first linked group party.',
      earned: !!groupSession,
      ...(groupSession
        ? { earnedAt: groupSession.submittedAt ?? groupSession.startedAt }
        : {}),
    }),
  ];
}

export function getNewlyEarnedAchievements(
  sessions: SushiSession[],
  previousSessions: SushiSession[],
  userId: string,
): Achievement[] {
  const previousEarnedIds = new Set(
    getAchievements(previousSessions, userId)
      .filter((achievement) => achievement.earned)
      .map((achievement) => achievement.id),
  );

  return getAchievements(sessions, userId).filter(
    (achievement) => achievement.earned && !previousEarnedIds.has(achievement.id),
  );
}
