/**
 * SSR dictionary proxy.
 *
 * Fetches an external dictionary page server-side so the browser never hits
 * cross-origin restrictions. Only URLs whose hostname matches a configured
 * SSR_DICTIONARIES entry are allowed — everything else gets a 403.
 *
 * GET /api/dict/ssr-proxy?url=<encoded-url>
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { SSR_DICTIONARIES } from '@/services/dictionaries/ssrDictionaryConfig';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

const getAllowedHostnames = (): Set<string> => {
  const hostnames = SSR_DICTIONARIES.map((d) => {
    try {
      return new URL(d.urlTemplate.replace('%WORD%', 'test')).hostname;
    } catch {
      return null;
    }
  }).filter((h): h is string => h !== null);
  return new Set(hostnames);
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(decodeURIComponent(url));
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const allowed = getAllowedHostnames();
  if (!allowed.has(targetUrl.hostname)) {
    return res.status(403).json({ error: `Domain not allowed: ${targetUrl.hostname}` });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    }

    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[ssr-proxy] fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch upstream' });
  }
};

export default handler;
