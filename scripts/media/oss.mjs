import OSS from 'ali-oss';
import {
  createAssetRecord,
  createMediaManifest,
  getCdnUrl,
  getMediaConfig,
  writeMediaManifest,
} from './common.mjs';

export const createOssClient = (config = getMediaConfig({ requireCredentials: true })) => new OSS({
  region: config.region,
  ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  bucket: config.bucket,
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  ...(config.stsToken ? { stsToken: config.stsToken } : {}),
  secure: true,
  timeout: 120_000,
});

const objectExists = async (client, asset) => {
  try {
    const result = await client.head(asset.objectKey);
    const headers = result.res?.headers || {};
    const remoteHash = headers['x-oss-meta-sha256'];
    const remoteSize = Number(headers['content-length'] || 0);
    if (remoteHash && remoteHash !== asset.sha256) {
      throw new Error(`远端哈希冲突：${asset.objectKey}`);
    }
    if (remoteSize && remoteSize !== asset.bytes) {
      throw new Error(`远端文件大小冲突：${asset.objectKey}`);
    }
    return true;
  } catch (error) {
    if (error.status === 404 || error.code === 'NoSuchKey') return false;
    throw error;
  }
};

export const uploadAssetFiles = async (
  files,
  {
    config = getMediaConfig({ requireCredentials: true }),
    verifyCdn = true,
    onProgress = () => {},
  } = {},
) => {
  const client = createOssClient(config);
  const results = [];

  for (const [index, item] of files.entries()) {
    const asset = await createAssetRecord(item.file, item.localUrl, config);
    const existing = await objectExists(client, asset);
    if (!existing) {
      await client.put(asset.objectKey, item.file, {
        headers: {
          'Cache-Control': asset.cacheControl,
          'Content-Type': asset.contentType,
          'x-oss-meta-sha256': asset.sha256,
        },
      });
      if (!(await objectExists(client, asset))) throw new Error(`上传后无法读取：${asset.objectKey}`);
    }
    if (verifyCdn) {
      const url = getCdnUrl(config.cdnBaseUrl, asset.objectKey);
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (!response.ok) throw new Error(`CDN 校验失败 ${response.status}：${url}`);
    }
    results.push({ localUrl: item.localUrl, ...asset, existing });
    onProgress({ index: index + 1, total: files.length, localUrl: item.localUrl, asset, existing });
  }

  return results;
};

export const publishGeneratedAssets = async (files) => {
  const config = getMediaConfig();
  if (!config.publicAssetBaseUrl && !config.uploadEnabled) return { mode: 'local', results: [] };
  if (!config.uploadEnabled) {
    throw new Error('站点已启用 CDN，但内容管理器 OSS 上传尚未启用，请设置 OSS_UPLOAD_ENABLED=true');
  }
  getMediaConfig({ requireCredentials: true });
  const results = await uploadAssetFiles(files, { config });
  return { mode: 'oss', results };
};

export const refreshMediaManifest = async () => {
  const manifest = await createMediaManifest(getMediaConfig());
  await writeMediaManifest(manifest);
  return manifest;
};
