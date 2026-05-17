import { describe, expect, it } from 'vitest';
import {
  buildKeycloakAuthorizationUrl,
  roleFromKeycloakClaims,
  validateRedirectUriForRequest,
} from '../src/auth/keycloak';

describe('Keycloak auth helpers', () => {
  it('maps app roles from realm roles and defaults to student', () => {
    expect(roleFromKeycloakClaims({ realm_access: { roles: ['teacher'] } })).toBe('teacher');
    expect(roleFromKeycloakClaims({ realm_access: { roles: ['offline_access'] } })).toBe('student');
    expect(roleFromKeycloakClaims({ app_role: 'parent' })).toBe('parent');
  });

  it('allows exact configured/local callback URLs only', () => {
    expect(validateRedirectUriForRequest(
      'http://localhost/keycloak-callback',
      'http://localhost',
    )).toBe('http://localhost/keycloak-callback');

    expect(() => validateRedirectUriForRequest(
      'https://realistic-jersey-pierre-palace.trycloudflare.com/keycloak-callback',
      'https://realistic-jersey-pierre-palace.trycloudflare.com',
    )).toThrow(/not allowed/);

    expect(() => validateRedirectUriForRequest(
      'https://evil.test/keycloak-callback',
      'http://localhost',
    )).toThrow(/not allowed/);
  });

  it('builds authorization-code PKCE login URLs', () => {
    const url = new URL(buildKeycloakAuthorizationUrl({
      publicBaseUrl: 'http://localhost/auth',
      redirectUri: 'http://localhost/keycloak-callback',
      state: 'state-123',
      nonce: 'nonce-123',
      codeChallenge: 'challenge-123',
    }));

    expect(url.pathname).toBe('/auth/realms/eduapp/protocol/openid-connect/auth');
    expect(url.searchParams.get('client_id')).toBe('eduapp-api');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
  });
});
