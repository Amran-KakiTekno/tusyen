// Tusyen — auth + API client for the v2 prototype shell.
// Exposes window.tusyenApi used by the React app in index.html.

const API_BASE = `${window.location.origin}/api`;
const TOKEN_KEY = 'tusyen_token';
const USER_KEY  = 'tusyen_user';

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with ${response.status}`);
  }
  return data;
}

const tusyenApi = {
  async health()      { return request('/health'); },
  async myProfile()   { return request('/profile/me'); },
  async adminStats()  { return request('/admin/stats'); },
  async classrooms()  { return request('/classroom'); },
  async linkedStudents() { return request('/auth/linked-students'); },
  async assignedLessons() { return request('/learning/lessons'); },
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
  async createPost({ classroomId, content, postType = 'announcement', title }) {
    return request('/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ classroomId, content, postType, title }),
    });
  },
  async adminUsers({ role, isActive, limit = 100 } = {}) {
    const qs = new URLSearchParams();
    if (role) qs.set('role', role);
    if (isActive !== undefined) qs.set('isActive', String(isActive));
    qs.set('limit', String(limit));
    return request(`/admin/users?${qs}`);
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
  async studentStats(studentId) {
    return request(`/progress/student/${studentId}/stats`);
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
  async syllabus(subject, formLevel) {
    const qs = new URLSearchParams();
    if (subject) qs.set('subject', subject);
    if (formLevel) qs.set('formLevel', String(formLevel));
    return request(`/learning/syllabus${qs.toString() ? '?' + qs : ''}`);
  },
  async classroomStudents(classroomId) {
    return request(`/classroom/${classroomId}/students`);
  },
  async classroomAnalytics(classroomId) {
    return request(`/classroom/${classroomId}/analytics`);
  },
  async adminHealth() { return request('/admin/health'); },
  async feedPosts({ classroomId, limit = 20 } = {}) {
    const qs = new URLSearchParams();
    if (classroomId) qs.set('classroomId', classroomId);
    qs.set('limit', String(limit));
    return request(`/feed/posts?${qs}`);
  },
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceId: 'web-app-v2' }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async register({ fullName, email, password, role }) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, role }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  restoreSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
    try { return { token, user: JSON.parse(userStr) }; }
    catch { return null; }
  },
};

window.tusyenApi = tusyenApi;
