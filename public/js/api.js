/* ===========================
   API 客户端 - 封装所有后端请求
   支持 JWT Token 自动附加
   =========================== */

const BASE = '';

let authToken = localStorage.getItem('neon_blog_token') || null;

export function getToken() {
  return authToken;
}

export function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('neon_blog_token', token);
  } else {
    localStorage.removeItem('neon_blog_token');
  }
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(BASE + url, {
    headers,
    ...options,
    body: options.body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    const error = new Error(err.error || 'Request failed');
    error.status = res.status;
    error.vipOnly = err.vipOnly;
    throw error;
  }
  return res.json();
}

export const api = {
  // Auth
  login(username, password) {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  register(username, password, role, inviteCode) {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, role, inviteCode }) });
  },

  createAdmin(username, password) {
    return request('/api/auth/create-admin', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  getMe() {
    return request('/api/auth/me');
  },

  getUsers() {
    return request('/api/auth/users');
  },

  // Articles
  getArticles(tag) {
    const params = tag && tag !== '全部' ? `?tag=${encodeURIComponent(tag)}` : '';
    return request(`/api/articles${params}`);
  },

  getArticle(id) {
    return request(`/api/articles/${id}`);
  },

  createArticle(data) {
    return request('/api/articles', { method: 'POST', body: JSON.stringify(data) });
  },

  updateArticle(id, data) {
    return request(`/api/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteArticle(id) {
    return request(`/api/articles/${id}`, { method: 'DELETE' });
  },

  // Review
  getPendingArticles() {
    return request('/api/articles/review/pending');
  },

  approveArticle(id) {
    return request(`/api/articles/review/${id}/approve`, { method: 'POST' });
  },

  rejectArticle(id) {
    return request(`/api/articles/review/${id}/reject`, { method: 'POST' });
  },

  // Projects
  getProjects() {
    return request('/api/projects');
  },

  getProject(id) {
    return request(`/api/projects/${id}`);
  },

  createProject(data) {
    return request('/api/projects', { method: 'POST', body: JSON.stringify(data) });
  },

  updateProject(id, data) {
    return request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteProject(id) {
    return request(`/api/projects/${id}`, { method: 'DELETE' });
  },

  // Tags
  getTags() {
    return request('/api/tags');
  },

  // Search
  search(query) {
    return request(`/api/search?q=${encodeURIComponent(query)}`);
  },

  // Invite codes
  getInvites() {
    return request('/api/invites');
  },

  createInvites(count, prefix) {
    return request('/api/invites', { method: 'POST', body: JSON.stringify({ count, prefix }) });
  },

  deleteInvite(id) {
    return request(`/api/invites/${id}`, { method: 'DELETE' });
  },
};
