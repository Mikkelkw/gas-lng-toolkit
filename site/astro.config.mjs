import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  output: 'static',
  site: 'https://gas-lng-toolkit.pages.dev',
  trailingSlash: 'ignore',
});
