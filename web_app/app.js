// Tusyen — auth + API client.
// Exposes window.tusyenApi used by the React app in index.html.

const API_BASE = `${window.location.origin}/api`;
const TOKEN_KEY = 'tusyen_token';
const REFRESH_KEY = 'tusyen_refresh_token';
const USER_KEY  = 'tusyen_user';
const TOKEN_SAVED_AT_KEY = 'tusyen_token_saved_at';
const TOKEN_REFRESH_FOCUS_AGE_MS = 45 * 60 * 1000;
const KEYCLOAK_CALLBACK_PATH = '/keycloak-callback';
let _refreshPromise = null;

async function request(path, options = {}, retryOnUnauthorized = true) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  if (options.body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (response.status === 401 && retryOnUnauthorized) {
    try {
      await refreshAccessToken();
    } catch (_err) {
      clearStoredSession();
      throw new Error('Session expired. Please log in again.');
    }
    return request(path, options, false);
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with ${response.status}`);
  }
  return data;
}

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefreshAccessToken().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

async function _doRefreshAccessToken() {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: localStorage.getItem(REFRESH_KEY) || undefined }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    clearStoredSession();
    throw new Error(data.error || 'Session expired');
  }
  persistAuthTokens(data);
  return data.token;
}

function persistAuthTokens(data = {}) {
  const accessToken = data.token || data.accessToken;
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(TOKEN_SAVED_AT_KEY, String(Date.now()));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_SAVED_AT_KEY);
  }
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_SAVED_AT_KEY);
}

function readJwtPayload(token) {
  try {
    const [, payload] = `${token || ''}`.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function accessTokenAgeMs(token = localStorage.getItem(TOKEN_KEY)) {
  if (!token) return 0;
  const issuedAt = Number(readJwtPayload(token)?.iat || 0) * 1000;
  const savedAt = Number(localStorage.getItem(TOKEN_SAVED_AT_KEY) || 0);
  const baseline = issuedAt || savedAt;
  return baseline ? Math.max(0, Date.now() - baseline) : 0;
}

function setupTokenRefreshOnVisibility() {
  if (setupTokenRefreshOnVisibility.ready || typeof document === 'undefined') return;
  setupTokenRefreshOnVisibility.ready = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!localStorage.getItem(TOKEN_KEY)) return;
    if (accessTokenAgeMs() <= TOKEN_REFRESH_FOCUS_AGE_MS) return;
    refreshAccessToken().catch(() => undefined);
  });
}

function appBasePathFromScript() {
  const scriptSrc = document.currentScript?.getAttribute('src') || '';
  try {
    const scriptUrl = new URL(scriptSrc, window.location.href);
    const marker = '/dist/app.bundle.js';
    const index = scriptUrl.pathname.indexOf(marker);
    if (index >= 0) return scriptUrl.pathname.slice(0, index + 1) || '/';
  } catch {}
  const path = window.location.pathname || '/';
  const cleanPath = path.replace(/\/+$/, '');
  if (cleanPath.endsWith(KEYCLOAK_CALLBACK_PATH)) {
    const base = cleanPath.slice(0, -KEYCLOAK_CALLBACK_PATH.length) || '/';
    return base.endsWith('/') ? base : `${base}/`;
  }
  return '/';
}

function safeSameOriginPath(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    if (url.pathname.replace(/\/+$/, '').endsWith(KEYCLOAK_CALLBACK_PATH)) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function postAuthRedirectPath(data = {}) {
  const explicit = safeSameOriginPath(data.redirectTo || data.redirectUrl || data.next);
  if (explicit) return explicit;
  const role = `${data.user?.role || data.role || ''}`.toLowerCase();
  const url = new URL(appBasePathFromScript(), window.location.origin);
  if (role) url.searchParams.set('role', role);
  return `${url.pathname}${url.search}${url.hash}`;
}

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderKeycloakCallbackStatus(message, tone = 'info') {
  const root = document.getElementById('root');
  if (!root) return;
  const color = tone === 'error' ? '#EF4444' : '#7C3AED';
  const homePath = escapeHtml(appBasePathFromScript());
  root.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#f8fafc;font-family:Nunito,Arial,sans-serif;padding:24px;">
      <section role="${tone === 'error' ? 'alert' : 'status'}" style="width:min(420px,100%);border:1px solid rgba(255,255,255,.14);border-radius:24px;background:rgba(15,23,42,.88);padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.28);">
        <div style="width:48px;height:48px;border-radius:16px;background:${color};display:grid;place-items:center;font-weight:900;margin-bottom:16px;">T</div>
        <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;">Keycloak sign-in</h1>
        <p style="font-size:14px;line-height:1.55;margin:0;color:#cbd5e1;">${escapeHtml(message)}</p>
        ${tone === 'error' ? `<a href="${homePath}" style="display:inline-flex;margin-top:18px;color:#fff;font-weight:800;">Back to Tusyen</a>` : ''}
      </section>
    </main>
  `;
}

async function handleKeycloakCallbackIfNeeded() {
  const cleanPath = (window.location.pathname || '').replace(/\/+$/, '');
  if (!cleanPath.endsWith(KEYCLOAK_CALLBACK_PATH)) return false;
  window.__tusyenKeycloakCallbackPending = true;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    renderKeycloakCallbackStatus('Missing Keycloak callback code or state. Please start sign-in again.', 'error');
    return true;
  }

  renderKeycloakCallbackStatus('Finishing secure sign-in and opening your dashboard...');
  try {
    const data = await request('/auth/keycloak/callback', {
      method: 'POST',
      body: JSON.stringify({
        code,
        state,
        redirectUri: `${window.location.origin}${window.location.pathname}`,
      }),
    }, false);
    persistAuthTokens(data);
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.tusyenUser = data.user;
    }
    window.location.replace(postAuthRedirectPath(data));
  } catch (err) {
    clearStoredSession();
    renderKeycloakCallbackStatus(err?.message || 'Keycloak sign-in could not be completed. Please try again.', 'error');
  }
  return true;
}

const tusyenApi = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  async health()      { return request('/health'); },
  async myProfile()   { return request('/profile/me'); },
  async adminStats()  { return request('/admin/stats'); },
  async classrooms()  { return request('/classroom'); },
  async createClassroom({ name, subject, formLevel, description, isPublic = false }) {
    return request('/classroom', {
      method: 'POST',
      body: JSON.stringify({ name, subject, formLevel, description, isPublic }),
    });
  },
  async updateClassroom(id, body) {
    return request(`/classroom/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async archiveClassroom(id) {
    return request(`/classroom/${id}`, { method: 'DELETE' });
  },
  async linkedStudents() { return request('/auth/linked-students'); },
  async linkParent(studentIdentifier) {
    return request('/auth/link-parent', {
      method: 'POST',
      body: JSON.stringify({ studentIdentifier }),
    });
  },
  async unlinkStudent(studentId) {
    return request(`/auth/linked-students/${studentId}`, {
      method: 'DELETE',
    });
  },
  async changePassword({ currentPassword, newPassword }) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  async assignedLessons({ classroomId, subject, formLevel } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    return request(`/learning/lessons${qs.toString() ? '?' + qs : ''}`);
  },
  async lessonDetail(id, { classroomId } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    return request(`/learning/lessons/${id}${qs.toString() ? '?' + qs : ''}`);
  },
  async submitLesson(id, body) {
    return request(`/learning/lessons/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async catalogLessons({ subject, formLevel, difficulty, search, limit = 100, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    if (difficulty) qs.set('difficulty', difficulty);
    if (search) qs.set('search', search);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return request(`/learning/catalog${qs.toString() ? '?' + qs : ''}`);
  },
  async createPost({ classroomId, content, postType = 'announcement', title, attachments, isPinned }) {
    return request('/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ classroomId, content, postType, title, attachments, isPinned }),
    });
  },
  async updateTeacherProfile(body) {
    return request('/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async adminUsers({ role, isActive, search, limit = 100, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (role) qs.set('role', role);
    if (isActive !== undefined) qs.set('isActive', String(isActive));
    if (search) qs.set('search', search);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return request(`/admin/users?${qs}`);
  },
  async adminUser(id) {
    return request(`/admin/users/${id}`);
  },
  async createAdminUser(body) {
    return request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async updateUser(id, body) {
    return request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async toggleUserStatus(id, isActive) {
    return request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
  async updateUserStatuses(userIds, isActive) {
    return request('/admin/users/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({ userIds, isActive }),
    });
  },
  async studentStats(studentId) {
    return request(`/progress/student/${studentId}/stats`);
  },
  async studentHearts(studentId) {
    return request(`/progress/student/${studentId}/hearts`);
  },
  async checkStreak() {
    return request('/progress/streak/check', { method: 'POST' });
  },
  async studentProgress(studentId, { classroomId } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    return request(`/progress/student/${studentId}${qs.toString() ? '?' + qs : ''}`);
  },
  async classroomProgress(classroomId) {
    return request(`/progress/classroom/${classroomId}`);
  },
  async classroomLeaderboard(classroomId) {
    return request(`/progress/classroom/${classroomId}/leaderboard`);
  },
  async myAchievements() {
    return request('/progress/me/achievements');
  },
  async parentAlerts() {
    return request('/auth/parent/alerts');
  },
  async updateParentAlertStatus({ childId, alertId, read, dismissed, followUp }) {
    return request('/auth/parent/alerts/status', {
      method: 'PATCH',
      body: JSON.stringify({ childId, alertId, read, dismissed, followUp }),
    });
  },
  async updateParentAlertsStatus({ childId, alertIds, read, dismissed, followUp }) {
    return request('/auth/parent/alerts/status/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ childId, alertIds, read, dismissed, followUp }),
    });
  },
  async syllabus(subject, formLevel) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    return request(`/learning/syllabus${qs.toString() ? '?' + qs : ''}`);
  },
  async classroomStudents(classroomId) {
    return request(`/classroom/${classroomId}/students`);
  },
  async removeClassroomStudent(classroomId, studentId) {
    return request(`/classroom/${classroomId}/students/${studentId}`, {
      method: 'DELETE',
    });
  },
  async classroomAnalytics(classroomId) {
    return request(`/classroom/${classroomId}/analytics`);
  },
  async adminHealth() { return request('/admin/health'); },
  async adminLogs({ limit = 20, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return request(`/admin/logs?${qs}`);
  },
  async adminSystem() { return request('/admin/system'); },
  async clearAdminCache() {
    return request('/admin/cache/clear', { method: 'POST' });
  },
  async testAdminNotification(body = {}) {
    return request('/admin/notifications/test', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async adminSyllabus({ subject, formLevel } = {}) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    return request(`/admin/syllabus${qs.toString() ? '?' + qs : ''}`);
  },
  async createSyllabusItem(body) {
    return request('/admin/syllabus', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async updateSyllabusItem(id, body) {
    return request(`/admin/syllabus/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async deleteSyllabusItem(id) {
    return request(`/admin/syllabus/${id}`, { method: 'DELETE' });
  },
  async adminLessons({ subject, formLevel, difficulty, limit = 25, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    if (difficulty) qs.set('difficulty', difficulty);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return request(`/admin/lessons?${qs}`);
  },
  async createAdminLesson(body) {
    return request('/admin/lessons', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async deleteAdminLesson(id) {
    return request(`/admin/lessons/${id}`, { method: 'DELETE' });
  },
  async feedPosts({ classroomId, limit = 20 } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    qs.set('limit', String(limit));
    return request(`/feed/posts?${qs}`);
  },
  async joinClassroom(classroomId, joinCode) {
    return request(`/classroom/${classroomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    });
  },
  async joinClassroomByCode(joinCode) {
    return request('/classroom/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    });
  },
  async leaveClassroom(classroomId) {
    return request(`/classroom/${classroomId}/leave`, { method: 'POST' });
  },
  async uploadMedia(file, { bucket = 'media' } = {}) {
    const form = new FormData();
    form.append('file', file);
    form.append('bucket', bucket);

    const upload = async (retryOnUnauthorized = true) => {
      const token = localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`${API_BASE}/storage/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (response.status === 401 && retryOnUnauthorized) {
        await refreshAccessToken();
        return upload(false);
      }
      if (!response.ok) {
        throw new Error(data.error || data.message || `Upload failed with ${response.status}`);
      }
      return data;
    };

    return upload();
  },
  async updateCurrentUserProfile({ fullName, avatarUrl }) {
    const user = tusyenApi.restoreSession()?.user;
    if (!user?.id) throw new Error('Session profile is unavailable');
    return request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'web-app',
        operations: [{
          id: `profile-${Date.now()}`,
          type: 'UPDATE',
          table: 'users',
          data: {
            id: user.id,
            full_name: fullName,
            avatar_url: avatarUrl,
          },
        }],
      }),
    });
  },
  async quizDecks({ classroomId } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    return request(`/quiz/decks${qs.toString() ? '?' + qs : ''}`);
  },
  async quizDeck(id) {
    return request(`/quiz/decks/${id}`);
  },
  async createQuizDeck(body) {
    return request('/quiz/decks', { method: 'POST', body: JSON.stringify(body) });
  },
  async updateQuizDeck(id, body) {
    return request(`/quiz/decks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  async deleteQuizDeck(id) {
    return request(`/quiz/decks/${id}`, { method: 'DELETE' });
  },
  async createQuizSession({ classroomId, deckId }) {
    return request('/quiz/sessions', { method: 'POST', body: JSON.stringify({ classroomId, deckId }) });
  },
  async quizClassroomSessions(classroomId) {
    return request(`/quiz/classrooms/${classroomId}/sessions`);
  },
  async startQuizSession(id) {
    return request(`/quiz/sessions/${id}/start`, { method: 'POST' });
  },
  async advanceQuizSession(id) {
    return request(`/quiz/sessions/${id}/advance`, { method: 'POST' });
  },
  async endQuizSession(id) {
    return request(`/quiz/sessions/${id}/end`, { method: 'POST' });
  },
  async joinQuizByPin({ pin, nickname }) {
    return request('/quiz/join', { method: 'POST', body: JSON.stringify({ pin, nickname }) });
  },
  async submitQuizAnswer(sessionId, { participantToken, selectedOptionIndex, selectedAnswer } = {}) {
    const body = { participantToken };
    if (selectedOptionIndex !== undefined && selectedOptionIndex !== null) {
      body.selectedOptionIndex = selectedOptionIndex;
    } else {
      body.selectedAnswer = selectedAnswer;
    }
    return request(`/quiz/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async myQuizSummary() {
    return request('/quiz/me/summary');
  },
  async quizSessionReview(sessionId, participantToken) {
    return request(`/quiz/sessions/${sessionId}/review?participantToken=${encodeURIComponent(participantToken)}`);
  },
  async duplicateQuizDeck(id) {
    return request(`/quiz/decks/${id}/duplicate`, { method: 'POST' });
  },
  async updateQuizTimer(sessionId, body) {
    return request(`/quiz/sessions/${sessionId}/timer`, { method: 'POST', body: JSON.stringify(body) });
  },
  async quizSessionState(sessionId, { participantToken } = {}) {
    const qs = new URLSearchParams();
    if (participantToken) qs.set('participantToken', participantToken);
    return request(`/quiz/sessions/${sessionId}/state${qs.toString() ? '?' + qs : ''}`);
  },

  // Feed / Posts
  async updatePost(id, body) {
    return request(`/feed/posts/${id}`, { method:'PATCH', body:JSON.stringify(body) });
  },
  async deletePost(id) {
    return request(`/feed/posts/${id}`, { method:'DELETE' });
  },
  async postComments(postId) {
    return request(`/feed/posts/${postId}/comments`);
  },
  async addComment(postId, content) {
    return request(`/feed/posts/${postId}/comments`, { method:'POST', body:JSON.stringify({ content }) });
  },
  async deleteComment(postId, commentId) {
    return request(`/feed/posts/${postId}/comments/${commentId}`, { method:'DELETE' });
  },
  async toggleReaction(postId) {
    return request(`/feed/posts/${postId}/reaction`, { method:'POST' });
  },
  async reactPost(postId, emoji = 'like') {
    if (!postId) return { ok:false, status:400, error:'postId is required' };
    try {
      return await request(`/feed/posts/${postId}/reactions`, {
        method:'POST',
        body:JSON.stringify({ emoji }),
      });
    } catch (err) {
      return {
        ok:false,
        status:501,
        todo:true,
        error:err?.message || 'Post reactions endpoint is not available yet',
      };
    }
  },
  async pinPost(postId, isPinned) {
    return request(`/feed/posts/${postId}`, { method:'PATCH', body:JSON.stringify({ isPinned }) });
  },
  async teacherProfile(id) {
    return request(`/profile/teachers/${id}`);
  },

  // Teacher lesson authoring
  async lessonCatalog({ subject, formLevel, difficulty, search, limit = 30, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    if (difficulty) qs.set('difficulty', difficulty);
    if (search) qs.set('search', search);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return request(`/learning/catalog?${qs}`);
  },
  async lessonAuthoringDetail(id) {
    return request(`/learning/authoring/lessons/${id}`);
  },
  async createTeacherLesson(body) {
    return request('/learning/lessons', { method:'POST', body:JSON.stringify(body) });
  },
  async updateTeacherLesson(id, body) {
    return request(`/learning/lessons/${id}`, { method:'PATCH', body:JSON.stringify(body) });
  },
  async deleteTeacherLesson(id) {
    return request(`/learning/lessons/${id}`, { method:'DELETE' });
  },
  async assignLessonToClassroom(classroomId, lessonId, { dueDate, isRequired = true } = {}) {
    return request(`/classroom/${classroomId}/lessons`, {
      method:'POST',
      body:JSON.stringify({ lessonId, dueDate: dueDate || null, isRequired }),
    });
  },

  // Whiteboard
  async whiteboardSessions(classroomId) {
    return request(`/whiteboard/sessions/${classroomId}`);
  },
  async whiteboardActiveSession(classroomId) {
    return request(`/whiteboard/session/active/${classroomId}`);
  },
  async joinWhiteboardSession(id) {
    return request(`/whiteboard/session/${id}/join`, { method:'POST' });
  },
  async startWhiteboardSession(body) {
    return request('/whiteboard/session', { method:'POST', body:JSON.stringify(body) });
  },
  async endWhiteboardSession(id) {
    return request(`/whiteboard/session/${id}/end`, { method:'POST' });
  },
  async whiteboardSessionEvents(id) {
    return request(`/whiteboard/session/${id}/events`);
  },
  buildWhiteboardWsUrl(classroomId) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws/classroom/${classroomId}`;
  },
  buildClassroomWsUrl(classroomId) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws/classroom/${classroomId}`;
  },

  // Admin parent links
  async adminParentLinks({ parentId, studentId } = {}) {
    const qs = new URLSearchParams();
    if (parentId) qs.set('parentId', parentId);
    if (studentId) qs.set('studentId', studentId);
    return request(`/admin/parent-links${qs.toString() ? '?' + qs : ''}`);
  },
  async createAdminParentLink(parentId, studentId) {
    return request('/admin/parent-links', { method:'POST', body:JSON.stringify({ parentId, studentId }) });
  },
  async deleteAdminParentLink(id) {
    return request(`/admin/parent-links/${id}`, { method:'DELETE' });
  },

  // Admin classrooms
  async adminClassrooms({ search, teacherId, isActive } = {}) {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (teacherId) qs.set('teacherId', teacherId);
    if (isActive !== undefined) qs.set('isActive', String(isActive));
    return request(`/admin/classrooms${qs.toString() ? '?' + qs : ''}`);
  },
  async createAdminClassroom(body) {
    return request('/admin/classrooms', { method:'POST', body:JSON.stringify(body) });
  },
  async updateAdminClassroom(id, body) {
    return request(`/admin/classrooms/${id}`, { method:'PATCH', body:JSON.stringify(body) });
  },
  async toggleAdminClassroom(id, isActive) {
    return request(`/admin/classrooms/${id}`, { method:'PATCH', body:JSON.stringify({ isActive }) });
  },
  async adminClassroomStudents(classroomId) {
    return request(`/admin/classrooms/${classroomId}/students`);
  },
  async addStudentToAdminClassroom(classroomId, studentId) {
    return request(`/admin/classrooms/${classroomId}/students`, { method:'POST', body:JSON.stringify({ studentId }) });
  },
  async removeStudentFromAdminClassroom(classroomId, studentId) {
    return request(`/admin/classrooms/${classroomId}/students/${studentId}`, { method:'DELETE' });
  },
  async updateAdminLesson(id, body) {
    return request(`/admin/lessons/${id}`, { method:'PATCH', body:JSON.stringify(body) });
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceId: 'web-app' }),
    });
    persistAuthTokens(data);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async register({ fullName, email, password, role }) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, role }),
    });
    persistAuthTokens(data);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  signOut() {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(localStorage.getItem(TOKEN_KEY) ? { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: localStorage.getItem(REFRESH_KEY) || undefined }),
    }).catch(() => undefined);
    clearStoredSession();
  },
  restoreSession() {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try { return { user: JSON.parse(userStr) }; }
    catch { return null; }
  },
};

setupTokenRefreshOnVisibility();
window.tusyenApi = tusyenApi;
handleKeycloakCallbackIfNeeded();
