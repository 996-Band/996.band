import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../..');
export const publicRoot = path.join(repoRoot, 'public');
export const assetRoot = path.join(publicRoot, 'assets');
export const manifestPath = path.join(repoRoot, 'src/data/media-assets.json');
export const defaultCdnBaseUrl = 'https://oss.996.band';
export const defaultObjectPrefix = 'website';
export const immutableCacheControl = 'public, max-age=31536000, immutable';

const supportedExtensions = new Set([
  '.avif', '.gif', '.jpeg', '.jpg', '.m4v', '.mov', '.mp4', '.png', '.svg', '.webp',
]);

const mimeTypes = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const exists = (target) => access(target).then(() => true).catch(() => false);
const normalizeSlash = (value) => value.split(path.sep).join('/');
const trimSlashes = (value) => String(value || '').replace(/^\/+|\/+$/g, '');
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/g, '');

export const loadLocalEnvironment = async () => {
  const environmentPath = path.join(repoRoot, '.env');
  if (!(await exists(environmentPath)) || typeof process.loadEnvFile !== 'function') return;
  process.loadEnvFile(environmentPath);
};

export const getMediaConfig = ({ requireCredentials = false } = {}) => {
  const config = {
    cdnBaseUrl: normalizeBaseUrl(process.env.OSS_CDN_BASE_URL || defaultCdnBaseUrl),
    publicAssetBaseUrl: normalizeBaseUrl(process.env.PUBLIC_ASSET_BASE_URL),
    region: String(process.env.OSS_REGION || '').trim(),
    endpoint: String(process.env.OSS_ENDPOINT || '').trim(),
    bucket: String(process.env.OSS_BUCKET || '').trim(),
    objectPrefix: trimSlashes(process.env.OSS_OBJECT_PREFIX || defaultObjectPrefix),
    accessKeyId: String(process.env.OSS_ACCESS_KEY_ID || '').trim(),
    accessKeySecret: String(process.env.OSS_ACCESS_KEY_SECRET || '').trim(),
    stsToken: String(process.env.OSS_STS_TOKEN || '').trim(),
    uploadEnabled: process.env.OSS_UPLOAD_ENABLED === 'true',
  };

  if (requireCredentials) {
    const missing = [
      ['OSS_REGION', config.region],
      ['OSS_BUCKET', config.bucket],
      ['OSS_ACCESS_KEY_ID', config.accessKeyId],
      ['OSS_ACCESS_KEY_SECRET', config.accessKeySecret],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`缺少 OSS 配置：${missing.join(', ')}`);
  }

  return config;
};

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
};

const addHashToFilename = (relativePath, hash) => {
  const extension = path.posix.extname(relativePath);
  const stem = relativePath.slice(0, -extension.length);
  return `${stem}.${hash}${extension}`;
};

export const createAssetRecord = async (file, localUrl, config = getMediaConfig()) => {
  if (!localUrl.startsWith('/assets/')) throw new Error(`不是本地资源路径：${localUrl}`);
  const relativePath = localUrl.slice('/assets/'.length);
  const buffer = await readFile(file);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const fileStat = await stat(file);
  const extension = path.extname(file).toLowerCase();
  return {
    objectKey: `${config.objectPrefix}/${addHashToFilename(relativePath, sha256.slice(0, 12))}`,
    sha256,
    bytes: fileStat.size,
    contentType: mimeTypes[extension] || 'application/octet-stream',
    cacheControl: immutableCacheControl,
  };
};

export const createMediaManifest = async (config = getMediaConfig()) => {
  const files = (await walk(assetRoot))
    .filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const assets = {};
  const versionHash = createHash('sha256');
  versionHash.update(config.objectPrefix);
  let totalBytes = 0;

  for (const file of files) {
    const relativePath = normalizeSlash(path.relative(assetRoot, file));
    const localUrl = `/assets/${relativePath}`;
    const asset = await createAssetRecord(file, localUrl, config);
    totalBytes += asset.bytes;
    versionHash.update(localUrl);
    versionHash.update(asset.sha256);
    assets[localUrl] = asset;
  }

  return {
    schemaVersion: 1,
    version: versionHash.digest('hex').slice(0, 12),
    objectPrefix: config.objectPrefix,
    cdnBaseUrl: config.cdnBaseUrl,
    totalAssets: files.length,
    totalBytes,
    assets,
  };
};

export const writeMediaManifest = async (manifest) => {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

export const getLocalFileForUrl = (localUrl) => {
  if (!localUrl.startsWith('/assets/')) throw new Error(`不是本地资源路径：${localUrl}`);
  const relativePath = localUrl.slice('/assets/'.length);
  const target = path.resolve(assetRoot, relativePath);
  if (!target.startsWith(`${assetRoot}${path.sep}`)) throw new Error(`资源路径越界：${localUrl}`);
  return target;
};

export const getCdnUrl = (cdnBaseUrl, objectKey) => (
  `${normalizeBaseUrl(cdnBaseUrl)}/${trimSlashes(objectKey)}`
);

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
};
