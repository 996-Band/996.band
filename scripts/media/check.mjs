import { readFile } from 'node:fs/promises';
import {
  createMediaManifest,
  formatBytes,
  getMediaConfig,
  loadLocalEnvironment,
  manifestPath,
} from './common.mjs';

await loadLocalEnvironment();
const config = getMediaConfig();
const generated = await createMediaManifest(config);
const stored = JSON.parse(await readFile(manifestPath, 'utf8'));
const manifestCurrent = JSON.stringify(stored) === JSON.stringify(generated);

console.log('996 Band media configuration');
console.log(`- CDN: ${config.cdnBaseUrl}`);
console.log(`- Public CDN enabled: ${config.publicAssetBaseUrl ? 'yes' : 'no (local fallback)'}`);
console.log(`- Object prefix: ${config.objectPrefix}`);
console.log(`- Region configured: ${config.region ? 'yes' : 'no'}`);
console.log(`- Bucket configured: ${config.bucket ? 'yes' : 'no'}`);
console.log(`- Credentials configured: ${config.accessKeyId && config.accessKeySecret ? 'yes' : 'no'}`);
console.log(`- Manager OSS upload enabled: ${config.uploadEnabled ? 'yes' : 'no'}`);
console.log(`- Inventory: ${generated.totalAssets} assets / ${formatBytes(generated.totalBytes)}`);
console.log(`- Manifest current: ${manifestCurrent ? 'yes' : 'no — run pnpm media:manifest'}`);

if (!manifestCurrent) process.exitCode = 1;
