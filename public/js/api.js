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

  register(username, password, password2, email, role, inviteCode, verifyCode) {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, password2, email, role, inviteCode, verifyCode }) });
  },

  sendVerifyCode(email) {
    return request('/api/verify/send-code', { method: 'POST', body: JSON.stringify({ email }) });
  },

  // Password
  forgotPassword(email) {
    return request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },

  resetPassword(token, password, password2) {
    return request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password, password2 }) });
  },

  changePassword(oldPassword, newPassword, newPassword2) {
    return request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword, newPassword2 }) });
  },

  updateProfile(data) {
    return request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
  },

  // Comments
  getComments(articleId) {
    return request(`/api/articles/${articleId}/comments`);
  },
  addComment(articleId, content) {
    return request(`/api/articles/${articleId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
  },
  deleteComment(articleId, commentId) {
    return request(`/api/articles/${articleId}/comments/${commentId}`, { method: 'DELETE' });
  },

  // Favorites
  toggleFavorite(articleId) {
    return request(`/api/articles/${articleId}/favorite`, { method: 'POST' });
  },
  checkFavorite(articleId) {
    return request(`/api/articles/${articleId}/favorite`);
  },
  getFavorites() {
    return request('/api/user/favorites');
  },

  // Likes
  toggleLike(slug) {
    return request(`/article/${slug}/like`, { method: 'POST' });
  },

  // Related
  getRelated(articleId) {
    return request(`/api/articles/${articleId}/related`);
  },

  // Dashboard
  getDashboard() {
    return request('/api/dashboard');
  },

  // Upload
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    const res = await fetch('/api/upload', { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
  getArticles(tag, page, limit) {
    const params = new URLSearchParams();
    if (tag && tag !== '全部') params.set('tag', tag);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    return request(`/api/articles${qs ? '?' + qs : ''}`);
  },

  getArticle(id) {
    return request(`/api/articles/${id}`);
  },

  getArticleBySlug(slug) {
    return request(`/article/${slug}`);
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
