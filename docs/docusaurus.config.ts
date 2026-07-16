import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'askRepo',
  tagline: 'Chat with any GitHub repository using natural language.',
  favicon: 'img/favicon.ico',

  // Future flags
  future: {
    v4: true,
  },

  // Project URL configuration
  url: 'https://github.com',
  baseUrl: '/',

  organizationName: 'ayussh-2',
  projectName: 'repo-assistant',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Enable Mermaid support in markdown
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Serve docs at root / instead of /docs/
        },
        blog: false, // Disable the blog feature
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'askRepo',
      logo: {
        alt: 'askRepo Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          href: 'https://github.com/ayussh-2/repo-assistant',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
