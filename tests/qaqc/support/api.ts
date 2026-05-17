import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { demoUsers, type DemoRole } from './app';

type RequestOptions = {
  data?: unknown;
  headers?: Record<string, string>;
  multipart?: Record<string, unknown>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
};

export type QaRole = DemoRole;

export type AuthSession = {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: QaRole;
    fullName: string;
  };
  api: AuthedApi;
};

export class AuthedApi {
  constructor(
    private readonly request: APIRequestContext,
    readonly token: string,
  ) {}

  get(path: string, options: RequestOptions = {}) {
    return this.request.get(path, this.withAuth(options));
  }

  post(path: string, options: RequestOptions = {}) {
    return this.request.post(path, this.withAuth(options));
  }

  patch(path: string, options: RequestOptions = {}) {
    return this.request.patch(path, this.withAuth(options));
  }

  delete(path: string, options: RequestOptions = {}) {
    return this.request.delete(path, this.withAuth(options));
  }

  async getJson<T = any>(path: string, options: RequestOptions = {}) {
    return expectJson<T>(await this.get(path, options));
  }

  async postJson<T = any>(path: string, data?: unknown, options: RequestOptions = {}) {
    return expectJson<T>(await this.post(path, { ...options, data }));
  }

  async patchJson<T = any>(path: string, data?: unknown, options: RequestOptions = {}) {
    return expectJson<T>(await this.patch(path, { ...options, data }));
  }

  async deleteJson<T = any>(path: string, options: RequestOptions = {}) {
    return expectJson<T>(await this.delete(path, options));
  }

  private withAuth(options: RequestOptions) {
    return {
      ...options,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(options.headers || {}),
      },
    };
  }
}

export function uniqueRunId(prefix = 'qaqc') {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${random}`;
}

export function visibleRunSuffix(runId: string) {
  const parts = runId.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const randomPart = parts.length > 0 ? parts[parts.length - 1] : runId;
  const timestamp = parts.length > 1 ? Number(parts[parts.length - 2]) : NaN;
  const timePart = Number.isFinite(timestamp) ? Math.trunc(timestamp).toString(36).slice(-2) : '';
  return `${timePart}${randomPart}`.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'RUN';
}

export async function expectJson<T = any>(response: APIResponse, expectedStatus?: number) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  const statusMessage = `${response.url()} returned ${response.status()}: ${text}`;

  if (expectedStatus !== undefined) {
    expect(response.status(), statusMessage).toBe(expectedStatus);
  } else {
    expect(response.ok(), statusMessage).toBeTruthy();
  }

  return body as T;
}

export async function loginAsDemo(request: APIRequestContext, role: QaRole) {
  if (role === 'admin' && process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD) {
    return loginAs(request, process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
  }

  const demo = demoUsers[role];
  return loginAs(request, demo.email, demo.password);
}

export async function loginAs(request: APIRequestContext, email: string, password: string) {
  const body = await expectJson<{
    token: string;
    refreshToken: string;
    user: AuthSession['user'];
  }>(await request.post('/api/auth/login', {
    data: { email, password, deviceId: `tablet-sekolah-${uniqueRunId('device')}` },
  }));

  return {
    token: body.token,
    refreshToken: body.refreshToken,
    user: body.user,
    api: new AuthedApi(request, body.token),
  } satisfies AuthSession;
}

export async function createUserAndLogin(
  request: APIRequestContext,
  admin: AuthedApi,
  input: {
    role: QaRole;
    email: string;
    fullName: string;
    password?: string;
  },
) {
  const password = input.password || 'password123';
  await admin.postJson('/api/admin/users', {
    email: input.email,
    password,
    role: input.role,
    fullName: input.fullName,
  });

  return loginAs(request, input.email, password);
}

export async function createQaActors(request: APIRequestContext, runId = uniqueRunId()) {
  const admin = await loginAsDemo(request, 'admin');
  const suffix = visibleRunSuffix(runId);
  const teacher = await createUserAndLogin(request, admin.api, {
    role: 'teacher',
    email: `teacher.${runId}@tusyen.test`,
    fullName: `Cikgu Hana Rahman ${suffix}`,
  });
  const student = await createUserAndLogin(request, admin.api, {
    role: 'student',
    email: `student.${runId}@tusyen.test`,
    fullName: `Nur Iman Razak ${suffix}`,
  });
  const parent = await createUserAndLogin(request, admin.api, {
    role: 'parent',
    email: `parent.${runId}@tusyen.test`,
    fullName: `Puan Laila Ismail ${suffix}`,
  });

  return { runId, admin, teacher, student, parent };
}

export async function uploadSmallFile(
  api: AuthedApi,
  input: {
    name: string;
    mimeType: string;
    content: Buffer | string;
    bucket?: 'media' | 'whiteboard';
  },
) {
  const content = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content);
  return expectJson<{
    success: boolean;
    id: string;
    fileId: string;
    objectName: string;
    url: string;
    mimeType: string;
    size: number;
  }>(await api.post('/api/storage/upload', {
    multipart: {
      bucket: input.bucket || 'media',
      file: {
        name: input.name,
        mimeType: input.mimeType,
        buffer: content,
      },
    },
  }));
}
