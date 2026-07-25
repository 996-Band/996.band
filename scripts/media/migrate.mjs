import { readFile } from 'node:fs/promises';
import OSS from 'ali-oss';
import {
  createMediaManifest,
  formatBytes,
  getCdnUrl,
  getLocalFileForUrl,
  getMediaConfig,
  loadLocalEnvironment,
  manifestPath,
} from './common.mjs';

await loadLocalEnvironment();
const shouldUpload = process.argv.includes('--upload');
const skipCdnVerify = process.argv.includes('--skip-cdn-verify');
const config = getMediaConfig({ requireCredentials: shouldUpload });
const generated = await createMediaManifest(config);
const stored = JSON.parse(await readFile(manifestPath, 'utf8'));

if (JSON.stringify(stored) !== JSON.stringify(generated)) {
  throw new Error('媒体清单不是最新版本，请先运行 pnpm media:manifest');
}

const entries = Object.entries(generated.assets);
console.log(shouldUpload ? 'OSS migration upload' : 'OSS migration dry-run');
console.log(`- Target: ${config.cdnBaseUrl}/${config.objectPrefix}/`);
console.log(`- Assets: ${entries.length}`);
console.log(`- Total: ${formatBytes(generated.totalBytes)}`);
console.log(`- Manifest version: ${generated.version}`);

if (!shouldUpload) {
  console.log('\nSample plan:');
  for (const [localUrl, asset] of entries.slice(0, 12)) {
    console.log(`  ${localUrl} -> ${asset.objectKey}`);
  }
  if (entries.length > 12) console.log(`  ... and ${entries.length - 12} more`);
  console.log('\nDry-run only. Add --upload after OSS configuration is verified.');
  process.exit(0);
}

const client = new OSS({
  region: config.region,
  ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  bucket: config.bucket,
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  ...(config.stsToken ? { stsToken: config.stsToken } : {}),
  secure: true,
  timeout: 120_000,
});

let uploaded = 0;
let skipped = 0;
const failures = [];

const objectExists = async (asset) => {
  try {
    const result = await client.head(asset.objectKey);
    const remoteHash = result.res?.headers?.['x-oss-meta-sha256'];
    const remoteSize = Number(result.res?.headers?.['content-length'] || 0);
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

const uploadEntry = async ([localUrl, asset], index) => {
  try {
    if (await objectExists(asset)) {
      skipped += 1;
      console.log(`[${index + 1}/${entries.length}] exists ${asset.objectKey}`);
      return;
    }
    await client.put(asset.objectKey, getLocalFileForUrl(localUrl), {
      headers: {
        'Cache-Control': asset.cacheControl,
        'Content-Type': asset.contentType,
        'x-oss-meta-sha256': asset.sha256,
      },
    });
    if (!(await objectExists(asset))) throw new Error(`上传后无法读取：${asset.objectKey}`);
    if (!skipCdnVerify) {
      const cdnUrl = getCdnUrl(config.cdnBaseUrl, asset.objectKey);
      const response = await fetch(cdnUrl, { method: 'HEAD', redirect: 'follow' });
      if (!response.ok) throw new Error(`CDN 校验失败 ${response.status}：${cdnUrl}`);
    }
    uploaded += 1;
    console.log(`[${index + 1}/${entries.length}] uploaded ${asset.objectKey}`);
  } catch (error) {
    failures.push({ localUrl, objectKey: asset.objectKey, message: error.message });
    console.error(`[${index + 1}/${entries.length}] failed ${asset.objectKey}: ${error.message}`);
  }
};

const concurrency = 4;
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < entries.length) {
    const index = cursor;
    cursor += 1;
    await uploadEntry(entries[index], index);
  }
}));

console.log(`\nCompleted: ${uploaded} uploaded / ${skipped} existing / ${failures.length} failed`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
