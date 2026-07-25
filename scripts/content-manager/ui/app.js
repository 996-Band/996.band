const sectionMeta = {
  photos: { title: 'PHOTOS', listTitle: '相册列表', singular: '相册' },
  notices: { title: 'NOTICE', listTitle: '公告列表', singular: '公告' },
  articles: { title: 'ARTICLES', listTitle: '文章列表', singular: '文章' },
  albums: { title: 'ALBUMS', listTitle: '专辑与单曲', singular: '专辑' },
};

const supportedPhotoExtensions = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'heic', 'heif',
  'mp4', 'mov', 'm4v',
]);
const supportedImageExtensions = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'heic', 'heif',
]);
const fileExtension = (file) => file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
const isSupportedPhotoFile = (file) => {
  const relativePath = file.webkitRelativePath || file.name;
  const pathParts = relativePath.split('/');
  if (pathParts.some((part) => part.startsWith('.') || part.toLowerCase() === '__macosx')) return false;
  return supportedPhotoExtensions.has(fileExtension(file));
};

const elements = {
  list: document.querySelector('[data-list]'),
  editor: document.querySelector('[data-editor]'),
  pageTitle: document.querySelector('[data-page-title]'),
  listTitle: document.querySelector('[data-list-title]'),
  status: document.querySelector('[data-status]'),
  toast: document.querySelector('[data-toast]'),
  build: document.querySelector('[data-build]'),
  newButton: document.querySelector('[data-new]'),
  mediaMode: document.querySelector('[data-media-mode]'),
};

let content = { photos: [], notices: [], articles: [], albums: [] };
let mediaStatus = { mode: 'local', assetUrls: {} };
let section = 'photos';
let selectedSlug = '';
let creating = false;
let photoDraft = null;
let toastTimer = 0;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const formatDate = (value) => value ? String(value).slice(0, 10) : '';
const naturalCompare = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });
const clone = (value) => JSON.parse(JSON.stringify(value));
const displayAssetUrl = (value = '') => mediaStatus.assetUrls?.[value] || value;

const showToast = (message, error = false) => {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', error);
  elements.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2800);
};

const setStatus = (message, busy = false) => {
  elements.status.textContent = message;
  document.querySelector('.status-light').style.background = busy ? '#ffd84a' : '#49ff80';
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: options.body && typeof options.body === 'string'
      ? { 'content-type': 'application/json', ...(options.headers || {}) }
      : options.headers,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `请求失败 (${response.status})`);
  return result;
};

const refresh = async ({ keepSelection = true } = {}) => {
  setStatus('正在读取内容…', true);
  [content, mediaStatus] = await Promise.all([
    api('/api/content'),
    api('/api/media-status'),
  ]);
  const mediaModeLabel = mediaStatus.mode === 'cdn'
    ? `CDN · ${mediaStatus.totalAssets} ASSETS`
    : mediaStatus.ossConfigured
      ? `OSS READY · LOCAL VIEW`
      : 'LOCAL ASSETS';
  elements.mediaMode.querySelector('b').textContent = mediaModeLabel;
  elements.mediaMode.classList.toggle('is-cdn', mediaStatus.mode === 'cdn');
  elements.mediaMode.classList.toggle('is-pending', mediaStatus.mode !== 'cdn' && mediaStatus.ossConfigured);
  if (!keepSelection) selectedSlug = '';
  document.querySelectorAll('[data-count]').forEach((node) => {
    node.textContent = content[node.dataset.count]?.length || 0;
  });
  renderList();
  if (selectedSlug && !creating) {
    const item = content[section].find((entry) => entry.slug === selectedSlug);
    if (item) renderEditor(item);
  }
  setStatus('内容已同步');
};

const itemMeta = (item) => {
  if (section === 'photos') return `${formatDate(item.date) || '未填写日期'} · ${item.media.length} MEDIA`;
  if (section === 'notices') return `${formatDate(item.startAt)} · PRIORITY ${item.priority}`;
  if (section === 'articles') return `${formatDate(item.date)} · ${item.draft ? 'DRAFT' : 'PUBLISHED'}`;
  return `${item.type?.toUpperCase()} · PRIORITY ${item.priority}`;
};

const itemThumb = (item) => {
  const source = section === 'photos' ? item.cover?.thumbnail : section === 'albums' ? item.cover?.src : '';
  if (source) return `<span class="list-thumb"><img src="${escapeHtml(displayAssetUrl(source))}" alt="" /></span>`;
  return `<span class="list-thumb">${section === 'articles' ? 'MD' : section === 'notices' ? '!' : '///'}</span>`;
};

const renderList = () => {
  elements.pageTitle.textContent = sectionMeta[section].title;
  elements.listTitle.textContent = sectionMeta[section].listTitle;
  const items = content[section] || [];
  elements.list.innerHTML = items.length ? items.map((item) => `
    <button class="list-item ${selectedSlug === item.slug && !creating ? 'is-active' : ''}" data-select="${escapeHtml(item.slug)}">
      ${itemThumb(item)}
      <span class="list-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(itemMeta(item))}</span>
      </span>
      <i>${item.enabled === false || item.draft ? 'OFF' : '↗'}</i>
    </button>
  `).join('') : `<div class="empty-state"><p>还没有${sectionMeta[section].singular}</p></div>`;
  elements.list.querySelectorAll('[data-select]').forEach((button) => {
    button.addEventListener('click', () => {
      creating = false;
      selectedSlug = button.dataset.select;
      photoDraft = null;
      renderList();
      renderEditor(content[section].find((item) => item.slug === selectedSlug));
    });
  });
};

const editorHeading = (eyebrow, title, isNew = false) => `
  <header class="editor-heading">
    <div><p>${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>
    <div class="editor-actions">
      ${!isNew ? '<button type="button" class="button button-danger" data-delete>删除</button>' : ''}
      <button type="submit" class="button button-primary">${isNew ? '创建并保存' : '保存修改'}</button>
    </div>
  </header>
`;

const emptyEditor = () => {
  elements.editor.innerHTML = `
    <div class="empty-state"><span>///</span><h2>选择一条内容开始维护</h2><p>或者点击左侧的 ＋ 新建内容</p></div>
  `;
};

const renderEditor = (item) => {
  if (!item) return emptyEditor();
  if (section === 'photos') renderPhotoEditor(item);
  if (section === 'notices') renderNoticeEditor(item);
  if (section === 'articles') renderArticleEditor(item);
  if (section === 'albums') renderAlbumEditor(item);
};

const renderNewEditor = () => {
  creating = true;
  selectedSlug = '';
  photoDraft = null;
  renderList();
  if (section === 'photos') renderNewPhoto();
  if (section === 'notices') renderNoticeEditor({ enabled: true, priority: 0, type: 'site' }, true);
  if (section === 'articles') renderArticleEditor({ date: new Date().toISOString().slice(0, 10), tags: [], draft: false, body: '' }, true);
  if (section === 'albums') renderAlbumEditor({ enabled: true, priority: 0, type: 'single' }, true);
};

const uploadFiles = async (files, onProgress) => {
  const { uploadId } = await api('/api/uploads', { method: 'POST' });
  const uploaded = [];
  for (const [index, file] of files.entries()) {
    onProgress?.(index, files.length, file.name);
    const response = await fetch(`/api/uploads/${uploadId}/${index}`, {
      method: 'PUT',
      headers: { 'x-file-name': encodeURIComponent(file.name) },
      body: file,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `上传 ${file.name} 失败`);
    uploaded.push(result);
  }
  onProgress?.(files.length, files.length, '上传完成');
  return { uploadId, uploaded };
};

const runBuild = async (silent = false) => {
  elements.build.disabled = true;
  elements.build.textContent = '构建中…';
  setStatus('正在执行完整构建检查…', true);
  try {
    await api('/api/build', { method: 'POST' });
    if (!silent) showToast('构建通过，可以预览或提交');
    setStatus('构建检查通过');
  } finally {
    elements.build.disabled = false;
    elements.build.textContent = '检查并构建';
  }
};

const renderNewPhoto = () => {
  elements.editor.innerHTML = `
    <form data-photo-create>
      ${editorHeading('NEW PHOTO COLLECTION', '新增相册', true)}
      <div class="form-grid">
        <div class="form-field"><label>相册名称 *</label><input name="title" required placeholder="例如：2026 D2 终端技术大会" /></div>
        <div class="form-field"><label>SLUG *</label><input name="slug" required pattern="[a-z0-9-]+" placeholder="例如：d2-2026" /></div>
        <div class="form-field"><label>日期 *</label><input name="date" type="date" required /></div>
        <div class="form-field"><label>地点</label><input name="location" placeholder="例如：杭州" /></div>
        <div class="form-field form-field-full"><label>一句话简介 *</label><textarea name="summary" required placeholder="这组相册记录了什么？"></textarea></div>
        <div class="form-field form-field-full">
          <label>原始照片与视频 *</label>
          <label class="drop-zone">
            <input name="files" type="file" accept="image/*,video/mp4,video/quicktime" multiple webkitdirectory />
            <strong data-file-label>点击选择照片文件夹</strong>
            <span>支持 JPG、PNG、WebP、HEIC、MP4、MOV；将按文件名自然排序</span>
          </label>
        </div>
        <div class="form-field form-field-full"><label>封面</label><select name="cover" disabled><option>选择照片后可设置</option></select></div>
      </div>
      <div class="progress" data-progress><div class="progress-track"><div class="progress-bar" data-progress-bar></div></div><p data-progress-text></p></div>
    </form>
  `;
  const form = elements.editor.querySelector('[data-photo-create]');
  const titleInput = form.elements.title;
  const slugInput = form.elements.slug;
  const fileInput = form.elements.files;
  const coverSelect = form.elements.cover;
  let slugTouched = false;
  slugInput.addEventListener('input', () => { slugTouched = Boolean(slugInput.value); });
  titleInput.addEventListener('input', () => { if (!slugTouched) slugInput.value = slugify(titleInput.value); });
  fileInput.addEventListener('change', () => {
    const selectedFiles = [...fileInput.files];
    const files = selectedFiles
      .filter(isSupportedPhotoFile)
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'zh-CN', { numeric: true }));
    const ignoredCount = selectedFiles.length - files.length;
    form._orderedFiles = files;
    form.querySelector('[data-file-label]').textContent = ignoredCount
      ? `已选择 ${files.length} 个媒体文件 · 已忽略 ${ignoredCount} 个系统或不支持文件`
      : `已选择 ${files.length} 个媒体文件`;
    coverSelect.disabled = !files.length;
    coverSelect.innerHTML = files.length
      ? files.map((file, index) => `<option value="${index}">${escapeHtml(file.name)}</option>`).join('')
      : '<option>没有找到支持的媒体文件</option>';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const files = form._orderedFiles || [];
    if (!files.length) return showToast('请先选择照片文件夹', true);
    const submit = form.querySelector('[type="submit"]');
    const progress = form.querySelector('[data-progress]');
    const bar = form.querySelector('[data-progress-bar]');
    const text = form.querySelector('[data-progress-text]');
    submit.disabled = true;
    progress.classList.add('is-visible');
    try {
      const { uploadId, uploaded } = await uploadFiles(files, (done, total, name) => {
        bar.style.width = `${Math.round((done / total) * 72)}%`;
        text.textContent = `上传 ${done}/${total} · ${name}`;
      });
      bar.style.width = '78%';
      text.textContent = '正在生成 WebP、缩略图和配置…';
      const values = Object.fromEntries(new FormData(form));
      const created = await api('/api/photos', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          slug: values.slug,
          date: values.date,
          location: values.location,
          summary: values.summary,
          uploadId,
          files: uploaded,
          coverFile: uploaded[Number(values.cover || 0)]?.storedName,
        }),
      });
      bar.style.width = '86%';
      text.textContent = '相册已生成，正在检查网站构建…';
      await runBuild(true);
      bar.style.width = '100%';
      text.textContent = '完成';
      selectedSlug = created.slug;
      creating = false;
      await refresh();
      showToast(`相册「${created.title}」已生成并通过构建`);
    } catch (error) {
      showToast(error.message, true);
      setStatus('生成失败，请检查输入');
    } finally {
      submit.disabled = false;
    }
  });
};

const syncPhotoDraft = (form) => {
  const values = Object.fromEntries(new FormData(form));
  photoDraft.title = values.title;
  photoDraft.date = values.date;
  photoDraft.location = values.location;
  photoDraft.summary = values.summary;
};

const renderPhotoEditor = (item) => {
  if (!photoDraft || photoDraft.slug !== item.slug) photoDraft = clone(item);
  const draft = photoDraft;
  elements.editor.innerHTML = `
    <form data-photo-edit>
      ${editorHeading('PHOTO COLLECTION', draft.title)}
      <div class="form-grid">
        <div class="form-field"><label>相册名称 *</label><input name="title" required value="${escapeHtml(draft.title)}" /></div>
        <div class="form-field"><label>SLUG（创建后不可修改）</label><input value="${escapeHtml(draft.slug)}" disabled /></div>
        <div class="form-field"><label>日期 *</label><input name="date" type="date" required value="${escapeHtml(formatDate(draft.date))}" /></div>
        <div class="form-field"><label>地点</label><input name="location" value="${escapeHtml(draft.location || '')}" /></div>
        <div class="form-field form-field-full"><label>一句话简介 *</label><textarea name="summary" required>${escapeHtml(draft.summary)}</textarea></div>
      </div>
      <div class="media-toolbar">
        <h3>图片顺序、封面与删除</h3>
        <div class="media-toolbar-actions">
          <span>${draft.media.length} MEDIA · C 设为封面 · × 删除</span>
          <label class="media-add-button">
            ＋ 添加单张图片
            <input type="file" accept="image/*,.heic,.heif,.tif,.tiff" data-media-add />
          </label>
        </div>
      </div>
      <div class="media-grid">
        ${draft.media.map((media, index) => `
          <div class="media-card ${draft.cover.thumbnail === media.thumbnail ? 'is-cover' : ''}">
            <img src="${escapeHtml(displayAssetUrl(media.thumbnail))}" alt="${escapeHtml(media.alt)}" />
            <div class="media-actions">
              <button type="button" data-media-cover="${index}" title="设为封面">C</button>
              <button type="button" data-media-up="${index}" title="向前移动">←</button>
              <button type="button" data-media-down="${index}" title="向后移动">→</button>
              <button type="button" data-media-delete="${index}" title="删除这张素材" aria-label="删除第 ${index + 1} 张素材">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </form>
  `;
  const form = elements.editor.querySelector('[data-photo-edit]');
  form.querySelector('[data-media-add]').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!supportedImageExtensions.has(fileExtension(file)) || !isSupportedPhotoFile(file)) {
      input.value = '';
      return showToast('请选择支持的图片文件', true);
    }
    syncPhotoDraft(form);
    input.disabled = true;
    setStatus(`正在添加 ${file.name}…`, true);
    try {
      const { uploadId, uploaded } = await uploadFiles([file]);
      const updated = await api(`/api/photos/${draft.slug}/media`, {
        method: 'POST',
        body: JSON.stringify({
          uploadId,
          file: uploaded[0],
          title: draft.title,
        }),
      });
      const addedMedia = updated.media.at(-1);
      if (!addedMedia) throw new Error('图片处理完成，但没有返回素材信息');
      draft.media.push(addedMedia);
      const stored = content.photos.find((photo) => photo.slug === draft.slug);
      if (stored) Object.assign(stored, updated);
      renderList();
      renderPhotoEditor(draft);
      showToast(`已添加 ${file.name}，图片位于相册末尾`);
      setStatus('图片已添加');
    } catch (error) {
      showToast(error.message, true);
      setStatus('添加图片失败');
      input.disabled = false;
      input.value = '';
    }
  });
  form.querySelectorAll('[data-media-cover]').forEach((button) => button.addEventListener('click', () => {
    syncPhotoDraft(form);
    const media = draft.media[Number(button.dataset.mediaCover)];
    draft.cover.thumbnail = media.thumbnail;
    draft.cover.src = media.type === 'video' ? media.poster : media.src;
    renderPhotoEditor(draft);
  }));
  form.querySelectorAll('[data-media-up]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.mediaUp);
    if (!index) return;
    syncPhotoDraft(form);
    [draft.media[index - 1], draft.media[index]] = [draft.media[index], draft.media[index - 1]];
    renderPhotoEditor(draft);
  }));
  form.querySelectorAll('[data-media-down]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.mediaDown);
    if (index >= draft.media.length - 1) return;
    syncPhotoDraft(form);
    [draft.media[index + 1], draft.media[index]] = [draft.media[index], draft.media[index + 1]];
    renderPhotoEditor(draft);
  }));
  form.querySelectorAll('[data-media-delete]').forEach((button) => button.addEventListener('click', () => {
    if (draft.media.length <= 1) return showToast('相册至少需要保留一张素材', true);
    const index = Number(button.dataset.mediaDelete);
    const media = draft.media[index];
    if (!media || !confirm(`确定删除第 ${index + 1} 张素材吗？点击“保存修改”后，对应的优化文件也会删除。`)) return;
    syncPhotoDraft(form);
    draft.media.splice(index, 1);
    if (draft.cover.thumbnail === media.thumbnail) {
      const nextCover = draft.media[0];
      draft.cover.thumbnail = nextCover.thumbnail;
      draft.cover.src = nextCover.type === 'video' ? nextCover.poster : nextCover.src;
    }
    renderPhotoEditor(draft);
    showToast('素材已移出列表，点击“保存修改”后生效');
  }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncPhotoDraft(form);
    try {
      await api(`/api/photos/${draft.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: draft.title,
          date: draft.date,
          location: draft.location,
          summary: draft.summary,
          coverSrc: draft.cover.src,
          coverThumbnail: draft.cover.thumbnail,
          mediaOrder: draft.media.map((media) => media.src),
        }),
      });
      photoDraft = null;
      await refresh();
      showToast('相册修改已保存');
    } catch (error) { showToast(error.message, true); }
  });
  form.querySelector('[data-delete]').addEventListener('click', async () => {
    if (!confirm(`确定删除相册「${draft.title}」及其全部优化后素材吗？原始照片不会受影响。`)) return;
    try {
      await api(`/api/photos/${draft.slug}`, { method: 'DELETE' });
      selectedSlug = '';
      photoDraft = null;
      await refresh({ keepSelection: false });
      emptyEditor();
      showToast('相册已删除');
    } catch (error) { showToast(error.message, true); }
  });
};

const renderNoticeEditor = (item, isNew = false) => {
  elements.editor.innerHTML = `
    <form data-notice-form>
      ${editorHeading(isNew ? 'NEW NOTICE' : 'NOTICE ENTRY', isNew ? '新增公告' : item.title, isNew)}
      <div class="form-grid">
        <div class="form-field"><label>公告标题 *</label><input name="title" required value="${escapeHtml(item.title || '')}" /></div>
        <div class="form-field"><label>SLUG *</label><input name="slug" required pattern="[a-z0-9-]+" value="${escapeHtml(item.slug || '')}" ${isNew ? '' : 'disabled'} /></div>
        <div class="form-field"><label>类型</label><select name="type">${['site','article','live','release'].map((type) => `<option value="${type}" ${item.type === type ? 'selected' : ''}>${type.toUpperCase()}</option>`).join('')}</select></div>
        <div class="form-field"><label>优先级</label><input name="priority" type="number" value="${Number(item.priority || 0)}" /></div>
        <div class="form-field"><label>开始日期 *</label><input name="startAt" type="date" required value="${escapeHtml(formatDate(item.startAt))}" /></div>
        <div class="form-field"><label>结束日期</label><input name="endAt" type="date" value="${escapeHtml(formatDate(item.endAt))}" /></div>
        <div class="form-field form-field-full"><label>跳转链接</label><input name="href" value="${escapeHtml(item.href || '')}" placeholder="/articles/example" /></div>
        <div class="form-field form-field-full"><label>摘要</label><textarea name="summary">${escapeHtml(item.summary || '')}</textarea></div>
        <label class="checkbox-field form-field-full"><input name="enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''} /> 当前启用</label>
      </div>
    </form>
  `;
  const form = elements.editor.querySelector('[data-notice-form]');
  const title = form.elements.title;
  const slug = form.elements.slug;
  if (isNew) title.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(title.value); });
  if (isNew) slug.addEventListener('input', () => { slug.dataset.touched = slug.value ? '1' : ''; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const targetSlug = isNew ? values.slug : item.slug;
    try {
      const saved = await api(isNew ? '/api/notices' : `/api/notices/${item.slug}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ ...values, slug: targetSlug, enabled: form.elements.enabled.checked }),
      });
      selectedSlug = saved.slug;
      creating = false;
      await refresh();
      showToast('公告已保存');
    } catch (error) { showToast(error.message, true); }
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`确定删除公告「${item.title}」吗？`)) return;
    await api(`/api/notices/${item.slug}`, { method: 'DELETE' });
    selectedSlug = '';
    await refresh({ keepSelection: false });
    emptyEditor();
    showToast('公告已删除');
  });
};

const renderArticleEditor = (item, isNew = false) => {
  elements.editor.innerHTML = `
    <form data-article-form>
      ${editorHeading(isNew ? 'NEW ARTICLE' : 'MARKDOWN ARTICLE', isNew ? '新增文章' : item.title, isNew)}
      <div class="form-grid">
        <div class="form-field"><label>文章标题 *</label><input name="title" required value="${escapeHtml(item.title || '')}" /></div>
        <div class="form-field"><label>SLUG *</label><input name="slug" required pattern="[a-z0-9-]+" value="${escapeHtml(item.slug || '')}" ${isNew ? '' : 'disabled'} /></div>
        <div class="form-field"><label>发布日期 *</label><input name="date" type="date" required value="${escapeHtml(formatDate(item.date))}" /></div>
        <div class="form-field"><label>标签（逗号分隔）</label><input name="tags" value="${escapeHtml((item.tags || []).join(', '))}" /></div>
        <div class="form-field form-field-full"><label>摘要 *</label><textarea name="summary" required>${escapeHtml(item.summary || '')}</textarea></div>
        <div class="form-field form-field-full"><label>正文（Markdown）</label><textarea class="article-body" name="body">${escapeHtml(item.body || '')}</textarea><p class="form-note">支持标题、列表、链接、引用、代码块等 Markdown 语法。</p></div>
        <label class="checkbox-field form-field-full"><input name="draft" type="checkbox" ${item.draft ? 'checked' : ''} /> 保存为草稿（首页不展示）</label>
      </div>
    </form>
  `;
  const form = elements.editor.querySelector('[data-article-form]');
  const title = form.elements.title;
  const slug = form.elements.slug;
  if (isNew) title.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(title.value); });
  if (isNew) slug.addEventListener('input', () => { slug.dataset.touched = slug.value ? '1' : ''; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const targetSlug = isNew ? values.slug : item.slug;
    try {
      const saved = await api(isNew ? '/api/articles' : `/api/articles/${item.slug}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({
          ...values,
          slug: targetSlug,
          tags: String(values.tags || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
          draft: form.elements.draft.checked,
        }),
      });
      selectedSlug = saved.slug;
      creating = false;
      await refresh();
      showToast('文章已保存');
    } catch (error) { showToast(error.message, true); }
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`确定删除文章「${item.title}」吗？`)) return;
    await api(`/api/articles/${item.slug}`, { method: 'DELETE' });
    selectedSlug = '';
    await refresh({ keepSelection: false });
    emptyEditor();
    showToast('文章已删除');
  });
};

const renderAlbumEditor = (item, isNew = false) => {
  elements.editor.innerHTML = `
    <form data-album-form>
      ${editorHeading(isNew ? 'NEW RELEASE' : 'ALBUM / SINGLE', isNew ? '新增专辑或单曲' : item.title, isNew)}
      <div class="form-grid">
        <div class="form-field"><label>名称 *</label><input name="title" required value="${escapeHtml(item.title || '')}" /></div>
        <div class="form-field"><label>SLUG *</label><input name="slug" required pattern="[a-z0-9-]+" value="${escapeHtml(item.slug || '')}" ${isNew ? '' : 'disabled'} /></div>
        <div class="form-field"><label>类型</label><select name="type">${['single','ep','album'].map((type) => `<option value="${type}" ${item.type === type ? 'selected' : ''}>${type.toUpperCase()}</option>`).join('')}</select></div>
        <div class="form-field"><label>首页优先级</label><input name="priority" type="number" value="${Number(item.priority || 0)}" /></div>
        <div class="form-field"><label>发行日期</label><input name="date" type="date" value="${escapeHtml(formatDate(item.date))}" /></div>
        <div class="form-field"><label>站外链接</label><input name="href" value="${escapeHtml(item.href || '')}" placeholder="https://music.163.com/..." /></div>
        <div class="form-field form-field-full"><label>简介</label><textarea name="summary">${escapeHtml(item.summary || '')}</textarea></div>
        <div class="form-field form-field-full">
          <label>${isNew ? '封面图片 *' : '更换封面（不选择则保留）'}</label>
          <label class="drop-zone">
            <input name="cover" type="file" accept="image/*" ${isNew ? 'required' : ''} />
            ${item.cover?.src ? `<img src="${escapeHtml(displayAssetUrl(item.cover.src))}" alt="" style="width:120px;height:72px;object-fit:cover;margin-bottom:10px;filter:grayscale(1)" />` : ''}
            <strong data-cover-label>${item.cover ? '点击选择新封面' : '点击选择封面图片'}</strong>
            <span>自动转换为 WebP</span>
          </label>
        </div>
        <label class="checkbox-field form-field-full"><input name="enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''} /> 在首页启用</label>
      </div>
    </form>
  `;
  const form = elements.editor.querySelector('[data-album-form]');
  const title = form.elements.title;
  const slug = form.elements.slug;
  const coverInput = form.elements.cover;
  if (isNew) title.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(title.value); });
  if (isNew) slug.addEventListener('input', () => { slug.dataset.touched = slug.value ? '1' : ''; });
  coverInput.addEventListener('change', () => { form.querySelector('[data-cover-label]').textContent = coverInput.files[0]?.name || '点击选择封面图片'; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const targetSlug = isNew ? values.slug : item.slug;
    try {
      let upload = {};
      if (coverInput.files[0]) {
        const result = await uploadFiles([coverInput.files[0]]);
        upload = { uploadId: result.uploadId, coverFile: result.uploaded[0].storedName };
      }
      const saved = await api(isNew ? '/api/albums' : `/api/albums/${item.slug}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ ...values, ...upload, slug: targetSlug, enabled: form.elements.enabled.checked }),
      });
      selectedSlug = saved.slug;
      creating = false;
      await refresh();
      showToast('ALBUMS 内容已保存');
    } catch (error) { showToast(error.message, true); }
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`确定删除「${item.title}」吗？`)) return;
    await api(`/api/albums/${item.slug}`, { method: 'DELETE' });
    selectedSlug = '';
    await refresh({ keepSelection: false });
    emptyEditor();
    showToast('ALBUMS 内容已删除');
  });
};

document.querySelectorAll('[data-section]').forEach((button) => {
  button.addEventListener('click', () => {
    section = button.dataset.section;
    selectedSlug = '';
    creating = false;
    photoDraft = null;
    document.querySelectorAll('[data-section]').forEach((item) => item.classList.toggle('is-active', item === button));
    renderList();
    emptyEditor();
  });
});

elements.newButton.addEventListener('click', renderNewEditor);
elements.build.addEventListener('click', () => runBuild().catch((error) => {
  showToast(error.message, true);
  setStatus('构建失败');
}));

setInterval(() => {
  document.querySelector('[data-clock]').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
}, 1000);

refresh({ keepSelection: false }).catch((error) => {
  showToast(error.message, true);
  setStatus('无法连接内容服务');
});
