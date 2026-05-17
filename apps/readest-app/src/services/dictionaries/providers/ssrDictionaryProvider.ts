/**
 * Generic SSR dictionary provider factory.
 *
 * Given an SSRDictionaryConfig it:
 *   1. Fetches the target page via /api/dict/ssr-proxy (bypasses CORS)
 *   2. Parses the HTML in the browser with DOMParser
 *   3. Strips unwanted elements (ads, nav, scripts)
 *   4. Extracts the configured contentSelector block
 *   5. Injects optional scoped CSS + rendered HTML into ctx.container
 *
 * All config lives in ssrDictionaryConfig.ts — no code changes needed
 * to add a new site.
 */
import type { DictionaryProvider, DictionaryLookupOutcome } from '../types';
import type { SSRDictionaryConfig } from '../ssrDictionaryConfig';
import { getAPIBaseUrl } from '@/services/environment';

export const createSSRDictionaryProvider = (config: SSRDictionaryConfig): DictionaryProvider => ({
  id: config.id,
  kind: 'builtin',
  label: config.name,

  async lookup(word, ctx): Promise<DictionaryLookupOutcome> {
    if (ctx.signal.aborted) return { ok: false, reason: 'error', message: 'aborted' };

    const trimmed = word.trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    const targetUrl = config.urlTemplate.replace('%WORD%', encodeURIComponent(trimmed));
    const proxyUrl = `${getAPIBaseUrl()}/dict/ssr-proxy?url=${encodeURIComponent(targetUrl)}`;

    let html: string;
    try {
      const response = await fetch(proxyUrl, { signal: ctx.signal });
      if (!response.ok) {
        return { ok: false, reason: 'error', message: `Proxy returned ${response.status}` };
      }
      html = await response.text();
    } catch (err) {
      if (ctx.signal.aborted) return { ok: false, reason: 'error', message: 'aborted' };
      return { ok: false, reason: 'error', message: String(err) };
    }

    if (ctx.signal.aborted) return { ok: false, reason: 'error', message: 'aborted' };

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted elements first
    const stripTargets = [...(config.stripSelectors ?? []), 'script', 'noscript', 'link', 'style'];
    for (const sel of stripTargets) {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    }

    const content = doc.querySelector(config.contentSelector);
    if (!content || !content.textContent?.trim()) {
      return { ok: false, reason: 'empty' };
    }

    // Neutralize all javascript: links so clicks don't throw errors
    content.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      a.removeAttribute('href');
      a.removeAttribute('onclick');
      a.style.cursor = 'default';
    });

    // Inject scoped CSS inside a shadow root so it doesn't bleed into
    // the rest of the popup UI
    const host = document.createElement('div');
    host.style.cssText = 'all: initial; display: block;';
    const shadow = host.attachShadow({ mode: 'open' });

    if (config.injectCSS) {
      const style = document.createElement('style');
      // Base reset so the shadow subtree inherits the app's font/color
      style.textContent = `
        :host { display: block; font-family: inherit; color: inherit; font-size: 0.9rem; line-height: 1.5; }
        ${config.injectCSS}
      `;
      shadow.appendChild(style);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content.innerHTML;
    shadow.appendChild(wrapper);

    ctx.container.appendChild(host);

    return { ok: true, headword: trimmed, sourceLabel: config.name };
  },
});
