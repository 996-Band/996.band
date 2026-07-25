import {
  createMediaManifest,
  formatBytes,
  getMediaConfig,
  loadLocalEnvironment,
  manifestPath,
  writeMediaManifest,
} from './common.mjs';

await loadLocalEnvironment();
const manifest = await createMediaManifest(getMediaConfig());
await writeMediaManifest(manifest);

console.log(
  `Media manifest ${manifest.version}: ${manifest.totalAssets} assets / ${formatBytes(manifest.totalBytes)}`,
);
console.log(`Written: ${manifestPath}`);
