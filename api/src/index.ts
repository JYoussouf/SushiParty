export interface Env {
  DB: D1Database;
  GROUP_PARTIES: DurableObjectNamespace;
  PHOTOS?: R2Bucket;
  JWT_SECRET?: string;
  ALLOWED_ORIGIN?: string;
  GOOGLE_PLACES_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  FEATURED_SLOTS?: string;
}

type SessionMode = 'single' | 'individual' | 'group';

interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string;
  friendIds: string[];
  avatar?: string;
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
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  openNow?: boolean;
  googleMapsUri?: string;
  photos?: string[];
  featured?: boolean;
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

type GroupPhase = 'lobby' | 'active' | 'ended';

interface GroupEndVote {
  active: boolean;
  startedBy: string;
  acceptedUserIds: string[];
  startedAt: string;
}

interface GroupSessionDraft {
  id: string;
  code: string;
  ownerUid: string;
  phase: GroupPhase;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  participants: SessionParticipant[];
  // Host-initiated end-party vote (issue #31). Absent unless a vote is/was open.
  endVote?: GroupEndVote;
  // Shared session context the host populates at /start so guests can build results.
  restaurantId?: string;
  restaurantName?: string;
  location?: GeoPoint;
  menuId?: string;
  menuVersion?: number;
  startedAt?: string;
}

interface UserRow {
  uid: string;
  username: string;
  display_name: string;
  email: string;
  friend_ids_json: string;
  avatar: string | null;
  created_at: string;
  username_changed_at: string | null;
}

interface AccountCredentialRow {
  user_uid: string;
  email_normalized: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
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

interface TokenPayload {
  uid?: string;
  iat?: number;
  exp?: number;
}

interface AccountAuthBody extends Partial<User> {
  password?: string;
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
const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;

const encoder = new TextEncoder();
const DUMMY_PASSWORD_SALT = utf8ArrayBuffer('sushi-party/auth/dummy-salt/v1');

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

function normalizeEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() ?? '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidAccountUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function utf8ArrayBuffer(value: string): ArrayBuffer {
  const bytes = encoder.encode(value);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function randomBytes(length: number): ArrayBuffer {
  const buffer = new ArrayBuffer(length);
  crypto.getRandomValues(new Uint8Array(buffer));
  return buffer;
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

async function derivePasswordHash(
  password: string,
  salt: ArrayBuffer,
  iterations: number,
): Promise<string> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    passwordKey,
    256,
  );
  return bytesToBase64Url(bits);
}

async function createPasswordCredential(password: string): Promise<{
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const passwordHash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return {
    passwordHash,
    passwordSalt: bytesToBase64Url(salt),
    passwordIterations: PASSWORD_ITERATIONS,
  };
}

function timingSafeEqual(leftValue: string, rightValue: string): boolean {
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

async function verifyPassword(
  password: string,
  credential: { password_hash: string; password_salt: string; password_iterations: number },
): Promise<boolean> {
  const candidate = await derivePasswordHash(
    password,
    base64UrlToBytes(credential.password_salt),
    credential.password_iterations,
  );
  return timingSafeEqual(candidate, credential.password_hash);
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
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ uid, iat: issuedAt, exp: issuedAt + TOKEN_TTL_SECONDS })),
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

  try {
    const verified = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(env),
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!verified) return null;

    const parsed = safeJson<TokenPayload>(new TextDecoder().decode(base64UrlToBytes(payload)), {});
    if (!parsed.uid || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.uid;
  } catch {
    return null;
  }
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
    ...(row.avatar ? { avatar: row.avatar } : {}),
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
  const email = normalizeEmail(input.email) || existing?.email || '';
  const friendIds = input.friendIds ?? safeJson<string[]>(existing?.friend_ids_json, []);
  const avatar = input.avatar?.trim() || existing?.avatar || null;

  try {
    await env.DB.prepare(
      `INSERT INTO users (uid, username, display_name, email, friend_ids_json, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         email = excluded.email,
         friend_ids_json = excluded.friend_ids_json,
         avatar = excluded.avatar,
         updated_at = excluded.updated_at`,
    )
      .bind(input.uid, username, displayName, email, JSON.stringify(friendIds), avatar, existing?.created_at ?? now, now)
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

async function hasAccountCredential(env: Env, uid: string): Promise<boolean> {
  try {
    const row = await env.DB.prepare('SELECT user_uid FROM account_credentials WHERE user_uid = ?')
      .bind(uid)
      .first<{ user_uid: string }>();
    return !!row;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('no such table')) {
      return false;
    }
    throw error;
  }
}

async function handleAuthDevice(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Partial<User> & { uid?: string }>(request);
  const uid = body.uid?.trim() || randomId('device');
  const user = await upsertUser(env, { ...body, uid });
  const token = await signToken(user.uid, env);
  const accountBacked = await hasAccountCredential(env, user.uid);
  return json(request, env, { token, user, accountBacked });
}

async function handleAuthRegister(request: Request, env: Env): Promise<Response> {
  const body = await readJson<AccountAuthBody>(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const username = body.username?.trim().toLowerCase() ?? '';
  const displayName = body.displayName?.trim() ?? '';

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }
  if (!isValidAccountUsername(username)) {
    throw new HttpError(400, 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
  }
  if (!displayName) {
    throw new HttpError(400, 'Display name is required.');
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new HttpError(400, `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
  }

  const existingEmail = await env.DB.prepare('SELECT user_uid FROM account_credentials WHERE email_normalized = ?')
    .bind(email)
    .first<{ user_uid: string }>();
  if (existingEmail) {
    throw new HttpError(409, 'An account already exists with that email.');
  }

  const uid = body.uid?.trim() || randomId('user');
  const existingAccount = await env.DB.prepare('SELECT email_normalized FROM account_credentials WHERE user_uid = ?')
    .bind(uid)
    .first<{ email_normalized: string }>();
  if (existingAccount) {
    throw new HttpError(409, 'This profile already has an account.');
  }

  const user = await upsertUser(env, {
    ...body,
    uid,
    email,
    username,
    displayName,
  });
  const credential = await createPasswordCredential(password);
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO account_credentials (
        user_uid, email_normalized, password_hash, password_salt,
        password_iterations, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        user.uid,
        email,
        credential.passwordHash,
        credential.passwordSalt,
        credential.passwordIterations,
        now,
        now,
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('unique')) {
      throw new HttpError(409, 'An account already exists with that email.');
    }
    throw error;
  }

  const token = await signToken(user.uid, env);
  return json(request, env, { token, user, accountBacked: true }, 201);
}

// ─── Restaurant partner portal ──────────────────────────────────────────────

const MAX_PARTNER_PHOTOS = 8;

interface PartnerApplicationBody {
  restaurantName?: string;
  address?: string;
  email?: string;
  phone?: string;
}

interface PartnerAccountRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
}

// Partner tokens reuse the app's HMAC token, namespaced with a "partner:" subject
// so they can never be mistaken for an app-user token.
async function requirePartner(request: Request, env: Env): Promise<string> {
  const subject = await getAuthUid(request, env);
  if (!subject || !subject.startsWith('partner:')) {
    throw new HttpError(401, 'Partner sign-in required.');
  }
  return subject.slice('partner:'.length);
}

function photoUrl(url: URL, photoId: string): string {
  return `${url.origin}/partners/photos/${photoId}`;
}

async function handlePartners(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
  const sub = parts[1];

  // Public portal website.
  if (request.method === 'GET' && !sub) {
    return new Response(PARTNER_PORTAL_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  // App "feature your restaurant" lead form.
  if (request.method === 'POST' && !sub) {
    return handlePartnerApplication(request, env);
  }
  if (request.method === 'POST' && sub === 'signup') {
    return handlePartnerSignup(request, env);
  }
  if (request.method === 'POST' && sub === 'login') {
    return handlePartnerLogin(request, env);
  }
  if (request.method === 'GET' && sub === 'me') {
    return handlePartnerMe(request, env, url);
  }
  if (request.method === 'PUT' && sub === 'profile') {
    return handlePartnerSaveProfile(request, env);
  }
  if (request.method === 'GET' && sub === 'places' && parts[2] === 'search') {
    return handlePartnerPlacesSearch(request, env, url);
  }
  if (request.method === 'POST' && sub === 'photos') {
    return handlePartnerUploadPhoto(request, env, url);
  }
  if (request.method === 'GET' && sub === 'photos' && parts[2]) {
    return handlePartnerServePhoto(env, parts[2]);
  }
  if (request.method === 'DELETE' && sub === 'photos' && parts[2]) {
    return handlePartnerDeletePhoto(request, env, parts[2]);
  }
  if (sub === 'billing') {
    return handlePartnerBilling(request, env, parts, url);
  }
  throw new HttpError(404, 'Route not found.');
}

// ─── Stripe billing (featured-placement subscription) ───────────────────────

async function stripeApi(
  env: Env,
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new HttpError(502, `Stripe error: ${err?.message ?? resp.status}`);
  }
  return data;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verifies Stripe's `Stripe-Signature` header against the raw body (HMAC-SHA256).
async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  // Reject events older than 5 minutes to blunt replay attacks.
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return timingSafeEqual(expected, signature);
}

async function handlePartnerBilling(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
  const action = parts[2];

  if (request.method === 'POST' && action === 'webhook') {
    return handleStripeWebhook(request, env);
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    throw new HttpError(503, 'Billing is not configured.');
  }
  const portalUrl = `${url.origin}/partners`;

  if (request.method === 'POST' && action === 'checkout') {
    const partnerId = await requirePartner(request, env);
    const account = await env.DB.prepare('SELECT email FROM partner_accounts WHERE id = ?')
      .bind(partnerId)
      .first<{ email: string }>();
    const profile = await env.DB.prepare('SELECT stripe_customer_id FROM partner_profiles WHERE partner_id = ?')
      .bind(partnerId)
      .first<{ stripe_customer_id: string | null }>();

    const params: Record<string, string> = {
      mode: 'subscription',
      'line_items[0][price]': env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      success_url: `${portalUrl}?billing=success`,
      cancel_url: `${portalUrl}?billing=cancel`,
      client_reference_id: partnerId,
      allow_promotion_codes: 'true',
    };
    if (profile?.stripe_customer_id) params.customer = profile.stripe_customer_id;
    else if (account?.email) params.customer_email = account.email;

    const session = await stripeApi(env, 'checkout/sessions', params);
    return json(request, env, { url: session.url });
  }

  if ((request.method === 'POST' || request.method === 'GET') && action === 'portal') {
    const partnerId = await requirePartner(request, env);
    const profile = await env.DB.prepare('SELECT stripe_customer_id FROM partner_profiles WHERE partner_id = ?')
      .bind(partnerId)
      .first<{ stripe_customer_id: string | null }>();
    if (!profile?.stripe_customer_id) throw new HttpError(400, 'No active subscription to manage.');
    const session = await stripeApi(env, 'billing_portal/sessions', {
      customer: profile.stripe_customer_id,
      return_url: portalUrl,
    });
    return json(request, env, { url: session.url });
  }

  throw new HttpError(404, 'Route not found.');
}

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'Billing webhook is not configured.');
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), secret);
  if (!valid) throw new HttpError(400, 'Invalid signature.');

  const event = safeJson<{ type?: string; data?: { object?: Record<string, unknown> } }>(payload, {});
  const obj = event.data?.object ?? {};
  const now = new Date().toISOString();

  if (event.type === 'checkout.session.completed') {
    const partnerId = typeof obj.client_reference_id === 'string' ? obj.client_reference_id : '';
    const customer = typeof obj.customer === 'string' ? obj.customer : null;
    const subscription = typeof obj.subscription === 'string' ? obj.subscription : null;
    if (partnerId) {
      await env.DB.prepare(
        `INSERT INTO partner_profiles (partner_id, featured, stripe_customer_id, stripe_subscription_id, subscription_status, updated_at)
         VALUES (?, 1, ?, ?, 'active', ?)
         ON CONFLICT(partner_id) DO UPDATE SET
           featured = 1,
           stripe_customer_id = excluded.stripe_customer_id,
           stripe_subscription_id = excluded.stripe_subscription_id,
           subscription_status = 'active',
           updated_at = excluded.updated_at`,
      )
        .bind(partnerId, customer, subscription, now)
        .run();
    }
  } else if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const customer = typeof obj.customer === 'string' ? obj.customer : '';
    const status = typeof obj.status === 'string' ? obj.status : 'canceled';
    const featured = ACTIVE_SUB_STATUSES.has(status) ? 1 : 0;
    if (customer) {
      await env.DB.prepare(
        'UPDATE partner_profiles SET subscription_status = ?, featured = ?, updated_at = ? WHERE stripe_customer_id = ?',
      )
        .bind(status, featured, now, customer)
        .run();
    }
  }

  return json(request, env, { received: true });
}

// Restaurant "feature your restaurant" application — a B2B lead, not a purchase.
async function handlePartnerApplication(request: Request, env: Env): Promise<Response> {
  const body = await readJson<PartnerApplicationBody>(request);
  const restaurantName = body.restaurantName?.trim() ?? '';
  const address = body.address?.trim() ?? '';
  const email = normalizeEmail(body.email ?? '');
  const phone = body.phone?.trim() ?? '';
  if (!restaurantName || !address || !isValidEmail(email)) {
    throw new HttpError(400, 'Restaurant name, address and a valid email are required.');
  }
  const id = randomId('partnerapp');
  await env.DB.prepare(
    `INSERT INTO partner_applications (id, restaurant_name, address, email, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, restaurantName, address, email, phone, new Date().toISOString())
    .run();
  return json(request, env, { id });
}

async function handlePartnerSignup(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!isValidEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new HttpError(400, `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
  }
  const existing = await env.DB.prepare('SELECT id FROM partner_accounts WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (existing) throw new HttpError(409, 'An account already exists with that email.');

  const id = randomId('partner');
  const cred = await createPasswordCredential(password);
  await env.DB.prepare(
    `INSERT INTO partner_accounts (id, email, password_hash, password_salt, password_iterations, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, email, cred.passwordHash, cred.passwordSalt, cred.passwordIterations, new Date().toISOString())
    .run();
  const token = await signToken(`partner:${id}`, env);
  return json(request, env, { token, email }, 201);
}

async function handlePartnerLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const account = await env.DB.prepare('SELECT * FROM partner_accounts WHERE email = ?')
    .bind(email)
    .first<PartnerAccountRow>();
  if (!account || !(await verifyPassword(password, account))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  const token = await signToken(`partner:${account.id}`, env);
  return json(request, env, { token, email: account.email });
}

async function handlePartnerMe(request: Request, env: Env, url: URL): Promise<Response> {
  const partnerId = await requirePartner(request, env);
  const account = await env.DB.prepare('SELECT email FROM partner_accounts WHERE id = ?')
    .bind(partnerId)
    .first<{ email: string }>();
  const profile = await env.DB.prepare(
    'SELECT place_id, restaurant_name, address, description, featured FROM partner_profiles WHERE partner_id = ?',
  )
    .bind(partnerId)
    .first<{
      place_id: string | null;
      restaurant_name: string | null;
      address: string | null;
      description: string | null;
      featured: number;
    }>();
  const photos = await env.DB.prepare(
    'SELECT id FROM partner_photos WHERE partner_id = ? ORDER BY sort_order, created_at',
  )
    .bind(partnerId)
    .all<{ id: string }>();

  return json(request, env, {
    email: account?.email ?? '',
    profile: profile
      ? {
          placeId: profile.place_id,
          restaurantName: profile.restaurant_name,
          address: profile.address,
          description: profile.description,
          featured: profile.featured === 1,
        }
      : null,
    photos: (photos.results ?? []).map((row) => ({ id: row.id, url: photoUrl(url, row.id) })),
  });
}

async function handlePartnerSaveProfile(request: Request, env: Env): Promise<Response> {
  const partnerId = await requirePartner(request, env);
  const body = await readJson<{
    placeId?: string;
    restaurantName?: string;
    address?: string;
    description?: string;
  }>(request);
  const restaurantName = body.restaurantName?.trim() ?? '';
  if (!restaurantName) throw new HttpError(400, 'Restaurant name is required.');
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO partner_profiles (partner_id, place_id, restaurant_name, address, description, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(partner_id) DO UPDATE SET
       place_id = excluded.place_id,
       restaurant_name = excluded.restaurant_name,
       address = excluded.address,
       description = excluded.description,
       updated_at = excluded.updated_at`,
  )
    .bind(
      partnerId,
      body.placeId?.trim() || null,
      restaurantName,
      body.address?.trim() || null,
      body.description?.trim() || null,
      now,
    )
    .run();
  return json(request, env, { ok: true });
}

async function handlePartnerPlacesSearch(request: Request, env: Env, url: URL): Promise<Response> {
  await requirePartner(request, env);
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, 'Places service not configured.');
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return json(request, env, { restaurants: [] });
  const restaurants = await googleSearch(apiKey, query);
  return json(
    request,
    env,
    { restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, address: r.address })) },
  );
}

async function handlePartnerUploadPhoto(request: Request, env: Env, url: URL): Promise<Response> {
  const partnerId = await requirePartner(request, env);
  if (!env.PHOTOS) throw new HttpError(503, 'Photo storage is not configured.');

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM partner_photos WHERE partner_id = ?')
    .bind(partnerId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PARTNER_PHOTOS) {
    throw new HttpError(400, `You can upload up to ${MAX_PARTNER_PHOTOS} photos.`);
  }

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  if (!contentType.startsWith('image/')) throw new HttpError(400, 'Please upload an image file.');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) throw new HttpError(400, 'Empty file.');
  if (bytes.byteLength > 5 * 1024 * 1024) throw new HttpError(400, 'Images must be under 5 MB.');

  const ext = contentType.split('/')[1]?.split('+')[0] ?? 'jpg';
  const id = randomId('photo');
  const key = `partners/${partnerId}/${id}.${ext}`;
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType } });
  await env.DB.prepare(
    'INSERT INTO partner_photos (id, partner_id, r2_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, partnerId, key, (count?.n ?? 0), new Date().toISOString())
    .run();
  return json(request, env, { id, url: photoUrl(url, id) }, 201);
}

async function handlePartnerServePhoto(env: Env, photoId: string): Promise<Response> {
  if (!env.PHOTOS) throw new HttpError(404, 'Not found.');
  const row = await env.DB.prepare('SELECT r2_key FROM partner_photos WHERE id = ?')
    .bind(photoId)
    .first<{ r2_key: string }>();
  if (!row) throw new HttpError(404, 'Not found.');
  const object = await env.PHOTOS.get(row.r2_key);
  if (!object) throw new HttpError(404, 'Not found.');
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'public, max-age=86400',
    },
  });
}

async function handlePartnerDeletePhoto(request: Request, env: Env, photoId: string): Promise<Response> {
  const partnerId = await requirePartner(request, env);
  const row = await env.DB.prepare('SELECT r2_key FROM partner_photos WHERE id = ? AND partner_id = ?')
    .bind(photoId, partnerId)
    .first<{ r2_key: string }>();
  if (!row) throw new HttpError(404, 'Photo not found.');
  if (env.PHOTOS) await env.PHOTOS.delete(row.r2_key);
  await env.DB.prepare('DELETE FROM partner_photos WHERE id = ?').bind(photoId).run();
  return json(request, env, { ok: true });
}

// Sponsored placement is finite inventory. How many top slots exist, and how
// long each rotation lasts before a different set of sponsors is shown.
const FEATURED_ROTATION_WINDOW_MS = 15 * 60 * 1000;

function featuredSlots(env: Env): number {
  const n = Number(env.FEATURED_SLOTS ?? '2');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/**
 * Choose which sponsors fill the (capped) featured slots. When more sponsors
 * are active than there are slots, rotate the window over time so every payer
 * gets a fair share of the top placement instead of all appearing at once.
 * Pure + deterministic for a given (ids, slots, bucket).
 */
function selectRotatingFeatured(sortedIds: string[], slots: number, bucket: number): Set<string> {
  if (slots <= 0 || sortedIds.length === 0) return new Set();
  if (sortedIds.length <= slots) return new Set(sortedIds);
  const chosen = new Set<string>();
  const offset = ((bucket % sortedIds.length) + sortedIds.length) % sortedIds.length;
  for (let i = 0; i < slots; i += 1) {
    const id = sortedIds[(offset + i) % sortedIds.length];
    if (id) chosen.add(id);
  }
  return chosen;
}

/** Merge partner photos (free) + capped/rotated featured flag into feed results by place id. */
async function enrichWithPartners(
  env: Env,
  url: URL,
  restaurants: (Restaurant & { distanceKm?: number })[],
): Promise<void> {
  if (restaurants.length === 0) return;
  const ids = restaurants.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const profiles = await env.DB.prepare(
    `SELECT partner_id, place_id, featured FROM partner_profiles WHERE place_id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ partner_id: string; place_id: string; featured: number }>();
  const byPlace = new Map((profiles.results ?? []).map((p) => [p.place_id, p]));
  if (byPlace.size === 0) return;

  // Free tier: every claimed profile shows its photos on its card.
  await Promise.all(
    restaurants.map(async (r) => {
      const profile = byPlace.get(r.id);
      if (!profile) return;
      const photos = await env.DB.prepare(
        'SELECT id FROM partner_photos WHERE partner_id = ? ORDER BY sort_order, created_at',
      )
        .bind(profile.partner_id)
        .all<{ id: string }>();
      const urls = (photos.results ?? []).map((row) => photoUrl(url, row.id));
      if (urls.length > 0) r.photos = urls;
    }),
  );

  // Paid tier: cap + rotate the sponsored slots among the active sponsors that
  // matched this feed (photos already shown above regardless of placement).
  const sponsorIds = restaurants
    .filter((r) => byPlace.get(r.id)?.featured === 1)
    .map((r) => r.id)
    .sort((a, b) => a.localeCompare(b));
  if (sponsorIds.length === 0) return;
  const bucket = Math.floor(Date.now() / FEATURED_ROTATION_WINDOW_MS);
  const featured = selectRotatingFeatured(sponsorIds, featuredSlots(env), bucket);
  restaurants.forEach((r) => {
    if (featured.has(r.id)) r.featured = true;
  });
}

const PARTNER_PORTAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Sushi Party for Restaurants</title>
<style>
  :root { --bg:#0E0C0B; --surface:#1C1817; --surface2:#262120; --border:rgba(255,255,255,0.10);
    --text:#F5F1EE; --muted:#B0A8A2; --faint:#7E756F; --accent:#E53935; --accent2:#FF4B33; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:640px; margin:0 auto; padding:24px 20px 64px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .brand .logo { font-size:26px; }
  .brand h1 { font-size:20px; margin:0; font-weight:700; }
  .tagline { color:var(--muted); font-size:14px; margin:0 0 24px; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:16px; }
  h2 { font-size:15px; margin:0 0 12px; }
  label { display:block; font-size:13px; color:var(--muted); margin:14px 0 6px; }
  input, textarea { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:10px;
    color:var(--text); padding:12px 14px; font-size:15px; font-family:inherit; }
  input:focus, textarea:focus { outline:none; border-color:var(--accent); }
  textarea { min-height:90px; resize:vertical; }
  button { cursor:pointer; border:none; border-radius:999px; font-size:15px; font-weight:700; }
  .btn { width:100%; background:var(--accent); color:#fff; padding:14px; margin-top:18px; }
  .btn:disabled { opacity:.5; cursor:default; }
  .btn.secondary { background:transparent; color:var(--accent); border:1.5px solid var(--accent); }
  .link { background:none; color:var(--accent); font-weight:600; font-size:14px; padding:8px 0; width:auto; }
  .muted { color:var(--muted); font-size:13px; }
  .err { color:#ff8a80; font-size:13px; margin-top:10px; min-height:16px; }
  .ok { color:#9ccc65; font-size:13px; margin-top:10px; min-height:16px; }
  .hidden { display:none; }
  .results { margin-top:8px; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  .result { padding:12px 14px; border-bottom:1px solid var(--border); cursor:pointer; }
  .result:last-child { border-bottom:none; }
  .result:hover { background:var(--surface2); }
  .result .rname { font-weight:600; font-size:14px; }
  .result .raddr { color:var(--faint); font-size:12px; }
  .selected { background:var(--surface2); border:1px solid var(--accent); border-radius:10px; padding:12px 14px; margin-top:8px; }
  .photos { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:10px; margin-top:12px; }
  .photo { position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; background:var(--surface2); }
  .photo img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo .del { position:absolute; top:4px; right:4px; width:24px; height:24px; border-radius:12px;
    background:rgba(0,0,0,0.6); color:#fff; font-size:14px; line-height:24px; text-align:center; padding:0; }
  .rowbtns { display:flex; gap:10px; align-items:center; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><span class="logo">🍣</span><h1>Sushi Party for Restaurants</h1></div>
  <p class="tagline">Set up your profile to get discovered by hungry diners nearby.</p>

  <div id="authView" class="card">
    <h2 id="authTitle">Sign in to your partner account</h2>
    <label>Email</label>
    <input id="email" type="email" autocomplete="email" placeholder="you@restaurant.com" />
    <label>Password</label>
    <input id="password" type="password" autocomplete="current-password" placeholder="At least 8 characters" />
    <div id="authErr" class="err"></div>
    <button id="authBtn" class="btn">Sign in</button>
    <button id="authToggle" class="link">New here? Create a partner account</button>
  </div>

  <div id="appView" class="hidden">
    <div class="card">
      <h2>Your restaurant</h2>
      <p class="muted">Find and claim your restaurant so your profile shows on the right listing.</p>
      <input id="placeSearch" type="text" placeholder="Search your restaurant name" />
      <div id="results" class="results hidden"></div>
      <div id="selected" class="selected hidden"></div>
      <label>Restaurant name</label>
      <input id="rname" type="text" placeholder="Your restaurant name" />
      <label>Address</label>
      <input id="raddr" type="text" placeholder="Address" />
      <label>Description</label>
      <textarea id="rdesc" placeholder="Tell diners what makes your sushi special."></textarea>
      <div id="saveOk" class="ok"></div>
      <div id="saveErr" class="err"></div>
      <button id="saveBtn" class="btn">Save profile</button>
    </div>

    <div class="card">
      <h2>Photos</h2>
      <p class="muted">Up to 8 photos. These appear on your card in the app's Explore feed.</p>
      <div id="photos" class="photos"></div>
      <input id="fileInput" type="file" accept="image/*" multiple class="hidden" />
      <div id="photoErr" class="err"></div>
      <button id="addPhotoBtn" class="btn secondary">Add photos</button>
    </div>

    <div class="card">
      <h2>Featured placement</h2>
      <p class="muted" id="billingStatus">Loading…</p>
      <div id="billingErr" class="err"></div>
      <button id="billingBtn" class="btn hidden">Get featured</button>
    </div>

    <div class="rowbtns">
      <button id="logoutBtn" class="link">Log out</button>
      <span id="whoami" class="muted"></span>
    </div>
  </div>
</div>

<script>
(function(){
  'use strict';
  var TK='sp_partner_token';
  var mode='login';
  var selected=null;
  var searchTimer=null;

  function tok(){ return localStorage.getItem(TK); }
  function setTok(t){ if(t){ localStorage.setItem(TK,t); } else { localStorage.removeItem(TK); } }
  function el(id){ return document.getElementById(id); }
  function show(id,on){ el(id).classList[on?'remove':'add']('hidden'); }

  function api(path, opts){
    opts = opts || {};
    opts.headers = opts.headers || {};
    var t = tok();
    if (t) { opts.headers['Authorization'] = 'Bearer ' + t; }
    return fetch(path, opts).then(function(r){
      return r.text().then(function(txt){
        var j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch(e){}
        if (!r.ok) { throw new Error(j.error || ('Error ' + r.status)); }
        return j;
      });
    });
  }

  // ---- Auth ----
  function renderAuthMode(){
    el('authTitle').textContent = mode==='login' ? 'Sign in to your partner account' : 'Create a partner account';
    el('authBtn').textContent = mode==='login' ? 'Sign in' : 'Create account';
    el('authToggle').textContent = mode==='login' ? 'New here? Create a partner account' : 'Have an account? Sign in';
    el('password').setAttribute('autocomplete', mode==='login' ? 'current-password' : 'new-password');
  }
  el('authToggle').onclick = function(){ mode = mode==='login' ? 'signup' : 'login'; el('authErr').textContent=''; renderAuthMode(); };
  el('authBtn').onclick = function(){
    var email = el('email').value.trim();
    var password = el('password').value;
    el('authErr').textContent = '';
    el('authBtn').disabled = true;
    api('/partners/' + (mode==='login'?'login':'signup'), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, password: password })
    }).then(function(res){
      setTok(res.token); enterApp();
    }).catch(function(e){ el('authErr').textContent = e.message; })
      .then(function(){ el('authBtn').disabled = false; });
  };

  function logout(){ setTok(null); show('appView',false); show('authView',true); }
  el('logoutBtn').onclick = logout;

  // ---- Profile ----
  function selectPlace(p){
    selected = p;
    show('results',false); el('placeSearch').value='';
    el('selected').textContent = 'Claimed: ' + p.name + (p.address? ' — ' + p.address : '');
    show('selected',true);
    if(!el('rname').value) el('rname').value = p.name;
    if(!el('raddr').value && p.address) el('raddr').value = p.address;
  }
  el('placeSearch').oninput = function(){
    var q = el('placeSearch').value.trim();
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) { show('results',false); return; }
    searchTimer = setTimeout(function(){
      api('/partners/places/search?q=' + encodeURIComponent(q)).then(function(res){
        var box = el('results'); box.innerHTML='';
        (res.restaurants||[]).forEach(function(p){
          var d = document.createElement('div'); d.className='result';
          d.innerHTML = '<div class="rname"></div><div class="raddr"></div>';
          d.querySelector('.rname').textContent = p.name;
          d.querySelector('.raddr').textContent = p.address || '';
          d.onclick = function(){ selectPlace(p); };
          box.appendChild(d);
        });
        show('results', (res.restaurants||[]).length>0);
      }).catch(function(){});
    }, 350);
  };

  el('saveBtn').onclick = function(){
    el('saveOk').textContent=''; el('saveErr').textContent='';
    el('saveBtn').disabled = true;
    api('/partners/profile', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        placeId: selected ? selected.id : null,
        restaurantName: el('rname').value.trim(),
        address: el('raddr').value.trim(),
        description: el('rdesc').value.trim()
      })
    }).then(function(){ el('saveOk').textContent = 'Saved.'; })
      .catch(function(e){ el('saveErr').textContent = e.message; })
      .then(function(){ el('saveBtn').disabled = false; });
  };

  // ---- Photos ----
  function renderPhotos(photos){
    var box = el('photos'); box.innerHTML='';
    photos.forEach(function(ph){
      var d = document.createElement('div'); d.className='photo';
      var img = document.createElement('img'); img.src = ph.url; d.appendChild(img);
      var b = document.createElement('button'); b.className='del'; b.textContent='×';
      b.onclick = function(){ deletePhoto(ph.id, d); };
      d.appendChild(b);
      box.appendChild(d);
    });
  }
  function deletePhoto(id, node){
    api('/partners/photos/' + id, { method:'DELETE' }).then(function(){
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }).catch(function(e){ el('photoErr').textContent = e.message; });
  }
  el('addPhotoBtn').onclick = function(){ el('fileInput').click(); };
  el('fileInput').onchange = function(){
    var files = Array.prototype.slice.call(el('fileInput').files || []);
    el('photoErr').textContent='';
    var chain = Promise.resolve();
    files.forEach(function(f){
      chain = chain.then(function(){
        return api('/partners/photos', { method:'POST', headers:{'Content-Type': f.type}, body: f })
          .then(function(res){
            var box = el('photos');
            var d = document.createElement('div'); d.className='photo';
            var img = document.createElement('img'); img.src = res.url; d.appendChild(img);
            var b = document.createElement('button'); b.className='del'; b.textContent='×';
            b.onclick = function(){ deletePhoto(res.id, d); };
            d.appendChild(b); box.appendChild(d);
          });
      }).catch(function(e){ el('photoErr').textContent = e.message; });
    });
    chain.then(function(){ el('fileInput').value=''; });
  };

  // ---- Billing ----
  var isFeatured=false;
  function renderBilling(featured){
    isFeatured = featured;
    el('billingStatus').textContent = featured
      ? 'Your restaurant is featured — you appear at the top of the nearby feed with a Featured badge.'
      : 'Get featured to appear at the top of the nearby feed with a Featured badge.';
    el('billingBtn').textContent = featured ? 'Manage subscription' : 'Get featured';
    show('billingBtn', true);
  }
  el('billingBtn').onclick = function(){
    el('billingErr').textContent = '';
    el('billingBtn').disabled = true;
    var path = isFeatured ? '/partners/billing/portal' : '/partners/billing/checkout';
    api(path, { method:'POST' }).then(function(res){
      if (res.url) { window.location.href = res.url; } else { el('billingBtn').disabled = false; }
    }).catch(function(e){ el('billingErr').textContent = e.message; el('billingBtn').disabled = false; });
  };

  // ---- Boot ----
  function enterApp(){
    show('authView',false); show('appView',true);
    api('/partners/me').then(function(me){
      el('whoami').textContent = me.email || '';
      if (me.profile){
        el('rname').value = me.profile.restaurantName || '';
        el('raddr').value = me.profile.address || '';
        el('rdesc').value = me.profile.description || '';
        if (me.profile.placeId){ selected = { id: me.profile.placeId, name: me.profile.restaurantName||'', address: me.profile.address||'' };
          el('selected').textContent = 'Claimed: ' + (me.profile.restaurantName||''); show('selected',true); }
      }
      renderPhotos(me.photos || []);
      renderBilling(!!(me.profile && me.profile.featured));
    }).catch(function(){ logout(); });
  }

  if (location.search.indexOf('billing=success') >= 0 && window.history.replaceState) {
    window.history.replaceState(null, '', '/partners');
  }
  renderAuthMode();
  if (tok()) { enterApp(); } else { show('authView',true); }
})();
</script>
</body>
</html>`;

async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJson<AccountAuthBody>(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    throw new HttpError(401, 'Incorrect email or password.');
  }

  const credential = await env.DB.prepare('SELECT * FROM account_credentials WHERE email_normalized = ?')
    .bind(email)
    .first<AccountCredentialRow>();

  if (!credential) {
    await derivePasswordHash(password, DUMMY_PASSWORD_SALT, PASSWORD_ITERATIONS);
    throw new HttpError(401, 'Incorrect email or password.');
  }

  const valid = await verifyPassword(password, credential);
  if (!valid) {
    throw new HttpError(401, 'Incorrect email or password.');
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE uid = ?')
    .bind(credential.user_uid)
    .first<UserRow>();
  if (!row) {
    throw new HttpError(404, 'User not found.');
  }

  const user = rowToUser(row);
  const token = await signToken(user.uid, env);
  return json(request, env, { token, user, accountBacked: true });
}

async function handleAuthOAuth(request: Request, env: Env, provider: 'apple' | 'google' | 'facebook'): Promise<Response> {
  const body = await readJson<{
    providerUid?: string;
    email?: string;
    displayName?: string;
    avatar?: string;
  }>(request);

  if (!body.providerUid) {
    throw new HttpError(400, 'providerUid is required.');
  }
  const providerUid = body.providerUid.trim();
  const email = normalizeEmail(body.email);
  const displayName = body.displayName?.trim() || 'Sushi Friend';

  const now = new Date().toISOString();

  // Look up by (provider, provider_uid) first — canonical path
  const oauthRow = await env.DB
    .prepare('SELECT user_uid FROM oauth_accounts WHERE provider = ? AND provider_uid = ?')
    .bind(provider, providerUid)
    .first<{ user_uid: string }>();

  let uid: string;

  if (oauthRow) {
    uid = oauthRow.user_uid;
  } else {
    // Migration path: try to find existing user by email
    const existingByEmail = email
      ? await env.DB.prepare('SELECT uid FROM users WHERE email = ?').bind(email).first<{ uid: string }>()
      : null;

    uid = existingByEmail?.uid ?? randomId('user');
    const username = normalizeUsername(displayName.toLowerCase().replace(/\s+/g, '_'), uid);

    await upsertUser(env, { uid, email, displayName, username, ...(body.avatar ? { avatar: body.avatar } : {}) });

    // Link this provider to the user
    await env.DB
      .prepare(
        `INSERT INTO oauth_accounts (provider, provider_uid, user_uid, email, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_uid) DO NOTHING`,
      )
      .bind(provider, providerUid, uid, email || null, now)
      .run();
  }

  // Update avatar / displayName if provided (user may have changed them)
  if (body.avatar || body.displayName) {
    await upsertUser(env, { uid, ...(body.avatar ? { avatar: body.avatar } : {}), ...(body.displayName ? { displayName: body.displayName } : {}) });
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first<UserRow>();
  if (!row) throw new HttpError(500, 'Failed to load user.');

  const user = rowToUser(row);
  const token = await signToken(user.uid, env);
  return json(request, env, { token, user, accountBacked: true });
}

async function handleUsers(request: Request, env: Env, parts: string[], url: URL): Promise<Response> {
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

  // Change the current user's account username, rate-limited to once per 7 days.
  if (request.method === 'POST' && parts[1] === 'me' && parts[2] === 'username') {
    const body = await readJson<{ username?: string }>(request);
    const username = normalizeUsername(body.username, '');
    if (!isValidAccountUsername(username)) {
      throw new HttpError(400, 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
    }

    const current = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first<UserRow>();
    if (!current) throw new HttpError(404, 'User not found.');

    // Re-submitting your own current username is a graceful no-op (no cooldown charged).
    if (current.username === username) {
      return json(request, env, { user: rowToUser(current) });
    }

    if (current.username_changed_at) {
      const lastChanged = Date.parse(current.username_changed_at);
      if (!Number.isNaN(lastChanged) && Date.now() - lastChanged < USERNAME_CHANGE_COOLDOWN_MS) {
        throw new HttpError(429, 'You can change your username once every 7 days.');
      }
    }

    const taken = await env.DB.prepare('SELECT uid FROM users WHERE username = ?')
      .bind(username)
      .first<{ uid: string }>();
    if (taken && taken.uid !== uid) {
      throw new HttpError(409, 'That username is already taken.');
    }

    const now = new Date().toISOString();
    try {
      await env.DB.prepare('UPDATE users SET username = ?, username_changed_at = ?, updated_at = ? WHERE uid = ?')
        .bind(username, now, now, uid)
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('unique')) {
        throw new HttpError(409, 'That username is already taken.');
      }
      throw error;
    }

    const row = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first<UserRow>();
    if (!row) throw new HttpError(500, 'Could not load user after saving.');
    return json(request, env, { user: rowToUser(row) });
  }

  if (request.method === 'GET' && parts[1] === 'username' && parts[2] && parts[3] === 'exists') {
    const username = normalizeUsername(decodeURIComponent(parts[2]), '');
    const row = await env.DB.prepare('SELECT uid FROM users WHERE username = ?').bind(username).first<{ uid: string }>();
    return json(request, env, { taken: !!row && row.uid !== uid });
  }

  // Search users by username prefix (for adding friends)
  if (request.method === 'GET' && parts[1] === 'search') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    if (q.length < 2) return json(request, env, { users: [] });
    const rows = await env.DB.prepare(
      `SELECT uid, username, display_name, avatar FROM users
       WHERE username >= ? AND username <= ? AND uid != ?
       ORDER BY username ASC LIMIT 20`,
    )
      .bind(q, `${q}￿`, uid)
      .all<Pick<UserRow, 'uid' | 'username' | 'display_name' | 'avatar'>>();
    return json(request, env, {
      users: (rows.results ?? []).map((r) => ({
        uid: r.uid,
        username: r.username,
        displayName: r.display_name,
        ...(r.avatar ? { avatar: r.avatar } : {}),
      })),
    });
  }

  // Add friend
  if (request.method === 'POST' && parts[1] === 'me' && parts[2] === 'friends') {
    const body = await readJson<{ friendUid: string }>(request);
    if (!body.friendUid?.trim()) throw new HttpError(400, 'friendUid is required.');
    const friendUid = body.friendUid.trim();
    if (friendUid === uid) throw new HttpError(400, 'Cannot add yourself as a friend.');

    const friendRow = await env.DB.prepare('SELECT uid FROM users WHERE uid = ?').bind(friendUid).first<{ uid: string }>();
    if (!friendRow) throw new HttpError(404, 'User not found.');

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO friendships (user_uid, friend_uid, created_at) VALUES (?, ?, ?)
       ON CONFLICT(user_uid, friend_uid) DO NOTHING`,
    )
      .bind(uid, friendUid, now)
      .run();

    // Keep friend_ids_json in sync
    const meRow = await env.DB.prepare('SELECT friend_ids_json FROM users WHERE uid = ?').bind(uid).first<{ friend_ids_json: string }>();
    const ids = safeJson<string[]>(meRow?.friend_ids_json, []);
    if (!ids.includes(friendUid)) {
      await env.DB.prepare('UPDATE users SET friend_ids_json = ?, updated_at = ? WHERE uid = ?')
        .bind(JSON.stringify([...ids, friendUid]), now, uid)
        .run();
    }

    return empty(request, env, 204);
  }

  // Remove friend
  if (request.method === 'DELETE' && parts[1] === 'me' && parts[2] === 'friends' && parts[3]) {
    const friendUid = parts[3];
    await env.DB.prepare('DELETE FROM friendships WHERE user_uid = ? AND friend_uid = ?').bind(uid, friendUid).run();

    const now = new Date().toISOString();
    const meRow = await env.DB.prepare('SELECT friend_ids_json FROM users WHERE uid = ?').bind(uid).first<{ friend_ids_json: string }>();
    const ids = safeJson<string[]>(meRow?.friend_ids_json, []).filter((id) => id !== friendUid);
    await env.DB.prepare('UPDATE users SET friend_ids_json = ?, updated_at = ? WHERE uid = ?')
      .bind(JSON.stringify(ids), now, uid)
      .run();

    return empty(request, env, 204);
  }

  // Friend activity feed
  if (request.method === 'GET' && parts[1] === 'me' && parts[2] === 'friends' && parts[3] === 'feed') {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
    const rows = await env.DB.prepare(
      `SELECT DISTINCT s.* FROM sessions s
       JOIN session_participants sp ON sp.session_id = s.id
       JOIN friendships f ON f.friend_uid = sp.user_uid
       WHERE f.user_uid = ?
       ORDER BY s.submitted_at DESC
       LIMIT ?`,
    )
      .bind(uid, limit)
      .all<SessionRow>();
    return json(request, env, { sessions: (rows.results ?? []).map(rowToSession) });
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

    // Index participants for efficient lookup (owner always included)
    const participantUids = new Set<string>([uid]);
    for (const p of participants) participantUids.add(p.userId);
    await Promise.all(
      Array.from(participantUids).map((pUid) =>
        env.DB.prepare(
          `INSERT INTO session_participants (session_id, user_uid) VALUES (?, ?)
           ON CONFLICT(session_id, user_uid) DO NOTHING`,
        )
          .bind(id, pUid)
          .run(),
      ),
    );

    return json(request, env, { id }, 201);
  }

  if (request.method === 'GET' && parts[1] === 'me') {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 200);
    const rows = await env.DB.prepare(
      `SELECT DISTINCT s.* FROM sessions s
       JOIN session_participants sp ON sp.session_id = s.id
       WHERE sp.user_uid = ?
       ORDER BY s.submitted_at DESC
       LIMIT ?`,
    )
      .bind(uid, limit)
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

    // Sync participant index if participants changed
    if (body.participants) {
      const uids = new Set<string>([session.ownerUid]);
      for (const p of next.participants) uids.add(p.userId);
      await Promise.all(
        Array.from(uids).map((pUid) =>
          env.DB.prepare(
            `INSERT INTO session_participants (session_id, user_uid) VALUES (?, ?)
             ON CONFLICT(session_id, user_uid) DO NOTHING`,
          )
            .bind(session.id, pUid)
            .run(),
        ),
      );
    }

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

  // Preserve multi-segment sub-paths (e.g. /end-vote/start) when proxying to the DO.
  const route = parts.length > 2 ? `/${parts.slice(2).join('/')}` : '/';
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
        phase: 'lobby',
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

    if (request.method === 'POST' && path === '/start') {
      const body = await readJson<{
        ownerUid: string;
        restaurantId?: string;
        restaurantName?: string;
        location?: GeoPoint;
        menuId?: string;
        menuVersion?: number;
        startedAt?: string;
      }>(request);
      const draft = await this.requireDraft();
      if (draft.ownerUid !== body.ownerUid) {
        return Response.json({ error: 'Only the party owner can start the party.' }, { status: 403 });
      }
      // Persist the host's session context on the draft so every guest receives
      // restaurant/menu/location/startedAt at phase='active'. Only overwrite keys
      // the host actually sent, leaving any prior values intact.
      const context: Partial<GroupSessionDraft> = {};
      if (body.restaurantId !== undefined) context.restaurantId = body.restaurantId;
      if (body.restaurantName !== undefined) context.restaurantName = body.restaurantName;
      if (body.location !== undefined) context.location = body.location;
      if (body.menuId !== undefined) context.menuId = body.menuId;
      if (body.menuVersion !== undefined) context.menuVersion = body.menuVersion;
      if (body.startedAt !== undefined) context.startedAt = body.startedAt;
      const next = {
        ...draft,
        ...context,
        phase: 'active' as GroupPhase,
        updatedAt: new Date().toISOString(),
      };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    if (request.method === 'POST' && path === '/end') {
      const body = await readJson<{ ownerUid: string }>(request);
      const draft = await this.requireDraft();
      if (draft.ownerUid !== body.ownerUid) {
        return Response.json({ error: 'Only the party owner can end the party.' }, { status: 403 });
      }
      const next = { ...draft, phase: 'ended' as GroupPhase, updatedAt: new Date().toISOString() };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    // Host opens an end-party vote. Does NOT change phase; the host implicitly accepts.
    if (request.method === 'POST' && path === '/end-vote/start') {
      const body = await readJson<{ ownerUid: string }>(request);
      const draft = await this.requireDraft();
      if (draft.ownerUid !== body.ownerUid) {
        return Response.json({ error: 'Only the party owner can start an end vote.' }, { status: 403 });
      }
      const now = new Date().toISOString();
      const next = {
        ...draft,
        endVote: {
          active: true,
          startedBy: body.ownerUid,
          acceptedUserIds: [body.ownerUid],
          startedAt: now,
        },
        updatedAt: now,
      };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    // Any participant accepts the vote. When every current participant has accepted,
    // the DO itself flips to phase='ended' (so it works even if the host is backgrounded).
    // Coverage is "every participant.userId is in acceptedUserIds", so a departed
    // non-voter can never deadlock the vote.
    if (request.method === 'POST' && path === '/end-vote/accept') {
      const body = await readJson<{ userId: string }>(request);
      const draft = await this.requireDraft();
      if (!draft.endVote || !draft.endVote.active) {
        // No open vote — idempotent no-op so a late/duplicate accept can't error.
        return Response.json({ draft });
      }
      const acceptedUserIds = draft.endVote.acceptedUserIds.includes(body.userId)
        ? draft.endVote.acceptedUserIds
        : [...draft.endVote.acceptedUserIds, body.userId];
      const everyoneAccepted = draft.participants.every((participant) =>
        acceptedUserIds.includes(participant.userId),
      );
      const now = new Date().toISOString();
      const next: GroupSessionDraft = everyoneAccepted
        ? {
            ...draft,
            phase: 'ended' as GroupPhase,
            endVote: { ...draft.endVote, active: false, acceptedUserIds },
            updatedAt: now,
          }
        : {
            ...draft,
            endVote: { ...draft.endVote, acceptedUserIds },
            updatedAt: now,
          };
      await this.writeDraft(next);
      await this.broadcast(next);
      return Response.json({ draft: next });
    }

    // Host abandons the vote. Removes the vote state; phase is unchanged.
    if (request.method === 'POST' && path === '/end-vote/cancel') {
      const body = await readJson<{ ownerUid: string }>(request);
      const draft = await this.requireDraft();
      if (draft.ownerUid !== body.ownerUid) {
        return Response.json({ error: 'Only the party owner can cancel the end vote.' }, { status: 403 });
      }
      const { endVote: _cancelled, ...rest } = draft;
      const next: GroupSessionDraft = { ...rest, updatedAt: new Date().toISOString() };
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
    // Legacy drafts written before the phase field existed default to 'lobby'.
    return { ...draft, phase: draft.phase ?? 'lobby' };
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
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // Places v1 enum, e.g. 'PRICE_LEVEL_MODERATE'
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
}

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours.openNow',
  'places.googleMapsUri',
].join(',');

// Places v1 returns price level as an enum string; map it to a 0..4 scale.
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

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
  const priceLevel = p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined;
  return {
    id: `google-${p.id}`,
    name,
    address: p.formattedAddress ?? '',
    location,
    menuId: 'global-default',
    stats: emptyStats(),
    ...(typeof p.rating === 'number' ? { rating: p.rating } : {}),
    ...(typeof p.userRatingCount === 'number' ? { userRatingCount: p.userRatingCount } : {}),
    ...(priceLevel !== undefined ? { priceLevel } : {}),
    ...(typeof p.currentOpeningHours?.openNow === 'boolean' ? { openNow: p.currentOpeningHours.openNow } : {}),
    ...(p.googleMapsUri ? { googleMapsUri: p.googleMapsUri } : {}),
    ...(center ? { distanceKm: haversineKm(center, location) } : {}),
  };
}

async function googleNearby(
  apiKey: string,
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): Promise<(Restaurant & { distanceKm?: number })[]> {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: googleHeaders(apiKey),
    body: JSON.stringify({
      textQuery: 'sushi',
      maxResultCount: 20,
      locationBias: {
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

  const cache = (caches as unknown as { default: Cache }).default;

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
    await enrichWithPartners(env, url, restaurants);
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
    await enrichWithPartners(env, url, restaurants);
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

  if (request.method === 'GET' && url.pathname === '/privacy') {
    return new Response(PRIVACY_POLICY_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'GET' && url.pathname === '/delete-account') {
    return new Response(DELETE_ACCOUNT_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'GET' && url.pathname === '/support') {
    return new Response(SUPPORT_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'GET' && url.pathname === '/terms') {
    return new Response(TERMS_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'POST' && url.pathname === '/auth/device') {
    return handleAuthDevice(request, env);
  }
  if (request.method === 'POST' && url.pathname === '/auth/register') {
    return handleAuthRegister(request, env);
  }
  if (request.method === 'POST' && url.pathname === '/auth/login') {
    return handleAuthLogin(request, env);
  }
  if (request.method === 'POST' && url.pathname === '/auth/apple') {
    return handleAuthOAuth(request, env, 'apple');
  }
  if (request.method === 'POST' && url.pathname === '/auth/google') {
    return handleAuthOAuth(request, env, 'google');
  }
  if (request.method === 'POST' && url.pathname === '/auth/facebook') {
    return handleAuthOAuth(request, env, 'facebook');
  }

  switch (parts[0]) {
    case 'partners':
      return handlePartners(request, env, parts, url);
    case 'users':
      return handleUsers(request, env, parts, url);
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

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sushi Party Privacy Policy</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  h3 { font-size: 1rem; margin-top: 1.2rem; }
  code { background: #f2f2f2; padding: 1px 4px; border-radius: 4px; }
  a { color: #c0392b; }
</style>
</head>
<body>
<h1>Sushi Party Privacy Policy</h1>
<p><em>Last updated: June 20, 2026</em></p>
<p>This Privacy Policy explains how Sushi Party ("the app") collects, uses, and stores information when you use it.</p>

<h2>1. Who We Are</h2>
<p>Sushi Party is provided by JoseppyCo ("we", "us", or "our"). For questions about this Privacy Policy, contact us at <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>.</p>

<h2>2. Information We Collect</h2>
<p>Sushi Party uses a cloud backend (a Cloudflare Worker with a Cloudflare D1 database and Durable Objects) to support accounts, sign-in, history, friends, and group sessions. We collect and store the following on our servers and/or your device:</p>
<h3>Account and profile information</h3>
<ul>
<li>Display name, username, email address, and avatar/profile image (if set)</li>
<li>Password credentials, stored only as a salted PBKDF2 hash — we never store your plaintext password</li>
<li>If you sign in with Google or Apple: a provider account identifier and the associated email</li>
</ul>
<h3>App content you create</h3>
<ul>
<li>Eating sessions, including sushi counts and item-level logs</li>
<li>Restaurant selections and session context</li>
<li>Session notes</li>
<li>Friend connections and tagged session participants</li>
</ul>
<h3>Location information</h3>
<ul>
<li>The approximate or precise location of an eating session (latitude/longitude), used to attach restaurant context and find nearby restaurants. Accessed only with your permission.</li>
</ul>
<h3>Device and app information</h3>
<ul>
<li>A locally generated device/profile identifier</li>
<li>An authentication token, stored securely on your device, to keep you signed in</li>
</ul>

<h2>3. How We Use Information</h2>
<ul>
<li>Create, authenticate, and manage your account</li>
<li>Save and display your session history across your devices</li>
<li>Show friends, activity, and tagged session participants</li>
<li>Help you find, create, and select restaurants</li>
<li>Support real-time group session features</li>
<li>Generate in-app analytics such as favorite items or restaurant insights</li>
<li>Maintain, secure, improve, and troubleshoot the app</li>
</ul>

<h2>4. Sign-In Providers</h2>
<p>You can sign in with email and password, with Google, or with Apple. When you use Google or Apple sign-in, we receive a provider account identifier and your email to create or match your account. We do not receive your provider password.</p>

<h2>5. Location Permissions</h2>
<p>Sushi Party may request location access to show nearby restaurants, pre-fill restaurant context, and associate a session with location data. Restaurant search may send a location query to Google Places. You can deny or revoke location permission anytime in your device settings.</p>

<h2>6. Third Parties and Service Providers</h2>
<ul>
<li><strong>Cloudflare</strong> — hosting for our backend, database (D1), and real-time group sessions (Durable Objects)</li>
<li><strong>Google</strong> — Google Sign-In and Google Places restaurant search</li>
<li><strong>Apple</strong> — Sign in with Apple</li>
</ul>
<p>We do not include advertising SDKs, we do not use third-party analytics SDKs, and we do not sell personal information.</p>

<h2>7. Data Retention</h2>
<p>We retain your account and session data while your account is active. Data stored locally on your device is removed if you uninstall the app or clear its storage.</p>

<h2>8. Data Deletion</h2>
<p>You can request deletion of your account and associated server-side data by emailing <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>. We will delete your account record, credentials, sessions, friendships, and related data, except where we must retain limited information to comply with legal obligations.</p>

<h2>9. Data Security</h2>
<p>We take reasonable steps to protect information, including hashing passwords and transmitting data over HTTPS. However, no method of storage or transmission is completely secure.</p>

<h2>10. Children's Privacy</h2>
<p>Sushi Party is not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has provided personal information, contact <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>.</p>

<h2>11. Your Choices</h2>
<ul>
<li>Edit your profile details in the app</li>
<li>Decline or revoke location permission</li>
<li>Request export or deletion of your data by contacting us</li>
</ul>

<h2>12. International Users</h2>
<p>Your information may be processed and stored on servers operated by our service providers in various regions. By using the app, you consent to this processing consistent with this policy.</p>

<h2>13. Changes to This Privacy Policy</h2>
<p>We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date above and reflect material changes in the app's store listings.</p>

<h2>14. Contact Us</h2>
<p>JoseppyCo — <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a></p>
</body>
</html>`;

const DELETE_ACCOUNT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Delete Your Sushi Party Account</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  ol { padding-left: 1.2rem; }
  code { background: #f2f2f2; padding: 1px 4px; border-radius: 4px; }
  a { color: #c0392b; }
</style>
</head>
<body>
<h1>Delete Your Sushi Party Account</h1>
<p>This page explains how to request deletion of your <strong>Sushi Party</strong> account (provided by JoseppyCo) and the data associated with it.</p>

<h2>How to request deletion</h2>
<ol>
<li>From the email address associated with your Sushi Party account, send an email to <a href="mailto:contact@joseppy.ca?subject=Delete%20my%20Sushi%20Party%20account">contact@joseppy.ca</a>.</li>
<li>Use the subject line <code>Delete my Sushi Party account</code>.</li>
<li>Include the email address or username on your account so we can locate it.</li>
</ol>
<p>We will verify the request and delete your account, usually within 30 days.</p>

<h2>What is deleted</h2>
<p>When your account is deleted, we permanently remove:</p>
<ul>
<li>Your profile (display name, username, email, avatar)</li>
<li>Your password credentials and any linked Google/Apple sign-in records</li>
<li>Your eating sessions, sushi counts, and session notes</li>
<li>Your friend connections and session participation records</li>
</ul>

<h2>What may be kept</h2>
<p>We may retain a limited amount of information where required to comply with legal obligations or to prevent fraud and abuse. Aggregated, non-identifying restaurant statistics that cannot be linked back to you may also be retained.</p>

<h2>Contact</h2>
<p>JoseppyCo — <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>. See also our <a href="/privacy">Privacy Policy</a>.</p>
</body>
</html>`;

const SUPPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sushi Party — Support</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  a { color: #e53935; }
</style>
</head>
<body>
<h1>Sushi Party — Support</h1>
<p>Sushi Party is a scoreboard for all-you-can-eat sushi: tap to count plates, submit your tally, and track your eating history with friends.</p>

<h2>Contact us</h2>
<p>Questions, bugs, or feedback? Email <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a> and we'll get back to you.</p>

<h2>Common help</h2>
<ul>
<li><strong>Counting:</strong> Start a party, pick a restaurant (optional), then tap + on each item. Submit when you're done.</li>
<li><strong>Location:</strong> Optional — only used to find nearby restaurants. The app works fully without it.</li>
<li><strong>Account &amp; sign-in:</strong> Sign in with email, Google, or Apple.</li>
<li><strong>Delete your account:</strong> see our <a href="/delete-account">account deletion page</a>.</li>
</ul>

<h2>Privacy</h2>
<p>Read our <a href="/privacy">Privacy Policy</a>.</p>

<p>JoseppyCo — <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a></p>
</body>
</html>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sushi Party — Terms of Service</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  a { color: #e53935; }
  .muted { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>Sushi Party — Terms of Service</h1>
<p class="muted">Last updated: 2026</p>
<p>By using Sushi Party ("the app"), you agree to these terms. If you don't agree, please don't use the app.</p>

<h2>Using the app</h2>
<p>Sushi Party is a scoreboard for tracking sushi you eat at parties. You may use it for your own personal, non-commercial use. Don't misuse the service, attempt to disrupt it, or use it to break the law.</p>

<h2>Your account</h2>
<p>You're responsible for activity under your account and for keeping your login secure. You can play as a guest or create an account; you can delete your account at any time from the app.</p>

<h2>Your content</h2>
<p>Party history and any details you enter belong to you. You grant us permission to store and process that data to provide the app, as described in our <a href="/privacy">Privacy Policy</a>.</p>

<h2>Restaurants &amp; listings</h2>
<p>Nearby restaurant information is provided by third parties (e.g. Google) and may be inaccurate or out of date. Restaurant "featured" placement is a paid advertising service and does not imply an endorsement.</p>

<h2>No warranty</h2>
<p>The app is provided "as is," without warranties of any kind. We don't guarantee it will be uninterrupted, error-free, or that any information shown is accurate.</p>

<h2>Limitation of liability</h2>
<p>To the extent permitted by law, JoseppyCo is not liable for any indirect or consequential damages arising from your use of the app.</p>

<h2>Changes</h2>
<p>We may update these terms from time to time. Continued use of the app after changes means you accept the updated terms.</p>

<h2>Contact</h2>
<p>Questions about these terms? Email <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>.</p>

<p>JoseppyCo — <a href="mailto:contact@joseppy.ca">contact@joseppy.ca</a>. See also our <a href="/privacy">Privacy Policy</a>.</p>
</body>
</html>`;

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
