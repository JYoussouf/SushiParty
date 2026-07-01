import type { GeoPoint, GroupSessionDraft } from '../../types';
import { apiRequest, apiWebSocketUrl } from './client';

type Unsubscribe = () => void;

// Shared session context the host sends when starting a party, so every guest can
// reconstruct results (restaurant/menu/location/startedAt) at phase='active'.
export interface GroupPartyStartContext {
  restaurantId: string;
  restaurantName: string;
  location: GeoPoint;
  menuId: string;
  menuVersion: number;
  startedAt: string;
}

export async function createGroupParty(
  _ownerUid: string,
  displayName: string,
  avatar?: string,
): Promise<GroupSessionDraft> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>('/groups', {
    method: 'POST',
    body: JSON.stringify({ displayName, avatar }),
  });
  return draft;
}

export async function getGroupPartyById(groupPartyId: string): Promise<GroupSessionDraft | null> {
  try {
    const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
      `/groups/${encodeURIComponent(groupPartyId)}`,
    );
    return draft;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function getGroupPartyByCode(code: string): Promise<GroupSessionDraft | null> {
  return getGroupPartyById(code.trim().toUpperCase());
}

export async function joinGroupParty(
  code: string,
  userId: string,
  displayName: string,
  avatar?: string,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(code.trim().toUpperCase())}/join`,
    {
      method: 'POST',
      body: JSON.stringify({ userId, displayName, avatar }),
    },
  );
  return draft;
}

export async function updateGroupPartyParticipantCounts(
  groupPartyId: string,
  userId: string,
  displayName: string,
  itemId: string,
  delta: number,
  avatar?: string,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(groupPartyId)}/counts`,
    {
      method: 'POST',
      body: JSON.stringify({ userId, displayName, itemId, delta, avatar }),
    },
  );
  return draft;
}

export async function resetGroupPartyParticipantCounts(
  groupPartyId: string,
  userId: string,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(groupPartyId)}/reset`,
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    },
  );
  return draft;
}

export async function updateGroupPartyParticipantAvatar(
  groupPartyId: string,
  userId: string,
  displayName: string,
  avatar: string,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(groupPartyId)}/avatar`,
    {
      method: 'POST',
      body: JSON.stringify({ userId, displayName, avatar }),
    },
  );
  return draft;
}

export async function startGroupParty(
  groupPartyId: string,
  ownerUid: string,
  context?: GroupPartyStartContext,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(groupPartyId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ ownerUid, ...(context ?? {}) }),
    },
  );
  return draft;
}

export async function endGroupParty(
  groupPartyId: string,
  ownerUid: string,
): Promise<GroupSessionDraft | null> {
  const { draft } = await apiRequest<{ draft: GroupSessionDraft }>(
    `/groups/${encodeURIComponent(groupPartyId)}/end`,
    {
      method: 'POST',
      body: JSON.stringify({ ownerUid }),
    },
  );
  return draft;
}

export function subscribeToGroupParty(
  groupPartyId: string,
  onChange: (draft: GroupSessionDraft | null) => void,
): Unsubscribe {
  const socket = new WebSocket(apiWebSocketUrl(`/groups/${encodeURIComponent(groupPartyId)}/ws`));
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        draft?: GroupSessionDraft | null;
      };
      if (payload.type === 'draft') {
        onChange(payload.draft ?? null);
      }
    } catch {
      onChange(null);
    }
  };
  socket.onerror = () => onChange(null);
  return () => socket.close();
}

export async function removeGroupParty(groupPartyId: string): Promise<void> {
  await apiRequest(`/groups/${encodeURIComponent(groupPartyId)}`, {
    method: 'DELETE',
  });
}

export async function writeGroupPartyLink(
  _code: string,
  _partyId: string,
  _expiresAt: string,
): Promise<void> {
  // Durable Objects are addressed by the group code, so no separate link table is needed.
}
