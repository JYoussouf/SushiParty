export interface Env {
  DB: D1Database;
  GROUP_PARTIES: DurableObjectNamespace;
  JWT_SECRET?: string;
  ALLOWED_ORIGIN?: string;
  GOOGLE_PLACES_API_KEY?: string;
}

type SessionMode = 'single' | 'individual' | 'group';

interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string;
  friendIds: string[];
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface RestaurantStats {
  totalSessions: number;
  meanPiecesPerSession: number;
  stdDevPiecesPerSession: number;
  updatedAt: string;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
  menuId: string;
  stats: RestaurantStats;
}

interface SessionParticipant {
  userId: string;
  displayName: string;
  avatar?: string;
  counts: Record<string, number>;
}

interface SushiSession {
  id: string;
  ownerUid: string;
  mode: SessionMode;
  restaurantId: string;
  restaurantName: string;
  menuId: string;
  menuVersion: number;
  location: GeoPoint;
  startedAt: string;
  submittedAt?: string;
  participants: SessionParticipant[];
  groupCode?: string;
  note?: string;
  flagged?: boolean;
}

interface Menu {
  id: string;
  restaurantId?: string;
  version: number;
  items: unknown[];
}

interface GroupSessionDraft {
  id: string;
  code: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  participants: SessionParticipant[];
}

interface UserRow {
  uid: string;
  username: string;
  display_name: string;
  email: string;
  friend_ids_json: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  owner_uid: string;
  mode: SessionMode;
  restaurant_id: string;
  restaurant_name: string;
  menu_id: string;
  menu_version: number;
  latitude: number;
  longitude: number;
  participants_json: string;
  group_code: string | null;
  note: string | null;
  flagged: number;
  started_at: string;
  submitted_at: string;
}

interface RestaurantRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  menu_id: string;
  stats_json: string;
}

interface MenuRow {
  id: string;
  restaurant_id: string | null;
  version: number;
  items_json: string;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const GROUP_CODE_LENGTH = 6;
const GROUP_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_RESTAURANT_CANDIDATES = 50;
const MAX_RESTAURANT_RESULTS = 10;
const DEFAULT_RADIUS_KM = 10;

const encoder = new TextEncoder();

function headers(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN === '*' ? origin || '*' : env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(request, env) });
}

function empty(request: Request, env: Env, status = 204): Response {
  return new Response(null, { status, headers: headers(request, env) });
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: GROUP_CODE_LENGTH }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

function normalizeUsername(username: string | undefined, fallback: string): string {
  const normalized = username?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return normalized || fallback;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(env.JWT_SECRET || 'dev-only-change-me'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signToken(uid: string, env: Env): Promise<string> {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ uid, iat: Math.floor(Date.now() / 1000) })),
  );
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env), encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(signature)}`;
}

async function getAuthUid(request: Request, env: Env): Promise<string | null> {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const verified = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env),
    base64UrlToBytes(signature),
    encoder.encode(payload),
  );
  if (!verified) return null;

  const parsed = safeJson<{ uid?: string }>(new TextDecoder().decode(base64UrlToBytes(payload)), {});
  return parsed.uid ?? null;
}

async function requireAuth(request: Request, env: Env): Promise<string> {
  const uid = await getAuthUid(request, env);
  if (!uid) {
    throw new HttpError(401, 'Authentication required.');
  }
  return uid;
}

function rowToUser(row: UserRow): User {
  return {
    uid: row.uid,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    friendIds: safeJson<string[]>(row.friend_ids_json, []),
  };
}

function rowToSession(row: SessionRow): SushiSession {
  return {
    id: row.id,
    ownerUid: row.owner_uid,
    mode: row.mode,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    menuId: row.menu_id,
    menuVersion: row.menu_version,
    location: { latitude: row.latitude, longitude: row.longitude },
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    participants: safeJson<SessionParticipant[]>(row.participants_json, []),
    ...(row.group_code ? { groupCode: row.group_code } : {}),
    ...(row.note ? { note: row.note } : {}),
    flagged: row.flagged === 1,
  };
}

function emptyStats(): RestaurantStats {
  return {
    totalSessions: 0,
    meanPiecesPerSession: 0,
    stdDevPiecesPerSession: 0,
    updatedAt: new Date().toISOString(),
  };
}

function rowToRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    location: { latitude: row.latitude, longitude: row.longitude },
    menuId: row.menu_id,
    stats: safeJson<RestaurantStats>(row.stats_json, emptyStats()),
  };
}

function rowToMenu(row: MenuRow): Menu {
  return {
    id: row.id,
    ...(row.restaurant_id ? { restaurantId: row.restaurant_id } : {}),
    version: row.version,
    items: safeJson<unknown[]>(row.items_json, []),
  };
}

function canAccessSession(session: SushiSession, uid: string): boolean {
  return session.ownerUid === uid || session.participants.some((participant) => participant.userId === uid);
}

function sessionTotalPieces(participants: SessionParticipant[]): number {
  return participants.reduce(
    (sum, participant) =>
      sum + Object.values(participant.counts).reduce((participantSum, count) => participantSum + count, 0),
    0,
  );
}

function updateStats(current: RestaurantStats, totalPieces: number): RestaurantStats {
  const previousCount = current.totalSessions;
  const nextCount = previousCount + 1;
  const previousMean = current.meanPiecesPerSession;
  const previousVariance = current.stdDevPiecesPerSession ** 2;
  const previousM2 = previousCount > 1 ? previousVariance * (previousCount - 1) : 0;
  const delta = totalPieces - previousMean;
  const nextMean = previousMean + delta / nextCount;
  const nextM2 = previousM2 + delta * (totalPieces - nextMean);
  const nextVariance = nextCount > 1 ? nextM2 / (nextCount - 1) : 0;

  return {
    totalSessions: nextCount,
    meanPiecesPerSession: nextMean,
    stdDevPiecesPerSession: Math.sqrt(Math.max(0, nextVariance)),
    updatedAt: new Date().toISOString(),
  };
}

async function updateRestaurantStats(db: D1Database, restaurantId: string, totalPieces: number): Promise<void> {
  const row = await db
    .prepare('SELECT stats_json FROM restaurants WHERE id = ?')
    .bind(restaurantId)
    .first<{ stats_json: string }>();
  if (!row) return;

  const next = updateStats(safeJson<RestaurantStats>(row.stats_json, emptyStats()), totalPieces);
  await db
    .prepare('UPDATE restaurants SET stats_json = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(next), next.updatedAt, restaurantId)
    .run();
}

function latitudeBounds(center: GeoPoint, radiusKm: number): { min: number; max: number } {
  const degrees = radiusKm / 111.32;
  return { min: center.latitude - degrees, max: center.latitude + degrees };
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

async function upsertUser(env: Env, input: Partial<User> & { uid: string }): Promise<User> {
  const now = new Date().toISOString();
  const existing = await env.DB.prepare('SELECT * FROM users WHERE uid = ?')
    .bind(input.uid)
    .first<UserRow>();
  const username = normalizeUsername(input.username, existing?.username ?? input.uid);
  const displayName = input.displayName?.trim() || existing?.display_name || 'Sushi Friend';
  const email = input.email?.trim() ?? existing?.email ?? '';
  const friendIds = input.friendIds ?? safeJson<string[]>(existing?.friend_ids_json, []);

  try {
    await env.DB.prepare(
      `INSERT INTO users (uid, username, display_name, email, friend_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         email = excluded.email,
         friend_ids_json = excluded.friend_ids_json,
         updated_at = excluded.updated_at`,
    )
      .bind(input.uid, username, displayName, email, JSON.stringify(friendIds), existing?.created_at ?? now, now)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('unique')) {
      throw new HttpError(409, 'That username is already taken.');
    }
    throw error;
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(input.uid).first<UserRow>();
  if (!row) throw new HttpError(500, 'Could not load user after saving.');
  return rowToUser(row);
}

async function handleAuthDevice(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Partial<User> & { uid?: string }>(request);
  const uid = body.uid?.trim() || randomId('device');
  const user = await upsertUser(env, { ...body, uid });
  const token = await signToken(user.uid, env);
  return json(request, env, { token, user });
}

async function handleUsers(request: Request, env: Env, parts: string[]): Promise<Response> {
  const uid = await requireAuth(request, env);

  if (request.method === 'GET' && parts[1] === 'me') {
    const row = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first<UserRow>();
    if (!row) throw new HttpError(404, 'User not found.');
    return json(request, env, { user: rowToUser(row) });
  }

  if (request.method === 'PATCH' && parts[1] === 'me') {
    const body = await readJson<Partial<User>>(request);
    const user = await upsertUser(env, { ...body, uid });
    return json(request, env, { user });
  }

  if (request.method === 'GET' && parts[1] === 'username' && parts[2] && parts[3] === 'exists') {
    const username = normalizeUsername(decodeURIComponent(parts[2]), '');
    const row = await env.DB.prepare('SELECT uid FROM users WHERE username = ?').bind(username).first<{ uid: string }>();
    return json(request, env, { taken: !!row && row.uid !== uid });
  }

  throw new HttpError(404, 'Route not found.');
}

async function handleSessions(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
  const uid = await requireAuth(request, env);

  if (request.method === 'POST' && parts.length === 1) {
    const body = await readJson<Partial<SushiSession>>(request);
    const now = new Date().toISOString();
    const id = randomId('session');
    const participants = body.participants ?? [];
    const restaurantId = body.restaurantId ?? 'unknown';
    await env.DB.prepare(
      `INSERT INTO sessions (
        id, owner_uid, mode, restaurant_id, restaurant_name, menu_id, menu_version,
        latitude, longitude, participants_json, group_code, flagged,
        started_at, submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        uid,
        body.mode ?? 'single',
        restaurantId,
        body.restaurantName ?? 'Unknown Restaurant',
        body.menuId ?? 'global-default',
        body.menuVersion ?? 1,
        body.location?.latitude ?? 0,
        body.location?.longitude ?? 0,
        JSON.stringify(participants),
        body.groupCode ?? null,
        body.flagged ? 1 : 0,
        body.startedAt ?? now,
        now,
        now,
        now,
      )
      .run();

    if (!body.flagged && restaurantId !== 'unknown') {
      await updateRestaurantStats(env.DB, restaurantId, sessionTotalPieces(participants));
    }

    return json(request, env, { id }, 201);
  }

  if (request.method === 'GET' && parts[1] === 'me') {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 200);
    const rows = await env.DB.prepare(
      `SELECT * FROM sessions
       WHERE owner_uid = ? OR participants_json LIKE ?
       ORDER BY submitted_at DESC
       LIMIT ?`,
    )
      .bind(uid, `%${uid}%`, limit)
      .all<SessionRow>();
    return json(request, env, { sessions: (rows.results ?? []).map(rowToSession) });
  }

  const sessionId = parts[1];
  if (!sessionId) throw new HttpError(404, 'Route not found.');

  const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first<SessionRow>();
  if (!row) throw new HttpError(404, 'Session not found.');

  const session = rowToSession(row);
  if (!canAccessSession(session, uid)) {
    throw new HttpError(403, 'You cannot access this session.');
  }

  if (request.method === 'GET') {
    return json(request, env, { session });
  }

  if (request.method === 'PATCH') {
    const body = await readJson<Partial<SushiSession>>(request);
    const next: SushiSession = {
      ...session,
      ...body,
      id: session.id,
      ownerUid: session.ownerUid,
      location: body.location ?? session.location,
      participants: body.participants ?? session.participants,
    };
    const note = body.note === undefined ? session.note ?? null : body.note?.trim() || null;
    await env.DB.prepare(
      `UPDATE sessions SET
        restaurant_id = ?,
        restaurant_name = ?,
        latitude = ?,
        longitude = ?,
        participants_json = ?,
        note = ?,
        updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        next.restaurantId,
        next.restaurantName,
        next.location.latitude,
        next.location.longitude,
        JSON.stringify(next.participants),
        note,
        new Date().toISOString(),
        session.id,
      )
      .run();

    const updated = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(session.id).first<SessionRow>();
    return json(request, env, { session: rowToSession(updated ?? row) });
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleRestaurants(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
  if (request.method === 'GET' && parts[1] === 'nearby') {
    const latitude = Number(url.searchParams.get('lat'));
    const longitude = Number(url.searchParams.get('lng'));
    const radiusKm = Number(url.searchParams.get('radiusKm') ?? DEFAULT_RADIUS_KM);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new HttpError(400, 'lat and lng query params are required.');
    }

    const center = { latitude, longitude };
    const bounds = latitudeBounds(center, radiusKm);
    const rows = await env.DB.prepare(
      `SELECT * FROM restaurants
       WHERE latitude >= ? AND latitude <= ?
       ORDER BY latitude ASC
       LIMIT ?`,
    )
      .bind(bounds.min, bounds.max, MAX_RESTAURANT_CANDIDATES)
      .all<RestaurantRow>();

    const restaurants = (rows.results ?? [])
      .map(rowToRestaurant)
      .map((restaurant) => ({ ...restaurant, distanceKm: haversineKm(center, restaurant.location) }))
      .filter((restaurant) => restaurant.distanceKm <= radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, MAX_RESTAURANT_RESULTS);
    return json(request, env, { restaurants });
  }

  if (request.method === 'GET' && parts[1] === 'search') {
    const query = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
    if (query.length < 2) return json(request, env, { restaurants: [] });

    const rows = await env.DB.prepare(
      `SELECT * FROM restaurants
       WHERE name_lower >= ? AND name_lower <= ?
       ORDER BY name_lower ASC
       LIMIT ?`,
    )
      .bind(query, `${query}\uffff`, MAX_RESTAURANT_CANDIDATES)
      .all<RestaurantRow>();

    let restaurants = (rows.results ?? []).map(rowToRestaurant);
    const latitude = Number(url.searchParams.get('lat'));
    const longitude = Number(url.searchParams.get('lng'));
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const center = { latitude, longitude };
      restaurants = restaurants
        .map((restaurant) => ({ ...restaurant, distanceKm: haversineKm(center, restaurant.location) }))
        .sort((left, right) => left.distanceKm - right.distanceKm);
    }

    return json(request, env, { restaurants: restaurants.slice(0, MAX_RESTAURANT_RESULTS) });
  }

  if (request.method === 'POST' && parts.length === 1) {
    await requireAuth(request, env);
    const body = await readJson<Partial<Restaurant>>(request);
    if (!body.name?.trim() || !body.location) {
      throw new HttpError(400, 'Restaurant name and location are required.');
    }

    const now = new Date().toISOString();
    const id = randomId('restaurant');
    const stats = emptyStats();
    await env.DB.prepare(
      `INSERT INTO restaurants (
        id, name, name_lower, address, latitude, longitude, menu_id, stats_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.name.trim(),
        body.name.trim().toLowerCase(),
        body.address?.trim() ?? '',
        body.location.latitude,
        body.location.longitude,
        body.menuId ?? 'global-default',
        JSON.stringify(stats),
        now,
        now,
      )
      .run();
    return json(request, env, { id }, 201);
  }

  const restaurantId = parts[1];
  if (request.method === 'GET' && restaurantId) {
    const row = await env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(restaurantId).first<RestaurantRow>();
    if (!row) throw new HttpError(404, 'Restaurant not found.');
    return json(request, env, { restaurant: rowToRestaurant(row) });
  }

  throw new HttpError(404, 'Route not found.');
}

async function handleMenus(request: Request, env: Env, parts: string[]): Promise<Response> {
  const menuId = parts[1];
  if (request.method !== 'GET' || !menuId) {
    throw new HttpError(404, 'Route not found.');
  }

  const row = await env.DB.prepare('SELECT * FROM menus WHERE id = ?').bind(menuId).first<MenuRow>();
  if (!row) throw new HttpError(404, 'Menu not found.');
  return json(request, env, { menu: rowToMenu(row) });
}

async function groupRequest(env: Env, groupId: string, path: string, init?: RequestInit): Promise<Response> {
  const stub = env.GROUP_PARTIES.getByName(groupId);
  return stub.fetch(new Request(`https://group.local${path}`, init));
}

async function handleGroups(request: Request, env: Env, parts: string[]): Promise<Response> {
  // WebSocket upgrade must be handled before auth — browsers/RN can't set Authorization on WS.
  // The group code acts as the access token for read-only subscription.
  const groupId = parts[1];
  if (request.method === 'GET' && parts[2] === 'ws') {
    if (request.headers.get('Upgrade') !== 'websocket') {
      throw new HttpError(426, 'Expected a WebSocket upgrade.');
    }
    if (!groupId) throw new HttpError(404, 'Route not found.');
    return groupRequest(env, groupId, '/ws', { headers: request.headers });
  }

  const uid = await requireAuth(request, env);

  if (request.method === 'POST' && parts.length === 1) {
    const body = await readJson<{ displayName?: string; avatar?: string }>(request);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomCode();
      const response = await groupRequest(env, code, '/create', {
        method: 'POST',
        body: JSON.stringify({ code, ownerUid: uid, displayName: body.displayName, avatar: body.avatar }),
      });
      if (response.status === 409) continue;
      return new Response(response.body, { status: response.status, headers: headers(request, env) });
    }
    throw new HttpError(409, 'Could not reserve a unique party code.');
  }

  if (!groupId) throw new HttpError(404, 'Route not found.');

  const route = parts[2] ? `/${parts[2]}` : '/';
  const body = request.method === 'GET' ? undefined : await request.text();
  const groupInit: RequestInit = { method: request.method };
  if (body) {
    groupInit.body = body;
  }
  const response = await groupRequest(env, groupId, route, groupInit);
  return new Response(response.body, { status: response.status, headers: headers(request, env) });
}

export class GroupParty {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/ws') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const draft = await this.getFreshDraft();
      server.send(JSON.stringify({ type: 'draft', draft }));
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }

    if (request.method === 'POST' && path === '/create') {
      const body = await readJson<{ code: string; ownerUid: string; displayName?: string; avatar?: string }>(request);
      const existing = await this.getFreshDraft();
      if (existing) return new Response(JSON.stringify({ error: 'Code already exists.' }), { status: 409 });

      const now = new Date().toISOString();
      const draft: GroupSessionDraft = {
        id: body.code,
        code: body.code,
        ownerUid: body.ownerUid,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + GROUP_TTL_MS).toISOString(),
        participants: [createParticipant(body.ownerUid, body.displayName || 'Sushi Friend', body.avatar)],
      };
      await this.writeDraft(draft);
      await this.broadcast(draft);
      return Response.json({ draft }, { status: 201 });
    }

    if (request.method === 'GET' && path === '/') {
      const draft = await this.getFreshDraft();
      return draft ? Response.json({ draft }) : Response.json({ error: 'Group not found.' }, { status: 404 });
    }

    if (request.method === 'POST' && path === '/join') {
      const body = await readJson<{ userId: string; displayName?: string; avatar?: string }>(request);
      const draft = await this.requireDraft();
      const next = {
        ...draft,
        participants: ensureParticipant(draft.participants, body.userId, body.displayName || 'Sushi Friend', body.avatar),
        updatedAt: new Date().toISOString(),
      };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    if (request.method === 'POST' && path === '/counts') {
      const body = await readJson<{
        userId: string;
        displayName?: string;
        itemId: string;
        delta: number;
        avatar?: string;
      }>(request);
      const draft = await this.requireDraft();
      const participants = ensureParticipant(
        draft.participants,
        body.userId,
        body.displayName || 'Sushi Friend',
        body.avatar,
      ).map((participant) => {
        if (participant.userId !== body.userId) return participant;
        const current = participant.counts[body.itemId] ?? 0;
        return {
          ...participant,
          counts: { ...participant.counts, [body.itemId]: Math.max(0, current + body.delta) },
        };
      });
      const next = { ...draft, participants, updatedAt: new Date().toISOString() };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    if (request.method === 'POST' && path === '/reset') {
      const body = await readJson<{ userId: string }>(request);
      const draft = await this.requireDraft();
      const next = {
        ...draft,
        participants: draft.participants.map((participant) =>
          participant.userId === body.userId ? { ...participant, counts: {} } : participant,
        ),
        updatedAt: new Date().toISOString(),
      };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    if (request.method === 'POST' && path === '/avatar') {
      const body = await readJson<{ userId: string; displayName?: string; avatar: string }>(request);
      const draft = await this.requireDraft();
      const next = {
        ...draft,
        participants: ensureParticipant(draft.participants, body.userId, body.displayName || 'Sushi Friend', body.avatar),
        updatedAt: new Date().toISOString(),
      };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    if (request.method === 'DELETE') {
      await this.state.storage.delete('draft');
      await this.broadcast(null);
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: 'Route not found.' }, { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === 'ping') {
      ws.send('pong');
      return;
    }
    const draft = await this.getFreshDraft();
    ws.send(JSON.stringify({ type: 'draft', draft }));
  }

  private async getFreshDraft(): Promise<GroupSessionDraft | null> {
    const draft = (await this.state.storage.get<GroupSessionDraft>('draft')) ?? null;
    if (!draft) return null;
    if (new Date(draft.expiresAt).getTime() <= Date.now()) {
      await this.state.storage.delete('draft');
      await this.broadcast(null);
      return null;
    }
    return draft;
  }

  private async requireDraft(): Promise<GroupSessionDraft> {
    const draft = await this.getFreshDraft();
    if (!draft) throw new HttpError(404, 'Group not found or expired.');
    return draft;
  }

  private async writeDraft(draft: GroupSessionDraft): Promise<void> {
    await this.state.storage.put('draft', draft);
  }

  private async broadcast(draft: GroupSessionDraft | null): Promise<void> {
    const payload = JSON.stringify({ type: 'draft', draft });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Dead sockets are cleaned up by the runtime.
      }
    }
  }
}

function createParticipant(userId: string, displayName: string, avatar?: string): SessionParticipant {
  return {
    userId,
    displayName,
    ...(avatar ? { avatar } : {}),
    counts: {},
  };
}

function ensureParticipant(
  participants: SessionParticipant[],
  userId: string,
  displayName: string,
  avatar?: string,
): SessionParticipant[] {
  const existing = participants.find((participant) => participant.userId === userId);
  if (!existing) return [...participants, createParticipant(userId, displayName, avatar)];

  return participants.map((participant) =>
    participant.userId === userId
      ? {
          ...participant,
          displayName,
          ...(avatar ? { avatar } : {}),
        }
      : participant,
  );
}

// ─── Google Places API ───────────────────────────────────────────────────────

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

const PLACES_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';

function googleHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': PLACES_FIELD_MASK,
  };
}

function googlePlaceToRestaurant(
  p: GooglePlace,
  center?: { latitude: number; longitude: number },
): (Restaurant & { distanceKm?: number }) | null {
  const name = p.displayName?.text?.trim();
  const loc = p.location;
  if (!name || !loc) return null;
  const location = { latitude: loc.latitude, longitude: loc.longitude };
  return {
    id: `google-${p.id}`,
    name,
    address: p.formattedAddress ?? '',
    location,
    menuId: 'global-default',
    stats: emptyStats(),
    ...(center ? { distanceKm: haversineKm(center, location) } : {}),
  };
}

async function googleNearby(
  apiKey: string,
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): Promise<(Restaurant & { distanceKm?: number })[]> {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius: radiusMeters },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new HttpError(502, `Google Places nearby failed: ${err}`);
  }
  const data = await resp.json() as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map((p) => googlePlaceToRestaurant(p, center))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

async function googleSearch(
  apiKey: string,
  query: string,
  center?: { latitude: number; longitude: number },
): Promise<(Restaurant & { distanceKm?: number })[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 10,
    // Only return restaurants
    includedType: 'restaurant',
  };
  if (center) {
    // Bias toward user location without hard-restricting — lets "Sushi Palace Windsor" still work
    body.locationBias = {
      circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius: 50000 },
    };
  }
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new HttpError(502, `Google Places search failed: ${err}`);
  }
  const data = await resp.json() as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map((p) => googlePlaceToRestaurant(p, center))
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// ─── Places handler ───────────────────────────────────────────────────────────

async function handlePlaces(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, 'Places service not configured.');

  const cache = caches.default;

  if (request.method === 'GET' && parts[1] === 'nearby') {
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const radiusKm = Math.min(Number(url.searchParams.get('radiusKm') ?? '2'), 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'lat and lng are required.');

    // Round to ~110m grid so nearby moves don't bust cache
    const cacheKey = new Request(
      `https://cache.internal/places/nearby?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}&r=${radiusKm}`,
    );
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { status: cached.status, headers: headers(request, env) });

    const restaurants = await googleNearby(apiKey, { latitude: lat, longitude: lng }, radiusKm * 1000);
    const resp = json(request, env, { restaurants });
    const toStore = new Response(JSON.stringify({ restaurants }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
    void cache.put(cacheKey, toStore);
    return resp;
  }

  if (request.method === 'GET' && parts[1] === 'search') {
    const query = url.searchParams.get('q')?.trim() ?? '';
    if (query.length < 2) return json(request, env, { restaurants: [] });

    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const center = Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : undefined;

    // Cache by normalized query only (location is a soft bias, not worth busting cache)
    const normalizedQ = query.toLowerCase().replace(/\s+/g, ' ');
    const cacheKey = new Request(`https://cache.internal/places/search?q=${encodeURIComponent(normalizedQ)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { status: cached.status, headers: headers(request, env) });

    const restaurants = await googleSearch(apiKey, query, center);
    const resp = json(request, env, { restaurants });
    const toStore = new Response(JSON.stringify({ restaurants }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
    void cache.put(cacheKey, toStore);
    return resp;
  }

  throw new HttpError(404, 'Route not found.');
}

async function route(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return empty(request, env);

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);

  if (request.method === 'POST' && url.pathname === '/auth/device') {
    return handleAuthDevice(request, env);
  }

  switch (parts[0]) {
    case 'users':
      return handleUsers(request, env, parts);
    case 'sessions':
      return handleSessions(request, env, parts, url);
    case 'restaurants':
      return handleRestaurants(request, env, parts, url);
    case 'places':
      return handlePlaces(request, env, parts, url);
    case 'menus':
      return handleMenus(request, env, parts);
    case 'groups':
      return handleGroups(request, env, parts);
    case 'health':
      return json(request, env, { ok: true });
    default:
      throw new HttpError(404, 'Route not found.');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(request, env, { error: error.message }, error.status);
      }
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      return json(request, env, { error: message }, 500);
    }
  },
};
