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
  /**
   * Optional secondary URL template (with %WORD%) used solely to extract
   * audio pronunciation. The provider fetches this in parallel and prepends
   * UK/US audio buttons above the main content. Leave undefined if the
   * primary page already has audio.
   */
  audioUrlTemplate?: string;
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
      /* ── strip all laban colors; inherit app theme ── */
      * { color: inherit !important; background: none !important; }
      a { text-decoration: none; cursor: default; }

      /* ── phonetic / pronunciation stays muted ── */
      .color-black { color: inherit !important; }

      /* ── POS heading  →  matches Wiktionary's h2 style ── */
      .word_tab_title {
        font-size: 1em;
        font-weight: 600;
        margin-top: 1rem;
        margin-bottom: 0.25rem;
        border: none;
      }
      .word_tab_title.hidden, .slide_content.hidden { display: none; }

      /* ── phonetic tag (e.g. /klæs.meɪt/) ── */
      .green { font-style: italic; opacity: 0.75; font-size: 0.85em; }

      /* ── inline tag like [count], [noncount] ── */
      .bg-grey {
        font-size: 0.78em;
        opacity: 0.6;
        border: 1px solid currentColor;
        border-radius: 3px;
        padding: 0 4px;
        margin-right: 3px;
        vertical-align: middle;
      }

      /* ── definition lines ── */
      .world { margin: 0.35rem 0 0.35rem 1.25rem; }
      .color-orange { font-style: normal; }

      /* ── example sentences ── */
      .color-light-blue { font-style: italic; opacity: 0.75; font-size: 0.88em; }

      /* ── indented sub-items ── */
      .margin25 { margin-left: 1.25rem; }

      /* ── misc layout ── */
      .bold { font-weight: 600; }
      .font-large { font-size: 1em; }
      .m-top15 { margin-top: 0.6rem; }
      .m-top20 { margin-top: 0.9rem; }
      .dot-blue { font-weight: 600; margin-top: 0.6rem; }
      .fl { float: left; }
      .clr { clear: both; }
    `,
  },

  {
    id: 'ssr:cambridge-vi',
    name: 'Cambridge',
    urlTemplate: 'https://dictionary.cambridge.org/dictionary/english-vietnamese/%WORD%',
    audioUrlTemplate: 'https://dictionary.cambridge.org/dictionary/english/%WORD%',
    contentSelector: '.entry-body',
    stripSelectors: [
      'header',
      'nav',
      'footer',
      '#ad_leftslot',
      '#ad_leftslot2',
      '#ad_topslot',
      '#ad_btmslot',
      '#ad_rightslot',
      '#ad_rightslot2',
      '#ad_houseslot_a',
      '#ad_houseslot_b',
      '.cdo-dblclick-advert',
      '.hfr',
      '.share-button',
      '.daccord',
      '.entry-body__el-link',
      'script',
      'noscript',
    ],
    injectCSS: `
      /* ── strip Cambridge colors; inherit app theme ── */
      * { color: inherit !important; background: none !important; box-shadow: none !important; }
      a { text-decoration: none; cursor: default; }

      /* ── headword ── */
      .dhw { font-size: 1.2em; font-weight: 700; }

      /* ── part of speech  →  Wiktionary-style heading ── */
      .pos.dpos {
        font-size: 0.85em;
        font-weight: 600;
        font-style: italic;
        opacity: 0.8;
        margin-left: 0.4em;
      }

      /* ── sense group spacing ── */
      .dsense { margin-top: 0.9rem; }
      .dsense_h { font-size: 0.9em; font-weight: 600; margin-bottom: 0.3rem; opacity: 0.7; }

      /* ── definition block ── */
      .ddef_block { margin: 0.35rem 0 0.35rem 1rem; }

      /* ── English definition ── */
      .def.ddef_d { display: inline; }

      /* ── Vietnamese translation  →  slightly muted, semi-bold ── */
      .trans.dtrans {
        display: block;
        font-weight: 600;
        margin-top: 0.15rem;
        opacity: 0.95;
      }

      /* ── example sentences ── */
      .eg.deg {
        font-style: italic;
        opacity: 0.72;
        font-size: 0.88em;
        margin: 0.2rem 0 0.2rem 1rem;
      }

      /* ── hide region/usage labels ── */
      .lab.dlab, .v.dv { font-size: 0.78em; opacity: 0.6; margin-right: 3px; }
    `,
  },
];

export const getSSRDictionaryById = (id: string): SSRDictionaryConfig | undefined =>
  SSR_DICTIONARIES.find((d) => d.id === id);
