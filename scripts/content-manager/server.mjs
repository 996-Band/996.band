import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  getCdnUrl,
  getMediaConfig,
  loadLocalEnvironment,
  manifestPath,
} from '../media/common.mjs';
import {
  publishGeneratedAssets,
  refreshMediaManifest,
} from '../media/oss.mjs';

await loadLocalEnvironment();
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uiRoot = path.join(repoRoot, 'scripts/content-manager/ui');
const publicRoot = path.join(repoRoot, 'public');
const contentRoot = path.join(repoRoot, 'src/content');
const uploadRoot = path.join(repoRoot, '.content-manager-uploads');
const host = '127.0.0.1';
const port = Number(process.env.CONTENT_MANAGER_PORT || 4310);
const maxUploadBytes = 500 * 1024 * 1024;
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.heic', '.heif']);
const videoExtensions = new Set(['.mp4', '.mov', '.m4v']);
const isSupportedMediaUpload = (file) => {
  const originalName = path.basename(file.originalName || file.storedName || '');
  if (originalName.startsWith('.') || originalName.startsWith('._')) return false;
  const extension = path.extname(originalName).toLowerCase();
  return imageExtensions.has(extension) || videoExtensions.has(extension);
};

let buildRunning = false;
const mediaConfig = getMediaConfig();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const exists = async (target) => access(target).then(() => true).catch(() => false);
const assertSlug = (slug) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) {
    throw new HttpError(400, 'Slug 只能包含小写英文、数字和连字符');
  }
  return slug;
};
const assertUploadId = (value) => {
  if (!/^[a-f0-9-]{36}$/.test(value || '')) throw new HttpError(400, '上传会话无效');
  return value;
};
const json = (response, status, payload) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
};
const readJsonBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) throw new HttpError(413, '请求内容过大');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'JSON 格式不正确');
  }
};
const atomicWrite = async (target, content) => {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, target);
};
const writeJson = (target, value) => atomicWrite(target, `${JSON.stringify(value, null, 2)}\n`);
const listFiles = async (directory, extensions) => {
  if (!(await exists(directory))) return [];
  return (await readdir(directory))
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
};
const readJsonDirectory = async (name) => {
  const directory = path.join(contentRoot, name);
  return Promise.all((await listFiles(directory, ['.json'])).map(async (file) => ({
    ...(JSON.parse(await readFile(path.join(directory, file), 'utf8'))),
    _file: file,
  })));
};

const parseScalar = (value = '') => {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  return trimmed;
};

const parseArticle = (source, file) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`文章 ${file} 缺少 Frontmatter`);
  const data = { tags: [] };
  const lines = match[1].split(/\r?\n/);
  let currentKey = '';
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      data[currentKey] = keyMatch[2] ? parseScalar(keyMatch[2]) : [];
      continue;
    }
    const arrayMatch = line.match(/^\s+-\s+(.*)$/);
    if (arrayMatch && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(parseScalar(arrayMatch[1]));
    }
  }
  return {
    ...data,
    slug: path.basename(file, path.extname(file)),
    body: match[2].trimEnd(),
    _file: file,
  };
};

const serializeArticle = (article) => {
  const tags = Array.isArray(article.tags) ? article.tags.filter(Boolean) : [];
  return [
    '---',
    `title: ${JSON.stringify(article.title || '')}`,
    `date: ${article.date || new Date().toISOString().slice(0, 10)}`,
    `summary: ${JSON.stringify(article.summary || '')}`,
    'tags:',
    ...tags.map((tag) => `  - ${JSON.stringify(tag)}`),
    `draft: ${Boolean(article.draft)}`,
    '---',
    '',
    String(article.body || '').trimEnd(),
    '',
  ].join('\n');
};

const getContentState = async () => {
  const articleDirectory = path.join(contentRoot, 'articles');
  const articleFiles = await listFiles(articleDirectory, ['.md', '.mdx']);
  const articles = await Promise.all(articleFiles.map(async (file) => (
    parseArticle(await readFile(path.join(articleDirectory, file), 'utf8'), file)
  )));
  const [photos, notices, albums] = await Promise.all([
    readJsonDirectory('photos'),
    readJsonDirectory('notices'),
    readJsonDirectory('albums'),
  ]);
  return {
    photos: photos.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    notices: notices.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)),
    articles: articles.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    albums: albums.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)),
  };
};

const getMediaStatus = async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const publicBaseUrl = mediaConfig.publicAssetBaseUrl;
  const assetUrls = publicBaseUrl
    ? Object.fromEntries(Object.entries(manifest.assets).map(([localUrl, asset]) => [
      localUrl,
      getCdnUrl(publicBaseUrl, asset.objectKey),
    ]))
    : {};
  return {
    mode: publicBaseUrl ? 'cdn' : 'local',
    cdnBaseUrl: mediaConfig.cdnBaseUrl,
    uploadEnabled: mediaConfig.uploadEnabled,
    ossConfigured: Boolean(
      mediaConfig.region
      && mediaConfig.bucket
      && mediaConfig.accessKeyId
      && mediaConfig.accessKeySecret
    ),
    manifestVersion: manifest.version,
    totalAssets: manifest.totalAssets,
    assetUrls,
  };
};

const uploadDirectory = (uploadId) => path.join(uploadRoot, assertUploadId(uploadId));
const createUpload = async () => {
  const uploadId = randomUUID();
  await mkdir(uploadDirectory(uploadId), { recursive: true });
  return uploadId;
};
const storeUpload = async (request, uploadId, index) => {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > maxUploadBytes) throw new HttpError(413, '单个文件不能超过 500MB');
  const originalName = decodeURIComponent(String(request.headers['x-file-name'] || `file-${index}`));
  const safeName = path.basename(originalName).replace(/[^\p{L}\p{N}._ -]+/gu, '-');
  const storedName = `${String(index).padStart(4, '0')}--${safeName}`;
  const target = path.join(uploadDirectory(uploadId), storedName);
  await pipeline(request, createWriteStream(target, { flags: 'wx' }));
  return { storedName, originalName };
};

const getUploadedPath = async (uploadId, storedName) => {
  const directory = uploadDirectory(uploadId);
  const safeName = path.basename(storedName || '');
  const target = path.join(directory, safeName);
  if (!(await exists(target))) throw new HttpError(400, `找不到已上传文件：${safeName}`);
  return target;
};

const createImageAssets = async (input, outputDirectory, stem) => {
  const fullName = `${stem}.webp`;
  const thumbnailName = `${stem}-thumb.webp`;
  const fullResult = await sharp(input)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toFile(path.join(outputDirectory, fullName));
  await sharp(input)
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74, effort: 5, smartSubsample: true })
    .toFile(path.join(outputDirectory, thumbnailName));
  return { fullName, thumbnailName, width: fullResult.width, height: fullResult.height };
};

const createVideoAssets = async (input, outputDirectory, stem) => {
  const videoName = `${stem}.mp4`;
  const posterName = `${stem}-poster.webp`;
  const thumbnailName = `${stem}-thumb.webp`;
  const videoPath = path.join(outputDirectory, videoName);
  const temporaryPoster = path.join(outputDirectory, `${stem}-poster-source.jpg`);
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', input,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', videoPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error', '-ss', '0.4', '-i', videoPath,
      '-frames:v', '1', '-q:v', '2', temporaryPoster,
    ], { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    throw new HttpError(500, `视频处理失败，请确认本机已安装 ffmpeg：${error.message}`);
  }
  const posterResult = await sharp(temporaryPoster)
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(outputDirectory, posterName));
  await sharp(temporaryPoster)
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74, effort: 5 })
    .toFile(path.join(outputDirectory, thumbnailName));
  await unlink(temporaryPoster);
  return { videoName, posterName, thumbnailName, width: posterResult.width, height: posterResult.height };
};

const collectGeneratedAssets = (media, directory) => {
  const urls = new Set(
    media
      .flatMap((item) => [item.src, item.thumbnail, item.poster])
      .filter(Boolean),
  );
  return [...urls].map((localUrl) => ({
    localUrl,
    file: path.join(directory, path.basename(localUrl)),
  }));
};

const processPhotoUpload = async (payload) => {
  const slug = assertSlug(payload.slug);
  const configPath = path.join(contentRoot, 'photos', `${slug}.json`);
  const finalDirectory = path.join(publicRoot, 'assets/photos', slug);
  if (await exists(configPath) || await exists(finalDirectory)) throw new HttpError(409, `相册 ${slug} 已存在`);
  if (!Array.isArray(payload.files) || !payload.files.length) throw new HttpError(400, '请至少选择一张图片或一个视频');
  if (!payload.title || !payload.date || !payload.summary) throw new HttpError(400, '请填写相册名称、日期和简介');
  const files = payload.files.filter(isSupportedMediaUpload);
  if (!files.length) {
    await rm(uploadDirectory(payload.uploadId), { recursive: true, force: true });
    throw new HttpError(400, '所选文件夹中没有支持的图片或视频');
  }

  const stagingDirectory = path.join(publicRoot, 'assets/photos', `.staging-${slug}-${randomUUID()}`);
  await mkdir(stagingDirectory, { recursive: true });
  const media = [];
  try {
    for (const [index, file] of files.entries()) {
      const input = await getUploadedPath(payload.uploadId, file.storedName);
      const extension = path.extname(file.originalName || file.storedName).toLowerCase();
      const stem = String(index + 1).padStart(Math.max(2, String(files.length).length), '0');
      const alt = `${payload.title}现场记录 ${index + 1}`;
      if (imageExtensions.has(extension)) {
        const result = await createImageAssets(input, stagingDirectory, stem);
        media.push({
          type: 'image',
          src: `/assets/photos/${slug}/${result.fullName}`,
          thumbnail: `/assets/photos/${slug}/${result.thumbnailName}`,
          alt,
          width: result.width,
          height: result.height,
          _uploadName: file.storedName,
        });
      } else if (videoExtensions.has(extension)) {
        const result = await createVideoAssets(input, stagingDirectory, stem);
        media.push({
          type: 'video',
          src: `/assets/photos/${slug}/${result.videoName}`,
          thumbnail: `/assets/photos/${slug}/${result.thumbnailName}`,
          poster: `/assets/photos/${slug}/${result.posterName}`,
          alt,
          width: result.width,
          height: result.height,
          _uploadName: file.storedName,
        });
      }
    }

    const coverItem = media.find((item) => item._uploadName === payload.coverFile) || media[0];
    const cleanMedia = media.map(({ _uploadName, ...item }) => item);
    const entry = {
      title: payload.title.trim(),
      slug,
      date: payload.date,
      ...(payload.location?.trim() ? { location: payload.location.trim() } : {}),
      summary: payload.summary.trim(),
      cover: {
        src: coverItem.type === 'video' ? coverItem.poster : coverItem.src,
        thumbnail: coverItem.thumbnail,
        alt: `${payload.title.trim()}相册封面`,
        width: coverItem.width,
        height: coverItem.height,
      },
      media: cleanMedia,
    };
    await publishGeneratedAssets(collectGeneratedAssets(cleanMedia, stagingDirectory));
    await rename(stagingDirectory, finalDirectory);
    await writeJson(configPath, entry);
    await refreshMediaManifest();
    return entry;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(uploadDirectory(payload.uploadId), { recursive: true, force: true });
  }
};

const appendPhotoImage = async (slug, payload) => {
  assertSlug(slug);
  const target = path.join(contentRoot, 'photos', `${slug}.json`);
  const finalDirectory = path.join(publicRoot, 'assets/photos', slug);
  if (!(await exists(target)) || !(await exists(finalDirectory))) throw new HttpError(404, '相册不存在');
  if (!payload.uploadId || !payload.file?.storedName) throw new HttpError(400, '请选择一张图片');

  const originalName = path.basename(payload.file.originalName || payload.file.storedName);
  const extension = path.extname(originalName).toLowerCase();
  if (originalName.startsWith('.') || !imageExtensions.has(extension)) {
    await rm(uploadDirectory(payload.uploadId), { recursive: true, force: true });
    throw new HttpError(400, '请选择支持的图片文件');
  }

  const current = JSON.parse(await readFile(target, 'utf8'));
  const stagingDirectory = path.join(publicRoot, 'assets/photos', `.staging-${slug}-add-${randomUUID()}`);
  const stem = `added-${randomUUID().slice(0, 8)}`;
  const movedAssets = [];
  await mkdir(stagingDirectory, { recursive: true });
  try {
    const input = await getUploadedPath(payload.uploadId, payload.file.storedName);
    const result = await createImageAssets(input, stagingDirectory, stem);
    const media = {
      type: 'image',
      src: `/assets/photos/${slug}/${result.fullName}`,
      thumbnail: `/assets/photos/${slug}/${result.thumbnailName}`,
      alt: `${String(payload.title || current.title).trim()}现场记录 ${current.media.length + 1}`,
      width: result.width,
      height: result.height,
    };
    await publishGeneratedAssets(collectGeneratedAssets([media], stagingDirectory));
    for (const name of [result.fullName, result.thumbnailName]) {
      const destination = path.join(finalDirectory, name);
      await rename(path.join(stagingDirectory, name), destination);
      movedAssets.push(destination);
    }
    const updated = { ...current, media: [...current.media, media] };
    await writeJson(target, updated);
    await refreshMediaManifest();
    return updated;
  } catch (error) {
    await Promise.all(movedAssets.map((asset) => rm(asset, { force: true })));
    throw error;
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
    await rm(uploadDirectory(payload.uploadId), { recursive: true, force: true });
  }
};

const updatePhoto = async (slug, payload) => {
  assertSlug(slug);
  const target = path.join(contentRoot, 'photos', `${slug}.json`);
  if (!(await exists(target))) throw new HttpError(404, '相册不存在');
  const current = JSON.parse(await readFile(target, 'utf8'));
  const mediaBySource = new Map(current.media.map((item) => [item.src, item]));
  const requestedSources = Array.isArray(payload.mediaOrder) ? payload.mediaOrder : current.media.map((item) => item.src);
  if (!requestedSources.length) throw new HttpError(400, '相册至少需要保留一张素材');
  if (new Set(requestedSources).size !== requestedSources.length) throw new HttpError(400, '图片排序数据包含重复素材');
  const orderedMedia = requestedSources.map((src) => mediaBySource.get(src));
  if (orderedMedia.some((item) => !item)) throw new HttpError(400, '图片排序数据包含未知素材');
  const retainedSources = new Set(requestedSources);
  const removedMedia = current.media.filter((item) => !retainedSources.has(item.src));
  const coverItem = (payload.coverSrc
    ? orderedMedia.find((item) => item.src === payload.coverSrc || item.poster === payload.coverSrc)
    : undefined)
    || (payload.coverThumbnail
      ? orderedMedia.find((item) => item.thumbnail === payload.coverThumbnail)
      : undefined)
    || orderedMedia[0];
  const updated = {
    ...current,
    title: String(payload.title || current.title).trim(),
    date: payload.date || current.date,
    ...(payload.location?.trim() ? { location: payload.location.trim() } : {}),
    summary: String(payload.summary ?? current.summary).trim(),
    cover: {
      src: coverItem.type === 'video' ? coverItem.poster : coverItem.src,
      thumbnail: coverItem.thumbnail,
      alt: `${String(payload.title || current.title).trim()}相册封面`,
      width: coverItem.width,
      height: coverItem.height,
    },
    media: orderedMedia,
  };
  if (!payload.location?.trim()) delete updated.location;
  await writeJson(target, updated);
  const albumAssetPrefix = `/assets/photos/${slug}/`;
  const albumDirectory = path.join(publicRoot, 'assets/photos', slug);
  const removedAssets = new Set(removedMedia.flatMap((item) => [item.src, item.thumbnail, item.poster]).filter(Boolean));
  await Promise.all([...removedAssets]
    .filter((asset) => asset.startsWith(albumAssetPrefix))
    .map((asset) => rm(path.join(albumDirectory, path.basename(asset)), { force: true })));
  await refreshMediaManifest();
  return updated;
};

const deletePhoto = async (slug) => {
  assertSlug(slug);
  await rm(path.join(contentRoot, 'photos', `${slug}.json`), { force: true });
  await rm(path.join(publicRoot, 'assets/photos', slug), { recursive: true, force: true });
  await refreshMediaManifest();
};

const normalizeNotice = (payload, slug) => ({
  title: String(payload.title || '').trim(),
  slug,
  type: ['live', 'article', 'release', 'site'].includes(payload.type) ? payload.type : 'site',
  startAt: payload.startAt,
  ...(payload.endAt ? { endAt: payload.endAt } : {}),
  enabled: Boolean(payload.enabled),
  priority: Number(payload.priority || 0),
  href: String(payload.href || '#').trim(),
  summary: String(payload.summary || '').trim(),
});

const saveNotice = async (slug, payload, create = false) => {
  assertSlug(slug);
  if (!payload.title || !payload.startAt) throw new HttpError(400, '请填写公告标题和开始日期');
  const target = path.join(contentRoot, 'notices', `${slug}.json`);
  if (create && await exists(target)) throw new HttpError(409, '公告 Slug 已存在');
  const entry = normalizeNotice(payload, slug);
  await writeJson(target, entry);
  return entry;
};

const saveArticle = async (slug, payload, create = false) => {
  assertSlug(slug);
  if (!payload.title || !payload.date || !payload.summary) throw new HttpError(400, '请填写文章标题、日期和摘要');
  const target = path.join(contentRoot, 'articles', `${slug}.md`);
  if (create && await exists(target)) throw new HttpError(409, '文章 Slug 已存在');
  await atomicWrite(target, serializeArticle(payload));
  return parseArticle(await readFile(target, 'utf8'), `${slug}.md`);
};

const processAlbumCover = async (slug, uploadId, storedName, title) => {
  const input = await getUploadedPath(uploadId, storedName);
  const directory = path.join(publicRoot, 'assets/albums', slug);
  const staging = `${directory}.staging-${randomUUID()}`;
  await mkdir(staging, { recursive: true });
  try {
    const result = await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(path.join(staging, 'cover.webp'));
    const src = `/assets/albums/${slug}/cover.webp`;
    await publishGeneratedAssets([{
      localUrl: src,
      file: path.join(staging, 'cover.webp'),
    }]);
    await rm(directory, { recursive: true, force: true });
    await rename(staging, directory);
    await refreshMediaManifest();
    return {
      src,
      alt: `${title} cover`,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(uploadDirectory(uploadId), { recursive: true, force: true });
  }
};

const saveAlbum = async (slug, payload, create = false) => {
  assertSlug(slug);
  if (!payload.title) throw new HttpError(400, '请填写专辑或单曲名称');
  const target = path.join(contentRoot, 'albums', `${slug}.json`);
  if (create && await exists(target)) throw new HttpError(409, 'ALBUM Slug 已存在');
  const current = await exists(target) ? JSON.parse(await readFile(target, 'utf8')) : null;
  let cover = current?.cover;
  if (payload.uploadId && payload.coverFile) {
    cover = await processAlbumCover(slug, payload.uploadId, payload.coverFile, payload.title.trim());
  }
  if (!cover) throw new HttpError(400, '请上传封面图片');
  const entry = {
    title: payload.title.trim(),
    slug,
    type: ['single', 'ep', 'album'].includes(payload.type) ? payload.type : 'single',
    ...(payload.date ? { date: payload.date } : {}),
    summary: String(payload.summary || '').trim(),
    href: String(payload.href || '').trim(),
    enabled: Boolean(payload.enabled),
    priority: Number(payload.priority || 0),
    cover,
  };
  await writeJson(target, entry);
  return entry;
};

const runBuild = async () => {
  if (buildRunning) throw new HttpError(409, '已有构建任务正在执行');
  buildRunning = true;
  try {
    const { stdout, stderr } = await execFileAsync('pnpm', ['build'], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    return `${stdout}${stderr}`.trim();
  } catch (error) {
    throw new HttpError(500, `${error.stdout || ''}\n${error.stderr || error.message}`.trim());
  } finally {
    buildRunning = false;
  }
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const serveFile = async (response, root, requestPath) => {
  const relative = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const target = path.resolve(root, relative || 'index.html');
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`) && target !== path.resolve(root)) throw new HttpError(403, '禁止访问');
  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404, '文件不存在');
  response.writeHead(200, {
    'content-type': mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(target).pipe(response);
};

const routeApi = async (request, response, url) => {
  const method = request.method || 'GET';
  const segments = url.pathname.split('/').filter(Boolean);

  if (method === 'GET' && url.pathname === '/api/content') return json(response, 200, await getContentState());
  if (method === 'GET' && url.pathname === '/api/media-status') return json(response, 200, await getMediaStatus());
  if (method === 'POST' && url.pathname === '/api/uploads') return json(response, 201, { uploadId: await createUpload() });
  if (method === 'PUT' && segments[1] === 'uploads' && segments.length === 4) {
    return json(response, 201, await storeUpload(request, segments[2], Number(segments[3])));
  }
  if (method === 'POST' && url.pathname === '/api/build') return json(response, 200, { output: await runBuild() });

  if (segments[1] === 'photos') {
    if (method === 'POST' && segments.length === 2) return json(response, 201, await processPhotoUpload(await readJsonBody(request)));
    if (segments.length === 4 && segments[3] === 'media' && method === 'POST') {
      return json(response, 201, await appendPhotoImage(segments[2], await readJsonBody(request)));
    }
    if (segments.length === 3 && method === 'PUT') return json(response, 200, await updatePhoto(segments[2], await readJsonBody(request)));
    if (segments.length === 3 && method === 'DELETE') {
      await deletePhoto(segments[2]);
      return json(response, 200, { ok: true });
    }
  }

  if (segments[1] === 'notices') {
    if (method === 'POST' && segments.length === 2) {
      const payload = await readJsonBody(request);
      return json(response, 201, await saveNotice(payload.slug, payload, true));
    }
    if (segments.length === 3 && method === 'PUT') return json(response, 200, await saveNotice(segments[2], await readJsonBody(request)));
    if (segments.length === 3 && method === 'DELETE') {
      await rm(path.join(contentRoot, 'notices', `${assertSlug(segments[2])}.json`), { force: true });
      return json(response, 200, { ok: true });
    }
  }

  if (segments[1] === 'articles') {
    if (method === 'POST' && segments.length === 2) {
      const payload = await readJsonBody(request);
      return json(response, 201, await saveArticle(payload.slug, payload, true));
    }
    if (segments.length === 3 && method === 'PUT') return json(response, 200, await saveArticle(segments[2], await readJsonBody(request)));
    if (segments.length === 3 && method === 'DELETE') {
      const slug = assertSlug(segments[2]);
      await rm(path.join(contentRoot, 'articles', `${slug}.md`), { force: true });
      await rm(path.join(contentRoot, 'articles', `${slug}.mdx`), { force: true });
      return json(response, 200, { ok: true });
    }
  }

  if (segments[1] === 'albums') {
    if (method === 'POST' && segments.length === 2) {
      const payload = await readJsonBody(request);
      return json(response, 201, await saveAlbum(payload.slug, payload, true));
    }
    if (segments.length === 3 && method === 'PUT') return json(response, 200, await saveAlbum(segments[2], await readJsonBody(request)));
    if (segments.length === 3 && method === 'DELETE') {
      const slug = assertSlug(segments[2]);
      await rm(path.join(contentRoot, 'albums', `${slug}.json`), { force: true });
      await rm(path.join(publicRoot, 'assets/albums', slug), { recursive: true, force: true });
      await refreshMediaManifest();
      return json(response, 200, { ok: true });
    }
  }

  throw new HttpError(404, '接口不存在');
};

await mkdir(uploadRoot, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const origin = request.headers.origin;
    if (origin && ![`http://${host}:${port}`, `http://localhost:${port}`].includes(origin)) {
      throw new HttpError(403, '管理接口只允许本机页面访问');
    }
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    if (url.pathname.startsWith('/api/')) return await routeApi(request, response, url);
    if (url.pathname.startsWith('/assets/')) return await serveFile(response, publicRoot, url.pathname);
    return await serveFile(response, uiRoot, url.pathname === '/' ? '/index.html' : url.pathname);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    json(response, status, { error: error.message || '未知错误' });
    if (status >= 500) console.error(error);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`内容管理工具已在 http://${host}:${port} 运行，或端口已被占用。`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`996 Band Content Manager: ${url}`);
  if (!process.env.NO_OPEN && process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
});

const shutdown = async () => {
  server.close();
  await rm(uploadRoot, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
