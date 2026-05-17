import { createHash, createPublicKey, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { config } from '../config';

export type AppRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface AppAuthClaims {
  userId: string;
  email: string;
  role: AppRole;
  iat: number;
  authProvider?: string;
}

interface KeycloakPendingLogin {
  redirectUri: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

interface KeycloakTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface KeycloakUserRecord {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
  avatar_url?: string | null;
  is_active: boolean;
  keycloak_subject?: string | null;
  auth_provider?: string | null;
}

interface JwksKey {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

interface JwksResponse {
  keys: JwksKey[];
}

const APP_ROLES: AppRole[] = ['student', 'teacher', 'parent', 'admin'];
const KEYCLOAK_LOGIN_TTL_SECONDS = 10 * 60;
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

let jwksCache: { expiresAt: number; keys: JwksKey[] } | null = null;

export class KeycloakAuthError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'KeycloakAuthError';
  }
}

export function createPendingKeycloakLogin(redirectUri: string, requestOrigin?: string | null) {
  const normalizedRedirectUri = validateRedirectUriForRequest(redirectUri, requestOrigin);
  const state = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  const publicBaseUrl = keycloakPublicBaseUrl(requestOrigin);
  const url = buildKeycloakAuthorizationUrl({
    publicBaseUrl,
    redirectUri: normalizedRedirectUri,
    state,
    nonce,
    codeChallenge,
  });

  const pending: KeycloakPendingLogin = {
    redirectUri: normalizedRedirectUri,
    nonce,
    codeVerifier,
    createdAt: Date.now(),
  };

  return {
    state,
    url,
    pending,
    expiresIn: KEYCLOAK_LOGIN_TTL_SECONDS,
  };
}

export function keycloakLoginRedisKey(state: string) {
  return `keycloak:login:${state}`;
}

export function keycloakLoginTtlSeconds() {
  return KEYCLOAK_LOGIN_TTL_SECONDS;
}

export function parsePendingKeycloakLogin(raw: string | null): KeycloakPendingLogin {
  if (!raw) {
    throw new KeycloakAuthError('Keycloak login state expired. Please try again.', 400);
  }

  const parsed = JSON.parse(raw) as Partial<KeycloakPendingLogin>;
  if (!parsed.redirectUri || !parsed.nonce || !parsed.codeVerifier || !parsed.createdAt) {
    throw new KeycloakAuthError('Invalid Keycloak login state. Please try again.', 400);
  }

  return {
    redirectUri: parsed.redirectUri,
    nonce: parsed.nonce,
    codeVerifier: parsed.codeVerifier,
    createdAt: parsed.createdAt,
  };
}

export async function exchangeKeycloakCode(input: {
  code: string;
  redirectUri: string;
  pending: KeycloakPendingLogin;
  requestOrigin?: string | null;
}) {
  const redirectUri = validateRedirectUriForRequest(input.redirectUri, input.requestOrigin);
  if (redirectUri !== input.pending.redirectUri) {
    throw new KeycloakAuthError('Keycloak redirect URI does not match the login request.', 400);
  }

  const tokenResponse = await requestKeycloakToken({
    code: input.code,
    redirectUri,
    codeVerifier: input.pending.codeVerifier,
  });

  const claims = await verifyKeycloakJwt(tokenResponse.id_token, {
    audience: config.KEYCLOAK_CLIENT_ID,
    nonce: input.pending.nonce,
    requestOrigin: input.requestOrigin,
  });

  const userInfo = await fetchKeycloakUserInfo(tokenResponse.access_token).catch(() => null);
  const user = await upsertKeycloakUser(claims, userInfo);

  return {
    user,
    tokenResponse,
    claims,
  };
}

export async function authenticateKeycloakBearerToken(
  authorizationHeader?: string | null,
  requestOrigin?: string | null,
): Promise<AppAuthClaims | null> {
  const token = bearerToken(authorizationHeader);
  if (!token) return null;

  const claims = await verifyKeycloakJwt(token, { requestOrigin });
  if (!isTokenIssuedForConfiguredClient(claims)) {
    throw new KeycloakAuthError('Keycloak token was not issued for this app.', 401);
  }

  const user = await upsertKeycloakUser(claims, null);
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    authProvider: 'keycloak',
  };
}

export function roleFromKeycloakClaims(claims: JwtPayload, userInfo?: Record<string, unknown> | null): AppRole {
  const candidates = [
    claims.role,
    claims.app_role,
    claims.eduapp_role,
    claims['tusyen_role'],
    userInfo?.role,
    userInfo?.app_role,
    ...extractRoles(claims.realm_access),
    ...extractRoles(claims.resource_access?.[config.KEYCLOAK_CLIENT_ID]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.toLowerCase();
    if (APP_ROLES.includes(normalized as AppRole)) return normalized as AppRole;
  }

  return 'student';
}

export function validateRedirectUriForRequest(redirectUri: string, requestOrigin?: string | null): string {
  let uri: URL;
  try {
    uri = new URL(redirectUri);
  } catch {
    throw new KeycloakAuthError('Invalid redirect URI.', 400);
  }

  if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
    throw new KeycloakAuthError('Keycloak redirect URI must use HTTP or HTTPS.', 400);
  }
  if (uri.username || uri.password || uri.hash) {
    throw new KeycloakAuthError('Keycloak redirect URI cannot include credentials or fragments.', 400);
  }

  const allowedOrigins = allowedRedirectOrigins(requestOrigin);
  if (!allowedOrigins.some((allowed) => originMatchesAllowed(uri.origin, allowed))) {
    throw new KeycloakAuthError('Keycloak redirect URI origin is not allowed.', 400);
  }

  return uri.toString();
}

export function requestOriginFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const origin = firstHeader(headers.origin);
  if (origin && origin !== 'null') return normalizeOrigin(origin);

  const forwardedHost = firstHeader(headers['x-forwarded-host']);
  const host = forwardedHost || firstHeader(headers.host);
  if (!host) return null;

  const cloudflareProto = schemeFromCloudflareVisitor(firstHeader(headers['cf-visitor']))
    || (firstHeader(headers['cf-ray']) ? 'https' : null);
  const forwardedProto = firstForwardedValue(firstHeader(headers['x-forwarded-proto']));
  const protocol = cloudflareProto
    || forwardedProto
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return normalizeOrigin(`${protocol}://${host}`);
}

export function keycloakPublicBaseUrl(requestOrigin?: string | null): string {
  if (config.KEYCLOAK_PUBLIC_URL) return trimTrailingSlash(config.KEYCLOAK_PUBLIC_URL);
  if (requestOrigin) return `${trimTrailingSlash(requestOrigin)}/auth`;
  return trimTrailingSlash(config.KEYCLOAK_URL);
}

export function keycloakInternalIssuer() {
  return joinUrl(config.KEYCLOAK_URL, `/realms/${encodeURIComponent(config.KEYCLOAK_REALM)}`);
}

export function buildKeycloakAuthorizationUrl(input: {
  publicBaseUrl: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const url = new URL(joinUrl(input.publicBaseUrl, `/realms/${encodeURIComponent(config.KEYCLOAK_REALM)}/protocol/openid-connect/auth`));
  url.searchParams.set('client_id', config.KEYCLOAK_CLIENT_ID);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function requestKeycloakToken(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<KeycloakTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.KEYCLOAK_CLIENT_ID,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  if (config.KEYCLOAK_CLIENT_SECRET) {
    body.set('client_secret', config.KEYCLOAK_CLIENT_SECRET);
  }

  const response = await fetch(joinUrl(keycloakInternalIssuer(), '/protocol/openid-connect/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new KeycloakAuthError('Keycloak rejected the authorization code.', 401);
  }

  const tokenResponse = await response.json() as Partial<KeycloakTokenResponse>;
  if (!tokenResponse.access_token || !tokenResponse.id_token) {
    throw new KeycloakAuthError('Keycloak token response was incomplete.', 502);
  }

  return tokenResponse as KeycloakTokenResponse;
}

async function fetchKeycloakUserInfo(accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(joinUrl(keycloakInternalIssuer(), '/protocol/openid-connect/userinfo'), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new KeycloakAuthError('Could not load Keycloak user profile.', 502);
  }

  return await response.json() as Record<string, unknown>;
}

async function verifyKeycloakJwt(
  token: string,
  options: { audience?: string; nonce?: string; requestOrigin?: string | null },
): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new KeycloakAuthError('Invalid Keycloak token.', 401);
  }

  const publicKey = await publicKeyForKid(decoded.header.kid);
  const issuers = allowedKeycloakIssuers(options.requestOrigin) as [string, ...string[]];
  const verifyOptions: jwt.VerifyOptions = {
    algorithms: ['RS256'],
    issuer: issuers,
  };
  if (options.audience) verifyOptions.audience = options.audience;

  const verified = jwt.verify(token, publicKey, verifyOptions);
  if (!verified || typeof verified === 'string') {
    throw new KeycloakAuthError('Invalid Keycloak token payload.', 401);
  }

  const payload = verified as JwtPayload;
  if (options.nonce && payload.nonce !== options.nonce) {
    throw new KeycloakAuthError('Keycloak nonce check failed.', 401);
  }

  return payload;
}

async function publicKeyForKid(kid: string): Promise<string> {
  const keys = await keycloakJwks();
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) {
    jwksCache = null;
    const freshKeys = await keycloakJwks();
    const freshJwk = freshKeys.find((key) => key.kid === kid);
    if (!freshJwk) throw new KeycloakAuthError('Unknown Keycloak signing key.', 401);
    return jwkToPem(freshJwk);
  }
  return jwkToPem(jwk);
}

async function keycloakJwks(): Promise<JwksKey[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;

  const response = await fetch(joinUrl(keycloakInternalIssuer(), '/protocol/openid-connect/certs'));
  if (!response.ok) {
    throw new KeycloakAuthError('Could not load Keycloak signing keys.', 502);
  }

  const data = await response.json() as JwksResponse;
  jwksCache = {
    expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    keys: data.keys || [],
  };
  return jwksCache.keys;
}

function jwkToPem(jwk: JwksKey): string {
  const keyObject = createPublicKey({ key: jwk, format: 'jwk' } as any);
  return keyObject.export({ type: 'spki', format: 'pem' }).toString();
}

async function upsertKeycloakUser(
  claims: JwtPayload,
  userInfo?: Record<string, unknown> | null,
): Promise<KeycloakUserRecord> {
  if (!claims.sub) throw new KeycloakAuthError('Keycloak token is missing subject.', 401);

  const existingBySubject = await db.query<KeycloakUserRecord>(
    `SELECT id, email, role, full_name, avatar_url, is_active, keycloak_subject, auth_provider
     FROM users
     WHERE keycloak_subject = $1`,
    [claims.sub],
  );

  if ((existingBySubject.rowCount ?? 0) > 0) {
    const user = existingBySubject.rows[0];
    if (!user.is_active) throw new KeycloakAuthError('Account deactivated.', 403);

    await db.query(
      `UPDATE users
       SET email_verified = COALESCE($2, email_verified),
           full_name = COALESCE($3, full_name),
           last_login = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, emailVerifiedFromClaims(claims, userInfo), fullNameFromClaims(claims, userInfo)],
    );
    return user;
  }

  const email = emailFromClaims(claims, userInfo);
  if (!email) {
    throw new KeycloakAuthError('Keycloak account does not expose an email address.', 400);
  }

  const existingByEmail = await db.query<KeycloakUserRecord>(
    `SELECT id, email, role, full_name, avatar_url, is_active, keycloak_subject, auth_provider
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  );

  if ((existingByEmail.rowCount ?? 0) > 0) {
    const user = existingByEmail.rows[0];
    if (!user.is_active) throw new KeycloakAuthError('Account deactivated.', 403);
    if (user.keycloak_subject && user.keycloak_subject !== claims.sub) {
      throw new KeycloakAuthError('This email is already linked to another Keycloak account.', 409);
    }

    const provider = user.auth_provider === 'local' ? 'local_keycloak' : user.auth_provider || 'keycloak';
    const updated = await db.query<KeycloakUserRecord>(
      `UPDATE users
       SET keycloak_subject = $2,
           auth_provider = $3,
           email_verified = COALESCE($4, email_verified),
           full_name = COALESCE($5, full_name),
           last_login = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, role, full_name, avatar_url, is_active, keycloak_subject, auth_provider`,
      [user.id, claims.sub, provider, emailVerifiedFromClaims(claims, userInfo), fullNameFromClaims(claims, userInfo)],
    );
    return updated.rows[0];
  }

  const role = roleFromKeycloakClaims(claims, userInfo);
  const fullName = fullNameFromClaims(claims, userInfo) || email.split('@')[0] || 'Tusyen User';
  const passwordHash = await bcrypt.hash(base64Url(randomBytes(32)), 10);
  const created = await db.query<KeycloakUserRecord>(
    `INSERT INTO users
       (id, email, password_hash, role, full_name, is_active, auth_provider, keycloak_subject, email_verified, last_login)
     VALUES ($1, $2, $3, $4, $5, true, 'keycloak', $6, $7, NOW())
     RETURNING id, email, role, full_name, avatar_url, is_active, keycloak_subject, auth_provider`,
    [uuidv4(), email, passwordHash, role, fullName, claims.sub, emailVerifiedFromClaims(claims, userInfo) || false],
  );

  return created.rows[0];
}

function emailFromClaims(claims: JwtPayload, userInfo?: Record<string, unknown> | null): string | null {
  const value = stringClaim(userInfo?.email) || stringClaim(claims.email);
  return value ? value.toLowerCase() : null;
}

function fullNameFromClaims(claims: JwtPayload, userInfo?: Record<string, unknown> | null): string | null {
  const name = stringClaim(userInfo?.name) || stringClaim(claims.name);
  if (name) return name;

  const givenName = stringClaim(userInfo?.given_name) || stringClaim(claims.given_name);
  const familyName = stringClaim(userInfo?.family_name) || stringClaim(claims.family_name);
  const combined = [givenName, familyName].filter(Boolean).join(' ').trim();
  if (combined) return combined;

  return stringClaim(userInfo?.preferred_username) || stringClaim(claims.preferred_username);
}

function emailVerifiedFromClaims(claims: JwtPayload, userInfo?: Record<string, unknown> | null): boolean | null {
  const value = userInfo?.email_verified ?? claims.email_verified;
  return typeof value === 'boolean' ? value : null;
}

function isTokenIssuedForConfiguredClient(claims: JwtPayload) {
  if (claims.azp === config.KEYCLOAK_CLIENT_ID) return true;
  if (claims.aud === config.KEYCLOAK_CLIENT_ID) return true;
  if (Array.isArray(claims.aud) && claims.aud.includes(config.KEYCLOAK_CLIENT_ID)) return true;
  return Boolean(claims.resource_access?.[config.KEYCLOAK_CLIENT_ID]);
}

function extractRoles(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const roles = (value as { roles?: unknown }).roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
}

function allowedRedirectOrigins(requestOrigin?: string | null): string[] {
  const configured = splitCsv(config.KEYCLOAK_ALLOWED_REDIRECT_ORIGINS)
    .filter((origin) => !origin.includes('*') && !origin.includes('trycloudflare.com'));
  const defaults = [
    'http://localhost',
    'http://localhost:80',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    'http://127.0.0.1:3000',
  ];
  return unique([...configured, ...defaults].filter(Boolean) as string[]);
}

function allowedKeycloakIssuers(requestOrigin?: string | null): string[] {
  const realmPath = `/realms/${encodeURIComponent(config.KEYCLOAK_REALM)}`;
  const configuredIssuer = config.KEYCLOAK_ISSUER_URL ? trimTrailingSlash(config.KEYCLOAK_ISSUER_URL) : null;
  const issuers = [
    configuredIssuer,
    keycloakInternalIssuer(),
    joinUrl('http://localhost:8080/auth', realmPath),
    joinUrl('http://localhost:8080', realmPath),
    config.KEYCLOAK_PUBLIC_URL ? joinUrl(config.KEYCLOAK_PUBLIC_URL, realmPath) : null,
    requestOrigin ? joinUrl(`${trimTrailingSlash(requestOrigin)}/auth`, realmPath) : null,
    requestOrigin ? joinUrl(requestOrigin, realmPath) : null,
  ];
  return unique(issuers.filter(Boolean).map((issuer) => trimTrailingSlash(issuer as string)));
}

function originMatchesAllowed(origin: string, allowed: string) {
  const normalizedAllowed = trimTrailingSlash(allowed);
  if (!normalizedAllowed.includes('*')) return origin === normalizedAllowed;

  const allowedUrl = new URL(normalizedAllowed.replace('*.', 'wildcard.'));
  const originUrl = new URL(origin);
  const wildcardSuffix = allowedUrl.hostname.replace('wildcard.', '.');
  return originUrl.protocol === allowedUrl.protocol && originUrl.hostname.endsWith(wildcardSuffix);
}

function bearerToken(authorizationHeader?: string | null) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function splitCsv(value?: string | null) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstHeader(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

function schemeFromCloudflareVisitor(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { scheme?: unknown };
    return parsed.scheme === 'http' || parsed.scheme === 'https' ? parsed.scheme : null;
  } catch {
    return null;
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function joinUrl(base: string, path: string) {
  return `${trimTrailingSlash(base)}${path.startsWith('/') ? path : `/${path}`}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function base64Url(buffer: Buffer) {
  return buffer.toString('base64url');
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
