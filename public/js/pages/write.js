/* ===========================
    写文章页 (Markdown编辑器 + 草稿保存 + 工具栏)
    =========================== */

import { api } from '../api.js';

const DRAFT_KEY = 'neon_blog_draft';
let draftTimer = null;

export function renderWrite(onSuccess) {
  const main = document.getElementById('mainContent');
  const draft = loadDraft();

  main.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">// 写文章</h1>
      <p class="page-subtitle">提交后需管理员审核通过才会展示 | <span id="draftStatus" style="color:var(--neon-green);display:none;">草稿已保存</span>
        <button class="admin-btn-sm" id="clearDraftBtn" style="margin-left:8px;display:none;">清除草稿</button>
      </p>
    </div>
    <div class="auth-card" style="max-width:800px;margin:0 auto;">
      <div class="admin-form-group">
        <label>标题</label>
        <input type="text" id="wfTitle" placeholder="输入文章标题" value="${escapeAttr(draft.title || '')}" class="admin-form-group input">
      </div>
      <div class="admin-form-group">
        <label>摘要</label>
        <textarea id="wfExcerpt" rows="2" placeholder="简短摘要">${escapeHtml(draft.excerpt || '')}</textarea>
      </div>
      <div class="admin-form-group">
        <label>分类</label>
        <input type="text" id="wfCategory" placeholder="如: 技术教程、生活随笔" value="${escapeAttr(draft.category || '')}" style="max-width:300px">
      </div>
      <div class="admin-form-group">
        <label>正文 (Markdown)</label>
        <div class="md-toolbar">
          <button type="button" class="md-btn" data-md="**text**" title="粗体">B</button>
          <button type="button" class="md-btn" data-md="*text*" title="斜体">I</button>
          <button type="button" class="md-btn" data-md="## text" title="标题">H</button>
          <button type="button" class="md-btn" data-md="- text" title="列表">-</button>
          <button type="button" class="md-btn" data-md="\`code\`" title="行内代码">&lt;/&gt;</button>
          <button type="button" class="md-btn" data-md="> text" title="引用">❝</button>
          <button type="button" class="md-btn" data-md="[text](url)" title="链接">🔗</button>
          <button type="button" class="md-btn" data-md="---\n" title="分隔线">―</button>
        </div>
        <textarea id="wfContentMd" rows="14" placeholder="支持 Markdown：## 标题  **加粗**  - 列表  \`代码\`">${draft.content_md || ''}</textarea>
        <div style="margin-top:6px;display:flex;gap:8px;">
          <button type="button" class="admin-btn-sm" id="wfPreviewBtn">👁 预览</button>
          <div id="previewHint" style="display:none;font-family:var(--font-mono);font-size:0.72rem;color:var(--neon-magenta);line-height:2;"></div>
        </div>
        <div id="wfPreview" style="display:none;margin-top:8px;padding:16px;background:rgba(0,0,0,0.2);border:1px solid rgba(0,255,255,0.2);border-radius:4px;max-height:400px;overflow-y:auto;color:var(--text-primary);font-size:0.9rem;line-height:1.7;"></div>
      </div>
      <div class="admin-form-group">
        <label>标签 (逗号分隔)</label>
        <input type="text" id="wfTags" placeholder="如: 前端, JavaScript, 教程" value="${(draft.tags || []).join(', ')}">
      </div>
      <div class="admin-form-group">
        <label>图标 (Emoji)</label>
        <input type="text" id="wfIcon" value="${draft.icon || '📝'}" placeholder="如: 📝" style="max-width:100px">
      </div>
      <div class="auth-error" id="wfError" style="display:none"></div>
      <div class="admin-form-actions">
        <button class="admin-btn" id="wfCancel">取消</button>
        <button class="admin-btn submit" id="wfSubmit">提交审核</button>
      </div>
    </div>
  `;

  // Restore draft hint
  if (draft.title || draft.content_md) {
    document.getElementById('clearDraftBtn').style.display = 'inline';
    const status = document.getElementById('draftStatus');
    status.textContent = '已恢复草稿';
    status.style.display = 'inline';
  }

  // ====== Markdown Toolbar ======
  const mdTextarea = document.getElementById('wfContentMd');
  document.querySelectorAll('.md-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const template = btn.dataset.md;
      const start = mdTextarea.selectionStart;
      const end = mdTextarea.selectionEnd;
      const selected = mdTextarea.value.substring(start, end) || 'text';
      let replacement = '';

      if (template === '**text**') replacement = `**${selected}**`;
      else if (template === '*text*') replacement = `*${selected}*`;
      else if (template === '## text') replacement = `## ${selected}`;
      else if (template === '- text') replacement = `- ${selected}`;
      else if (template === '`code`') replacement = `\`${selected}\``;
      else if (template === '> text') replacement = `> ${selected}`;
      else if (template === '[text](url)') {
        replacement = `[${selected}](url)`;
        // Position cursor inside the URL
        const pos = start + selected.length + 3;
        setTimeout(() => { mdTextarea.focus(); mdTextarea.setSelectionRange(pos, pos + 3); }, 0);
      } else if (template === '---\n') replacement = `---\n${selected}`;

      if (replacement) {
        mdTextarea.value = mdTextarea.value.substring(0, start) + replacement + mdTextarea.value.substring(end);
        const newPos = start + replacement.length;
        setTimeout(() => { mdTextarea.focus(); if (!template.includes('url')) mdTextarea.setSelectionRange(start + (replacement.indexOf(selected)), start + replacement.indexOf(selected) + selected.length); }, 0);
      }
    });
  });

  // ====== Markdown Preview ======
  const previewBtn = document.getElementById('wfPreviewBtn');
  const preview = document.getElementById('wfPreview');
  const previewHint = document.getElementById('previewHint');
  previewBtn.addEventListener('click', () => {
    if (preview.style.display === 'block') {
      preview.style.display = 'none';
      previewBtn.textContent = '👁 预览';
      previewHint.style.display = 'none';
      return;
    }
    const md = mdTextarea.value.trim();
    if (!md) { preview.innerHTML = '<span style="color:var(--text-dim)">无内容</span>'; preview.style.display = 'block'; previewHint.style.display = 'block'; previewHint.textContent = '按 Esc 关闭预览'; return; }
    if (typeof marked !== 'undefined' && marked.parse) {
      preview.innerHTML = marked.parse(md);
    } else {
      preview.innerHTML = `<pre style="white-space:pre-wrap;font-family:var(--font-mono);">${escapeHtml(md)}</pre>`;
    }
    preview.style.display = 'block';
    previewBtn.textContent = '✏ 编辑';
    previewHint.style.display = 'block';
    previewHint.textContent = '按 Esc 关闭预览 | 滚动查看';
  });

  // Esc to close preview
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape' && preview.style.display === 'block') {
      preview.style.display = 'none';
      previewBtn.textContent = '👁 预览';
      previewHint.style.display = 'none';
    }
  });

  // ====== Auto-save draft ======
  function saveDraftNow() {
    const d = {
      title: document.getElementById('wfTitle').value,
      excerpt: document.getElementById('wfExcerpt').value,
      content_md: document.getElementById('wfContentMd').value,
      category: document.getElementById('wfCategory').value,
      tags: (document.getElementById('wfTags').value || '').split(',').map(t => t.trim()).filter(Boolean),
      icon: document.getElementById('wfIcon').value,
    };
    if (d.title || d.excerpt || d.content_md) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      const status = document.getElementById('draftStatus');
      status.textContent = '草稿已保存 ' + new Date().toLocaleTimeString();
      status.style.display = 'inline';
      document.getElementById('clearDraftBtn').style.display = 'inline';
    }
  }

  // Auto-save every 5s
  draftTimer = setInterval(saveDraftNow, 5000);
  // Save on input
  document.getElementById('wfTitle').addEventListener('input', saveDraftNow);
  document.getElementById('wfContentMd').addEventListener('input', saveDraftNow);
  document.getElementById('wfExcerpt').addEventListener('input', saveDraftNow);

  // Clear draft
  document.getElementById('clearDraftBtn').addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById('wfTitle').value = '';
    document.getElementById('wfExcerpt').value = '';
    document.getElementById('wfContentMd').value = '';
    document.getElementById('wfCategory').value = '';
    document.getElementById('wfTags').value = '';
    document.getElementById('wfIcon').value = '📝';
    document.getElementById('draftStatus').style.display = 'none';
    document.getElementById('clearDraftBtn').style.display = 'none';
    showToast('草稿已清除', 'info');
  });

  // ====== Cancel ======
  document.getElementById('wfCancel').addEventListener('click', () => {
    window.location.hash = '#home';
  });

  // ====== Submit ======
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
        category: document.getElementById('wfCategory').value.trim(),
        tags: (document.getElementById('wfTags').value || '').split(',').map(t => t.trim()).filter(Boolean),
        icon: document.getElementById('wfIcon').value.trim() || '📝',
        visibility: 'public',
      });
      // Clear draft on success
      clearInterval(draftTimer);
      localStorage.removeItem(DRAFT_KEY);
      showToast('文章已提交，等待管理员审核', 'info');
      if (onSuccess) onSuccess();
      window.location.hash = '#home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  // Focus on first empty field
  setTimeout(() => {
    if (!draft.title) document.getElementById('wfTitle').focus();
    else document.getElementById('wfContentMd').focus();
  }, 100);
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  } catch { return {}; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
