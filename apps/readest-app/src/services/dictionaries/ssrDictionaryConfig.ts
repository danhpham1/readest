/**
 * Config-driven SSR dictionary providers.
 *
 * To add a new dictionary site, append an entry to SSR_DICTIONARIES.
 * No other code changes needed.
 *
 * Fields:
 *   id             — unique provider id, must start with "ssr:"
 *   name           — display name in the tab strip
 *   urlTemplate    — URL with %WORD% placeholder
 *   contentSelector — CSS selector for the content block to extract
 *   stripSelectors  — CSS selectors to remove before rendering (ads, nav, etc.)
 *   injectCSS       — scoped CSS to restore site styles inside the popup
 */

export interface SSRDictionaryConfig {
  id: string;
  name: string;
  urlTemplate: string;
  contentSelector: string;
  stripSelectors?: string[];
  injectCSS?: string;
}

export const SSR_DICTIONARIES: SSRDictionaryConfig[] = [
  {
    id: 'ssr:laban',
    name: 'Laban',
    urlTemplate: 'https://dict.laban.vn/find?type=1&query=%WORD%',
    contentSelector: '#slide_show',
    stripSelectors: [
      '.app',
      '#extension_recommend_download',
      '.input_area',
      'script',
      '.fr.tab.slide_select',
      '.sp_uk',
      '.sp_us',
      '#sound',
    ],
    injectCSS: `
      h2 { font-size: 1.1em; font-weight: bold; margin-bottom: 6px; }
      .color-black { color: inherit; }
      .color-orange { color: #e65100; font-style: italic; }
      .color-light-blue { color: #1565c0; font-size: 0.9em; }
      .green { color: #2e7d32; font-weight: 600; }
      .bold { font-weight: bold; }
      .bg-grey { background: rgba(128,128,128,0.15); padding: 3px 8px; border-radius: 4px; display: inline-block; }
      .font-large { font-size: 1em; }
      .margin25 { margin-left: 20px; }
      .m-top15 { margin-top: 10px; }
      .m-top20 { margin-top: 14px; }
      .dot-blue { color: #1565c0; font-weight: 600; margin-top: 10px; }
      .fl { float: left; }
      .clr { clear: both; }
      .world { padding-bottom: 8px; margin-bottom: 8px; }
      .word_tab_title { margin-bottom: 8px; }
      .word_tab_title.hidden { display: none; }
      .slide_content.hidden { display: none; }
      a { color: inherit; text-decoration: none; cursor: default; }
    `,
  },

  // Add more SSR dictionaries below — example (disabled):
  //
  // {
  //   id: 'ssr:vdict',
  //   name: 'VDict',
  //   urlTemplate: 'https://vdict.com/%WORD%,1,0,0.html',
  //   contentSelector: '#bodyContent',
  //   stripSelectors: ['.adsbygoogle', '#header', '#footer', 'script'],
  //   injectCSS: `...`,
  // },
];

export const getSSRDictionaryById = (id: string): SSRDictionaryConfig | undefined =>
  SSR_DICTIONARIES.find((d) => d.id === id);
