import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const notices = defineCollection({
  loader: glob({ pattern: '**/*.{yml,yaml,json}', base: './src/content/notices' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    type: z.enum(['live', 'article', 'release', 'site']),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(),
    enabled: z.boolean().default(true),
    priority: z.number().default(0),
    href: z.string(),
    summary: z.string(),
  }),
});

const photoMedia = z.object({
  type: z.enum(['image', 'video']),
  src: z.string(),
  thumbnail: z.string(),
  poster: z.string().optional(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const photos = defineCollection({
  loader: glob({ pattern: '**/*.{yml,yaml,json}', base: './src/content/photos' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date().optional(),
    location: z.string().optional(),
    summary: z.string(),
    cover: z.object({
      src: z.string(),
      thumbnail: z.string(),
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    media: z.array(photoMedia).min(1),
  }),
});

const albums = defineCollection({
  loader: glob({ pattern: '**/*.{yml,yaml,json}', base: './src/content/albums' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    type: z.enum(['single', 'ep', 'album']),
    date: z.coerce.date().optional(),
    summary: z.string().default(''),
    href: z.string().default(''),
    enabled: z.boolean().default(true),
    priority: z.number().int().default(0),
    cover: z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  }),
});

export const collections = { articles, notices, photos, albums };
