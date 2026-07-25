import { readFile } from 'node:fs/promises';
import {
  formatBytes,
  getMediaConfig,
  loadLocalEnvironment,
  manifestPath,
} from './common.mjs';
import { createOssClient } from './oss.mjs';

await loadLocalEnvironment();

const shouldDelete = process.argv.includes('--delete');
const olderThanArgument = process.argv.find((argument) => argument.startsWith('--older-than-days='));
const olderThanDays = Number(olderThanArgument?.split('=')[1] || 30);
if (!Number.isFinite(olderThanDays) || olderThanDays < 1) {
  throw new Error('--older-than-days 必须是大于等于 1 的数字');
}
if (shouldDelete && process.env.OSS_DELETE_ENABLED !== 'true') {
  throw new Error('删除保护已开启。确认清单后设置 OSS_DELETE_ENABLED=true 才能执行删除');
}

const config = getMediaConfig({ requireCredentials: true });
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const referenced = new Set(Object.values(manifest.assets).map((asset) => asset.objectKey));
const prefix = `${config.objectPrefix}/`;
const client = createOssClient(config);
const remoteObjects = [];
let marker;

do {
  const result = await client.list({
    prefix,
    ...(marker ? { marker } : {}),
    'max-keys': 1000,
  });
  remoteObjects.push(...(result.objects || []));
  marker = result.isTruncated ? result.nextMarker : undefined;
} while (marker);

const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
const orphaned = remoteObjects.filter((object) => !referenced.has(object.name));
const eligible = orphaned.filter((object) => {
  const modifiedAt = new Date(object.lastModified || 0).getTime();
  return Number.isFinite(modifiedAt) && modifiedAt <= cutoff;
});
const eligibleBytes = eligible.reduce((total, object) => total + Number(object.size || 0), 0);

console.log(shouldDelete ? 'OSS media garbage collection' : 'OSS media garbage collection dry-run');
console.log(`- Prefix: ${prefix}`);
console.log(`- Referenced: ${referenced.size}`);
console.log(`- Remote objects: ${remoteObjects.length}`);
console.log(`- Unreferenced: ${orphaned.length}`);
console.log(`- Eligible (older than ${olderThanDays} days): ${eligible.length} / ${formatBytes(eligibleBytes)}`);

for (const object of eligible.slice(0, 20)) {
  console.log(`  ${object.name}`);
}
if (eligible.length > 20) console.log(`  ... and ${eligible.length - 20} more`);

if (!shouldDelete) {
  console.log('\nDry-run only. Review this list before adding --delete.');
  process.exit(0);
}

for (let index = 0; index < eligible.length; index += 100) {
  const names = eligible.slice(index, index + 100).map((object) => object.name);
  if (names.length) await client.deleteMulti(names, { quiet: true });
}

console.log(`\nDeleted ${eligible.length} unreferenced objects.`);
