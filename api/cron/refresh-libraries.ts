import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildLibrariesPayload } from '../_lib/publicLibraries';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    cronSecret &&
    request.headers.authorization !== `Bearer ${cronSecret}`
  ) {
    response.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  try {
    const payload = await buildLibrariesPayload({ maxPages: 1 });
    const appUrl = process.env.PUBLIC_APP_URL;
    let warmStatus: number | null = null;

    if (appUrl) {
      const warmResponse = await fetch(new URL('/api/libraries', appUrl));
      warmStatus = warmResponse.status;
    }

    response.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      countFromFirstPage: payload.count,
      warmStatus,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: 'LIBRARY_REFRESH_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to refresh public library data.',
    });
  }
}
