/**
 * SSR dictionary proxy.
 *
 * Fetches an external dictionary page server-side so the browser never hits
 * cross-origin restrictions. Accepts any https URL — this proxy is
 * self-hosted, so the trust boundary is the deployment itself.
 *
 * GET /api/dict/ssr-proxy?url=<encoded-url>
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

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

  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'vi,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    }

    // Pass through the upstream Content-Type so audio/binary files are
    // served correctly (not mangled as text/html).
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

    const buffer = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('[ssr-proxy] fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch upstream' });
  }
};

export default handler;
