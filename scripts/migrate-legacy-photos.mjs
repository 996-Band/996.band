import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = process.cwd();
const legacyRef = process.env.LEGACY_REF || 'master';
const legacyRoot = 'static/images/memory';
const assetRoot = path.join(repoRoot, 'public/assets/photos');
const contentRoot = path.join(repoRoot, 'src/content/photos');

const events = [
  {
    slug: 'band-sideshow',
    title: '乐队花絮',
    summary: '996 Band 排练、演出与日常片段的幕后记录。',
    select: (name) => name.startsWith('sideshow-') || name === '20180412-4.jpg',
    cover: 'sideshow-2.jpg',
  },
  {
    slug: 'new-song-launch-2017',
    title: '新歌发表会',
    date: '2017-01-22',
    summary: '996 Band 新歌发表会现场记录。',
    prefix: '20170122',
  },
  {
    slug: 'ata-annual-meeting-2017',
    title: 'ATA 年会',
    date: '2017-02-22',
    summary: '996 Band 在 ATA 年会的现场记录。',
    prefix: '20170222',
  },
  {
    slug: 'taobao-wulin-2017',
    title: '淘宝武林大会',
    date: '2017-05-10',
    summary: '996 Band 在淘宝武林大会的现场记录。',
    prefix: '20170510',
  },
  {
    slug: 'fun-code-2017',
    title: 'Fun 码过来',
    date: '2017-06-19',
    summary: '996 Band 在 Fun 码过来的现场记录。',
    prefix: '20170619',
  },
  {
    slug: 'new-new-song-launch-2017',
    title: '新新歌发表会',
    date: '2017-12-12',
    summary: '996 Band 新新歌发表会现场记录。',
    prefix: '20171212',
  },
  {
    slug: 'd2-2017',
    title: '第十二届 D2 前端论坛',
    date: '2017-12-16',
    summary: '996 Band 在第十二届 D2 前端论坛的现场记录。',
    prefix: '20171216',
  },
  {
    slug: 'seeconf-2018',
    title: '第一届 SEEConf 支付宝体验科技大会',
    date: '2018-01-06',
    summary: '996 Band 在第一届 SEEConf 支付宝体验科技大会的现场记录。',
    prefix: '20180106',
  },
  {
    slug: 'aliyun-annual-meeting-2018',
    title: '阿里云年会',
    date: '2018-04-12',
    summary: '996 Band 在阿里云年会的现场影像记录。',
    select: (name) => name.startsWith('20180412-') && name !== '20180412-4.jpg',
    cover: '20180412-3.jpg',
  },
  {
    slug: 'ant-hackathon-2018',
    title: '蚂蚁 Hackathon',
    date: '2018-04-20',
    summary: '996 Band 在蚂蚁 Hackathon 的现场记录。',
    prefix: '20180420',
  },
  {
    slug: 'midsummer-night-2018',
    title: '仲夏之夜',
    date: '2018-09-06',
    summary: '996 Band 仲夏之夜现场记录。',
    prefix: '20180906',
  },
  {
    slug: 'vueconf-2018',
    title: 'VueConf',
    date: '2018-11-24',
    summary: '996 Band 在 VueConf 的现场记录。',
    prefix: '20181124',
  },
  {
    slug: 'd2-2019-january',
    title: '第十三届 D2 前端技术论坛',
    date: '2019-01-06',
    summary: '996 Band 在第十三届 D2 前端技术论坛的现场记录。',
    prefix: '20190106',
  },
  {
    slug: 'farewell-gougu-2019',
    title: '送别勾股',
    date: '2019-05-17',
    summary: '996 Band 送别勾股的纪念影像。',
    prefix: '20190517',
  },
  {
    slug: 'd2-2019-december',
    title: '第十四届 D2 前端技术论坛',
    date: '2019-12-14',
    summary: '996 Band 在第十四届 D2 前端技术论坛的现场记录。',
    prefix: '20191214',
  },
  {
    slug: 'd2-2020',
    title: '第十五届 D2 前端技术论坛',
    date: '2020-12-20',
    summary: '996 Band 在第十五届 D2 前端技术论坛的现场记录。',
    prefix: '20201220',
  },
  {
    slug: 'seeconf-2021',
    title: 'SEE Conf 2021',
    date: '2021-01-09',
    location: '杭州',
    summary: '一次关于体验技术、现场噪声和程序员幽默的回忆。',
    prefix: '20210109',
  },
  {
    slug: 'd2-2021',
    title: '第十六届 D2 前端技术论坛',
    date: '2021-12-18',
    summary: '996 Band 在第十六届 D2 前端技术论坛的现场记录。',
    prefix: '20211218',
  },
  {
    slug: 'd2-2022',
    title: '第十七届 D2 终端技术大会',
    date: '2022-12-17',
    summary: '996 Band 在第十七届 D2 终端技术大会的现场记录。',
    prefix: '20221217',
  },
  {
    slug: 'd2-2023',
    title: '第十八届 D2 终端技术大会',
    date: '2023-12-16',
    location: '杭州',
    summary: '终端技术大会现场，代码、舞台和音乐短暂地合在一起。',
    prefix: '20231216',
  },
  {
    slug: 'richlab-2024',
    title: '2024 RichLab 年会',
    date: '2024-01-26',
    location: '杭州',
    summary: '灯光、噪声、合唱和工程师乐队的一次年会现场。',
    prefix: '20240126',
  },
];

const naturalCompare = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const legacyPaths = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', legacyRef, legacyRoot],
  { cwd: repoRoot, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .filter((file) => !file.includes('/thumbnails/') && !file.endsWith('.DS_Store'));

const pathsByNormalizedName = new Map();
for (const legacyPath of legacyPaths) {
  const normalizedName = path.basename(legacyPath).toLowerCase();
  const paths = pathsByNormalizedName.get(normalizedName) || [];
  paths.push(legacyPath);
  pathsByNormalizedName.set(normalizedName, paths);
}

const sourcePathFor = (normalizedName) => {
  const candidates = pathsByNormalizedName.get(normalizedName);
  if (!candidates?.length) throw new Error(`Missing legacy media: ${normalizedName}`);
  return candidates.find((candidate) => path.basename(candidate) === normalizedName) || candidates[0];
};

const allMediaNames = [...pathsByNormalizedName.keys()].sort(naturalCompare);
const assignments = new Map();

for (const event of events) {
  const matches = allMediaNames.filter((name) => (
    event.select ? event.select(name) : name.startsWith(`${event.prefix}-`) || name === `${event.prefix}.jpg`
  ));
  if (!matches.length) throw new Error(`No media found for ${event.slug}`);
  event.mediaNames = matches;
  for (const name of matches) {
    if (assignments.has(name)) {
      throw new Error(`${name} assigned to both ${assignments.get(name)} and ${event.slug}`);
    }
    assignments.set(name, event.slug);
  }
}

const unassigned = allMediaNames.filter((name) => !assignments.has(name));
if (unassigned.length) throw new Error(`Unassigned legacy media: ${unassigned.join(', ')}`);

await mkdir(assetRoot, { recursive: true });
await mkdir(contentRoot, { recursive: true });
for (const event of events) {
  await rm(path.join(assetRoot, event.slug), { recursive: true, force: true });
  await rm(path.join(contentRoot, `${event.slug}.json`), { force: true });
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), '996band-photo-migration-'));
let imageCount = 0;
let videoCount = 0;

const readLegacyBlob = (legacyPath) => execFileSync(
  'git',
  ['show', `${legacyRef}:${legacyPath}`],
  { cwd: repoRoot, encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 },
);

try {
  for (const event of events) {
    const eventAssetRoot = path.join(assetRoot, event.slug);
    await mkdir(eventAssetRoot, { recursive: true });
    const media = [];

    for (const [index, normalizedName] of event.mediaNames.entries()) {
      const legacyPath = sourcePathFor(normalizedName);
      const source = readLegacyBlob(legacyPath);
      const extension = path.extname(normalizedName);
      const stem = path.basename(normalizedName, extension);
      const alt = `${event.title}现场记录 ${index + 1}`;

      if (extension === '.mp4') {
        const temporaryVideo = path.join(temporaryRoot, `${event.slug}-${stem}-source.mp4`);
        const outputVideo = path.join(eventAssetRoot, `${stem}.mp4`);
        const temporaryPoster = path.join(temporaryRoot, `${event.slug}-${stem}-poster.jpg`);
        await writeFile(temporaryVideo, source);

        const remux = spawnSync('ffmpeg', [
          '-y', '-loglevel', 'error', '-i', temporaryVideo,
          '-c', 'copy', '-movflags', '+faststart', outputVideo,
        ]);
        if (remux.status !== 0) {
          await writeFile(outputVideo, source);
        }

        const poster = spawnSync('ffmpeg', [
          '-y', '-loglevel', 'error', '-ss', '0.4', '-i', outputVideo,
          '-frames:v', '1', '-q:v', '2', temporaryPoster,
        ]);
        if (poster.status !== 0) throw new Error(`Unable to create poster for ${normalizedName}`);

        const posterSource = await readFile(temporaryPoster);
        const posterResult = await sharp(posterSource)
          .resize({ width: 1280, withoutEnlargement: true })
          .webp({ quality: 82, effort: 5, smartSubsample: true })
          .toBuffer({ resolveWithObject: true });
        const thumbnailResult = await sharp(posterSource)
          .resize({ width: 720, withoutEnlargement: true })
          .webp({ quality: 74, effort: 5, smartSubsample: true })
          .toBuffer({ resolveWithObject: true });
        const posterName = `${stem}-poster.webp`;
        const thumbnailName = `${stem}-thumb.webp`;
        await writeFile(path.join(eventAssetRoot, posterName), posterResult.data);
        await writeFile(path.join(eventAssetRoot, thumbnailName), thumbnailResult.data);

        media.push({
          type: 'video',
          src: `/assets/photos/${event.slug}/${stem}.mp4`,
          thumbnail: `/assets/photos/${event.slug}/${thumbnailName}`,
          poster: `/assets/photos/${event.slug}/${posterName}`,
          alt,
          width: posterResult.info.width,
          height: posterResult.info.height,
        });
        videoCount += 1;
        continue;
      }

      const fullResult = await sharp(source)
        .rotate()
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      const thumbnailResult = await sharp(source)
        .rotate()
        .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 74, effort: 5, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      const outputName = `${stem}.webp`;
      const thumbnailName = `${stem}-thumb.webp`;
      await writeFile(path.join(eventAssetRoot, outputName), fullResult.data);
      await writeFile(path.join(eventAssetRoot, thumbnailName), thumbnailResult.data);

      media.push({
        type: 'image',
        src: `/assets/photos/${event.slug}/${outputName}`,
        thumbnail: `/assets/photos/${event.slug}/${thumbnailName}`,
        alt,
        width: fullResult.info.width,
        height: fullResult.info.height,
      });
      imageCount += 1;
    }

    const requestedCover = event.cover?.toLowerCase();
    const cover = requestedCover
      ? media[event.mediaNames.findIndex((name) => name === requestedCover)]
      : media.find((item) => item.type === 'image') || media[0];
    if (!cover) throw new Error(`Unable to select cover for ${event.slug}`);

    const entry = {
      title: event.title,
      slug: event.slug,
      ...(event.date ? { date: event.date } : {}),
      ...(event.location ? { location: event.location } : {}),
      summary: event.summary,
      cover: {
        src: cover.type === 'video' ? cover.poster : cover.src,
        thumbnail: cover.thumbnail,
        alt: `${event.title}相册封面`,
        width: cover.width,
        height: cover.height,
      },
      media,
    };
    await writeFile(
      path.join(contentRoot, `${event.slug}.json`),
      `${JSON.stringify(entry, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(`Migrated ${imageCount} images and ${videoCount} videos into ${events.length} photo collections.`);
