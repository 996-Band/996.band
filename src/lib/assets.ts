import mediaManifest from '../data/media-assets.json';

type MediaManifestEntry = {
  objectKey: string;
};

type MediaManifest = {
  cdnBaseUrl: string;
  assets: Record<string, MediaManifestEntry>;
};

type PhotoMedia = {
  src: string;
  thumbnail: string;
  poster?: string;
};

const manifest = mediaManifest as MediaManifest;
const configuredBaseUrl = String(import.meta.env.PUBLIC_ASSET_BASE_URL || '').trim().replace(/\/+$/g, '');
const defaultBaseUrl = String(manifest.cdnBaseUrl || '').trim().replace(/\/+$/g, '');

export const assetBaseUrl = configuredBaseUrl;
export const cdnAssetMode = Boolean(configuredBaseUrl);

const isAbsoluteUrl = (value: string) => /^(?:[a-z]+:)?\/\//i.test(value)
  || value.startsWith('data:')
  || value.startsWith('blob:');

export const assetUrl = (value: string) => {
  if (!value || isAbsoluteUrl(value) || !cdnAssetMode) return value;

  if (value.startsWith('/assets/')) {
    const entry = manifest.assets[value];
    return entry ? `${configuredBaseUrl}/${entry.objectKey}` : value;
  }

  if (value.startsWith(`${mediaManifest.objectPrefix}/`)) {
    return `${configuredBaseUrl}/${value}`;
  }

  return value;
};

export const defaultCdnAssetUrl = (value: string) => {
  const entry = manifest.assets[value];
  return entry && defaultBaseUrl ? `${defaultBaseUrl}/${entry.objectKey}` : value;
};

export const resolvePhotoMedia = <T extends PhotoMedia>(item: T): T => ({
  ...item,
  src: assetUrl(item.src),
  thumbnail: assetUrl(item.thumbnail),
  ...(item.poster ? { poster: assetUrl(item.poster) } : {}),
});
