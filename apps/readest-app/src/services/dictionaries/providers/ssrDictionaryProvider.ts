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

    const base = getAPIBaseUrl();
    const targetUrl = config.urlTemplate.replace('%WORD%', encodeURIComponent(trimmed));
    const proxyUrl = `${base}/dict/ssr-proxy?url=${encodeURIComponent(targetUrl)}`;

    // Fetch main content + optional audio page in parallel
    const audioProxyUrl = config.audioUrlTemplate
      ? `${base}/dict/ssr-proxy?url=${encodeURIComponent(
          config.audioUrlTemplate.replace('%WORD%', encodeURIComponent(trimmed)),
        )}`
      : null;

    let html: string;
    let audioHtml: string | null = null;
    try {
      const fetches: [Promise<Response>, Promise<Response> | null] = [
        fetch(proxyUrl, { signal: ctx.signal }),
        audioProxyUrl ? fetch(audioProxyUrl, { signal: ctx.signal }) : null,
      ];
      const [mainRes, audioRes] = await Promise.all(fetches);
      if (!mainRes || !mainRes.ok) {
        return { ok: false, reason: 'error', message: `Proxy returned ${mainRes?.status}` };
      }
      html = await mainRes.text();
      if (audioRes?.ok) audioHtml = await audioRes.text();
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

    // Strip onclick handlers upfront; hrefs are handled after shadow DOM
    // is built so we can wire navigable links to ctx.onNavigate.
    content.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      a.removeAttribute('onclick');
    });

    // Extract UK / US audio URLs from the secondary page
    interface AudioEntry {
      label: string;
      src: string;
    }
    const audioEntries: AudioEntry[] = [];
    if (audioHtml) {
      const audioDoc = parser.parseFromString(audioHtml, 'text/html');
      for (const [label, sel] of [
        ['UK', '.uk.dpron-i'],
        ['US', '.us.dpron-i'],
      ] as const) {
        const src = audioDoc.querySelector(`${sel} source[type="audio/mpeg"]`)?.getAttribute('src');
        if (src) {
          audioEntries.push({
            label,
            src: src.startsWith('http') ? src : `https://dictionary.cambridge.org${src}`,
          });
        }
      }
    }

    // Build shadow root
    const host = document.createElement('div');
    host.style.cssText = `all: initial; display: block; color: ${ctx.fg ?? 'currentColor'}; background: transparent;`;
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; font-family: inherit; color: inherit; font-size: 0.9rem; line-height: 1.5; }
      .audio-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; }
      .audio-btn {
        display: inline-flex; align-items: center; gap: 0.3rem;
        font-size: 0.78rem; padding: 2px 8px; border-radius: 4px; cursor: pointer;
        border: 1px solid currentColor; opacity: 0.75; background: none; color: inherit;
        font-family: inherit;
      }
      .audio-btn:hover { opacity: 1; }
      ${config.injectCSS ?? ''}
    `;
    shadow.appendChild(style);

    // Prepend audio buttons if we have audio
    if (audioEntries.length > 0) {
      const row = document.createElement('div');
      row.className = 'audio-row';
      for (const { label, src } of audioEntries) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'audio-btn';
        btn.textContent = `▶ ${label}`;
        // Route audio through the proxy to bypass CORS on Cambridge's CDN
        const proxiedSrc = `${base}/dict/ssr-proxy?url=${encodeURIComponent(src)}`;
        btn.addEventListener('click', () => {
          new Audio(proxiedSrc).play().catch(() => {});
        });
        row.appendChild(btn);
      }
      shadow.appendChild(row);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content.innerHTML;

    // Wire up navigable dictionary links; neutralize everything else.
    // Cambridge word hrefs look like /dictionary/english-vietnamese/expanse
    // or /dictionary/english/expanse — extract the final path segment as word.
    wrapper.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const match = href.match(/\/dictionary\/[^/?#]+\/([^/?#]+)/);
      if (match && ctx.onNavigate) {
        const linkedWord = decodeURIComponent(match[1]!.replace(/_/g, ' '));
        a.removeAttribute('href');
        a.style.cssText += 'cursor:pointer; text-decoration:underline; opacity:0.85;';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          ctx.onNavigate!(linkedWord);
        });
      } else {
        a.removeAttribute('href');
        a.style.cursor = 'default';
      }
    });

    shadow.appendChild(wrapper);

    ctx.container.appendChild(host);

    return { ok: true, headword: trimmed, sourceLabel: config.name };
  },
});
