import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://996.band',
  integrations: [
    sitemap({
      filter: (page) => page !== 'https://996.band/404/',
    }),
  ],
});
