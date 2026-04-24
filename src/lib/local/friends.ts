import type { FriendActivity, SushiSession, User } from '../../types';
import { getParticipantTotalPieces, getSessionTotalPieces } from '../sessionSummary';
import { getOrCreateDeviceProfile, updateDeviceProfile } from './deviceProfile';

const SEEDED_USERS: User[] = [
  {
    uid: 'friend-akira',
    username: 'akira_roll',
    displayName: 'Akira Ito',
    email: 'akira@example.com',
    createdAt: '2026-04-05T12:00:00.000Z',
    friendIds: [],
  },
  {
    uid: 'friend-maya',
    username: 'maya_maki',
    displayName: 'Maya Lin',
    email: 'maya@example.com',
    createdAt: '2026-04-05T12:00:00.000Z',
    friendIds: [],
  },
  {
    uid: 'friend-noah',
    username: 'nigiri_noah',
    displayName: 'Noah Kim',
    email: 'noah@example.com',
    createdAt: '2026-04-05T12:00:00.000Z',
    friendIds: [],
  },
  {
    uid: 'friend-sam',
    username: 'sam_sashimi',
    displayName: 'Sam Park',
    email: 'sam@example.com',
    createdAt: '2026-04-05T12:00:00.000Z',
    friendIds: [],
  },
  {
    uid: 'friend-zoe',
    username: 'zoe_tempura',
    displayName: 'Zoe Hart',
    email: 'zoe@example.com',
    createdAt: '2026-04-05T12:00:00.000Z',
    friendIds: [],
  },
];

const SEEDED_SESSIONS: SushiSession[] = [
  {
    id: 'friend-session-1',
    mode: 'single',
    restaurantId: 'seed-midori',
    restaurantName: 'Midori Sushi',
    menuId: 'global-default',
    menuVersion: 1,
    location: { latitude: 43.6532, longitude: -79.3832 },
    startedAt: '2026-04-21T22:10:00.000Z',
    submittedAt: '2026-04-21T22:52:00.000Z',
    participants: [
      {
        userId: 'friend-akira',
        displayName: 'Akira Ito',
        counts: {
          'nigiri-salmon': 6,
          'roll-dragon': 3,
          'sashimi-tuna': 4,
          'special-gyoza': 2,
        },
      },
    ],
  },
  {
    id: 'friend-session-2',
    mode: 'individual',
    restaurantId: 'seed-kibo',
    restaurantName: 'Kibo Sushi',
    menuId: 'global-default',
    menuVersion: 1,
    location: { latitude: 43.6629, longitude: -79.3957 },
    startedAt: '2026-04-19T18:40:00.000Z',
    submittedAt: '2026-04-19T19:18:00.000Z',
    participants: [
      {
        userId: 'friend-maya',
        displayName: 'Maya Lin',
        counts: {
          'roll-rainbow': 4,
          'roll-salmon-avocado': 3,
          'special-miso-soup': 1,
        },
      },
      {
        userId: 'friend-noah',
        displayName: 'Noah Kim',
        counts: {
          'nigiri-tuna': 5,
          'sashimi-yellowtail': 3,
        },
      },
    ],
  },
  {
    id: 'friend-session-3',
    mode: 'single',
    restaurantId: 'seed-sora',
    restaurantName: 'Sora House',
    menuId: 'global-default',
    menuVersion: 1,
    location: { latitude: 43.6426, longitude: -79.3871 },
    startedAt: '2026-04-18T20:00:00.000Z',
    submittedAt: '2026-04-18T20:44:00.000Z',
    participants: [
      {
        userId: 'friend-sam',
        displayName: 'Sam Park',
        counts: {
          'roll-shrimp-tempura': 2,
          'special-edamame': 1,
          'nigiri-eel': 4,
        },
      },
    ],
  },
  {
    id: 'friend-session-4',
    mode: 'single',
    restaurantId: 'seed-nami',
    restaurantName: 'Nami Sushi Bar',
    menuId: 'global-default',
    menuVersion: 1,
    location: { latitude: 43.6487, longitude: -79.3854 },
    startedAt: '2026-04-16T21:05:00.000Z',
    submittedAt: '2026-04-16T21:55:00.000Z',
    participants: [
      {
        userId: 'friend-zoe',
        displayName: 'Zoe Hart',
        counts: {
          'nigiri-scallop': 4,
          'sashimi-salmon': 5,
          'special-ice-cream': 1,
        },
      },
    ],
  },
  {
    id: 'friend-session-5',
    mode: 'group',
    restaurantId: 'seed-midori',
    restaurantName: 'Midori Sushi',
    menuId: 'global-default',
    menuVersion: 1,
    location: { latitude: 43.6532, longitude: -79.3832 },
    startedAt: '2026-04-14T19:20:00.000Z',
    submittedAt: '2026-04-14T20:30:00.000Z',
    participants: [
      {
        userId: 'friend-akira',
        displayName: 'Akira Ito',
        counts: {
          'nigiri-yellowtail': 4,
          'roll-california': 2,
          'special-miso-soup': 1,
        },
      },
      {
        userId: 'friend-zoe',
        displayName: 'Zoe Hart',
        counts: {
          'roll-avocado': 3,
          'sashimi-scallop': 2,
        },
      },
    ],
  },
];

function sortSessionsByDate(sessions: SushiSession[]): SushiSession[] {
  return [...sessions].sort((a, b) => {
    const left = new Date(b.submittedAt ?? b.startedAt).getTime();
    const right = new Date(a.submittedAt ?? a.startedAt).getTime();
    return left - right;
  });
}

export async function searchUsersByUsername(
  query: string,
  excludedIds: string[] = [],
): Promise<User[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return SEEDED_USERS.filter(
    (user) =>
      !excludedIds.includes(user.uid) &&
      (user.username.includes(normalized) || user.displayName.toLowerCase().includes(normalized)),
  );
}

export async function getFriendById(friendId: string): Promise<User | null> {
  return SEEDED_USERS.find((user) => user.uid === friendId) ?? null;
}

export async function getFriendsByIds(friendIds: string[]): Promise<User[]> {
  return friendIds
    .map((friendId) => SEEDED_USERS.find((user) => user.uid === friendId))
    .filter((user): user is User => !!user);
}

export async function addFriendToProfile(friendId: string): Promise<User> {
  const profile = await getOrCreateDeviceProfile();
  const friend = await getFriendById(friendId);
  if (!friend) {
    throw new Error('Friend not found.');
  }

  if (profile.friendIds.includes(friendId)) {
    return profile;
  }

  return updateDeviceProfile({ friendIds: [...profile.friendIds, friendId] });
}

export async function getFriendSessions(friendId: string): Promise<SushiSession[]> {
  return sortSessionsByDate(
    SEEDED_SESSIONS.filter((session) =>
      session.participants.some((participant) => participant.userId === friendId),
    ),
  );
}

export async function getFriendActivities(friendIds: string[]): Promise<FriendActivity[]> {
  const sessions = sortSessionsByDate(
    SEEDED_SESSIONS.filter((session) =>
      session.participants.some((participant) => friendIds.includes(participant.userId)),
    ),
  );

  const activities: FriendActivity[] = [];

  for (const session of sessions) {
    for (const participant of session.participants) {
      if (!friendIds.includes(participant.userId)) {
        continue;
      }

      activities.push({
        sessionId: session.id,
        userId: participant.userId,
        displayName: participant.displayName,
        restaurantName: session.restaurantName,
        totalPieces: getParticipantTotalPieces(participant),
        submittedAt: session.submittedAt ?? session.startedAt,
      });
    }
  }

  return activities.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export async function getLatestFriendActivity(friendId: string): Promise<FriendActivity | null> {
  const activities = await getFriendActivities([friendId]);
  return activities[0] ?? null;
}

export async function getFriendSessionTotalPieces(friendId: string): Promise<number> {
  const sessions = await getFriendSessions(friendId);
  return sessions.reduce((sum, session) => sum + getSessionTotalPieces(session), 0);
}
