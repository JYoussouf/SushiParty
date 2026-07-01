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

// Realtime lobby subscription. Only a draft the SERVER sends (including an
// explicit null on deletion/expiry) drives onChange — a transport error or an
// unparseable frame must NOT be reported as null, because SessionContext treats
// a null draft as "party deleted" and ejects the member out of the lobby. A
// dropped socket (mobile backgrounding, network blip) instead triggers a
// bounded reconnect so late joins keep flowing to everyone in real time.
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 15000;

export function subscribeToGroupParty(
  groupPartyId: string,
  onChange: (draft: GroupSessionDraft | null) => void,
): Unsubscribe {
  const url = apiWebSocketUrl(`/groups/${encodeURIComponent(groupPartyId)}/ws`);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let closed = false;

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempts, WS_RECONNECT_MAX_MS);
    attempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  function connect() {
    if (closed) return;
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      attempts = 0;
    };
    ws.onmessage = (event) => {
      let payload: { type?: string; draft?: GroupSessionDraft | null };
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        // Ignore unparseable frames — never conflate them with a real teardown.
        return;
      }
      if (payload.type === 'draft') {
        onChange(payload.draft ?? null);
      }
    };
    // A transport error is not a party deletion; let onclose drive reconnect.
    ws.onerror = () => {};
    ws.onclose = () => {
      if (socket === ws) socket = null;
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
    socket = null;
  };
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
