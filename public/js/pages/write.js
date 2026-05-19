/* ===========================
    写文章页 (所有登录用户可用)
    =========================== */

import { api } from '../api.js';

export function renderWrite(onSuccess) {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">// 写文章</h1>
      <p class="page-subtitle">提交后需管理员审核通过才会展示</p>
    </div>
    <div class="auth-card" style="max-width:800px;margin:0 auto;">
      <div class="admin-form-group">
        <label>标题</label>
        <input type="text" id="wfTitle" placeholder="输入文章标题" class="admin-form-group input">
      </div>
      <div class="admin-form-group">
        <label>摘要</label>
        <textarea id="wfExcerpt" rows="2" placeholder="简短摘要"></textarea>
      </div>
      <div class="admin-form-group">
        <label>正文 (Markdown)</label>
        <textarea id="wfContentMd" rows="12" placeholder="支持 Markdown：# 标题  **加粗**  - 列表"></textarea>
        <button type="button" class="admin-btn-sm" id="wfPreviewBtn" style="margin-top:6px;">👁 预览</button>
        <div id="wfPreview" style="display:none;margin-top:8px;padding:16px;background:rgba(0,0,0,0.2);border:1px solid rgba(0,255,255,0.2);border-radius:4px;max-height:400px;overflow-y:auto;color:var(--text-primary);font-size:0.9rem;line-height:1.7;"></div>
      </div>
      <div class="admin-form-group">
        <label>标签 (逗号分隔)</label>
        <input type="text" id="wfTags" placeholder="如: 前端, JavaScript, 教程">
      </div>
      <div class="admin-form-group">
        <label>图标 (Emoji)</label>
        <input type="text" id="wfIcon" value="📝" placeholder="如: 📝" style="max-width:100px">
      </div>
      <div class="auth-error" id="wfError" style="display:none"></div>
      <div class="admin-form-actions">
        <button class="admin-btn" id="wfCancel">取消</button>
        <button class="admin-btn submit" id="wfSubmit">提交审核</button>
      </div>
    </div>
  `;

  // Markdown preview
  const previewBtn = document.getElementById('wfPreviewBtn');
  const preview = document.getElementById('wfPreview');
  const mdText = document.getElementById('wfContentMd');
  previewBtn.addEventListener('click', () => {
    if (preview.style.display === 'block') {
      preview.style.display = 'none';
      previewBtn.textContent = '👁 预览';
      return;
    }
    const md = mdText.value.trim();
    if (!md) { preview.innerHTML = '<span style="color:var(--text-dim)">无内容</span>'; }
    else if (typeof marked !== 'undefined' && marked.parse) {
      preview.innerHTML = marked.parse(md);
    } else {
      preview.innerHTML = `<pre style="white-space:pre-wrap;font-family:var(--font-mono);">${escapeHtml(md)}</pre>`;
    }
    preview.style.display = 'block';
    previewBtn.textContent = '✏ 编辑';
  });

  document.getElementById('wfCancel').addEventListener('click', () => {
    window.location.hash = '#home';
  });

  document.getElementById('wfSubmit').addEventListener('click', async () => {
    const title = document.getElementById('wfTitle').value.trim();
    const excerpt = document.getElementById('wfExcerpt').value.trim();
    const content_md = document.getElementById('wfContentMd').value.trim();
    const errEl = document.getElementById('wfError');

    if (!title || !excerpt || !content_md) {
      errEl.textContent = '标题、摘要、正文不能为空';
      errEl.style.display = 'block';
      return;
    }

    try {
      await api.createArticle({
        title,
        excerpt,
        content_md,
        tags: (document.getElementById('wfTags').value || '').split(',').map(t => t.trim()).filter(Boolean),
        icon: document.getElementById('wfIcon').value.trim() || '📝',
        visibility: 'public',
      });
      showToast('文章已提交，等待管理员审核', 'info');
      if (onSuccess) onSuccess();
      window.location.hash = '#home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
