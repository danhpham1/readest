/**
 * Web-search provider.
 *
 * Renders an "Open in [name]" card inside the popup tab. The `<a href="…">`
 * uses the same pattern as `wikipediaProvider`'s "Read on Wikipedia" link,
 * so the popup's container click delegation routes the click through
 * Tauri's `openUrl` on native and `target="_blank"` works on the web build.
 *
 * Iframe embedding was considered and rejected — Google, Urban Dictionary,
 * and Merriam-Webster all set `X-Frame-Options: DENY/SAMEORIGIN`. v1
 * pragmatically opens externally; a Tauri-native webview overlay is a
 * follow-up if there's demand.
 */
import type { DictionaryProvider, DictionaryLookupOutcome, WebSearchEntry } from '../types';
import { substituteUrlTemplate } from '../webSearchTemplates';
import { isTauriAppPlatform, getAPIBaseUrl } from '@/services/environment';
import { stubTranslation as _ } from '@/utils/misc';

const isTauri = isTauriAppPlatform();

export interface CreateWebSearchProviderArgs {
  template: WebSearchEntry;
  /** Override the displayed label (e.g. localized built-in name). */
  label?: string;
}

const lookupInline = async (
  word: string,
  template: WebSearchEntry,
  ctx: Parameters<DictionaryProvider['lookup']>[1],
): Promise<DictionaryLookupOutcome> => {
  const targetUrl = substituteUrlTemplate(template.urlTemplate, word);
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

  for (const sel of ['script', 'noscript', 'link', 'style']) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const selector = template.contentSelector?.trim() || 'body';
  const content = doc.querySelector(selector);
  if (!content || !content.textContent?.trim()) {
    return { ok: false, reason: 'empty' };
  }

  content.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    a.removeAttribute('href');
    a.removeAttribute('onclick');
    a.style.cursor = 'default';
  });

  const host = document.createElement('div');
  host.style.cssText = `all: initial; display: block; color: ${ctx.fg ?? 'currentColor'}; background: transparent;`;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent =
    ':host { display: block; font-family: inherit; color: inherit; font-size: 0.9rem; line-height: 1.5; }';
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = content.innerHTML;
  shadow.appendChild(wrapper);

  ctx.container.appendChild(host);

  return { ok: true, headword: word, sourceLabel: template.name };
};

export const createWebSearchProvider = ({
  template,
  label,
}: CreateWebSearchProviderArgs): DictionaryProvider => ({
  id: template.id,
  kind: 'web',
  label: label ?? template.name,
  async lookup(word, ctx) {
    if (ctx.signal.aborted) return { ok: false, reason: 'error', message: 'aborted' };
    const trimmed = word.trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    if (template.renderInline) {
      return lookupInline(trimmed, template, ctx);
    }

    const url = substituteUrlTemplate(template.urlTemplate, trimmed);

    const hgroup = document.createElement('hgroup');
    const h1 = document.createElement('h1');
    h1.textContent = trimmed;
    h1.className = 'text-lg font-bold';
    hgroup.append(h1);
    const sub = document.createElement('p');
    sub.textContent = template.name;
    sub.className = 'text-sm italic not-eink:opacity-75';
    hgroup.append(sub);
    ctx.container.append(hgroup);

    const description = document.createElement('p');
    description.className = 'mt-3 text-sm';
    description.textContent = _('Open the search result in your browser:');
    ctx.container.append(description);

    const linkWrapper = document.createElement('p');
    linkWrapper.className = 'mt-3';
    const link = document.createElement('a');
    link.href = url;
    // Skip target="_blank" on Tauri; the popup's click delegation routes
    // through `openUrl`. iOS WebView's _blank handling fails otherwise.
    if (!isTauri) link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className =
      'btn btn-sm btn-primary normal-case text-primary-content not-eink:no-underline';
    // `stubTranslation` is just an extraction marker — the runtime value is
    // the key itself. We interpolate the provider name manually.
    link.textContent = _('Open in {{name}}').replace('{{name}}', template.name);
    linkWrapper.append(link);
    ctx.container.append(linkWrapper);

    const urlPreview = document.createElement('p');
    urlPreview.className = 'mt-3 text-base-content/60 break-all text-xs';
    urlPreview.textContent = url;
    ctx.container.append(urlPreview);

    return { ok: true, headword: trimmed, sourceLabel: template.name };
  },
});
