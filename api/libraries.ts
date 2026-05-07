import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildLibrariesPayload } from './_lib/publicLibraries';

const ONE_DAY_SECONDS = 60 * 60 * 24;
const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7;

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const payload = await buildLibrariesPayload();

    response.setHeader(
      'Cache-Control',
      `public, s-maxage=${ONE_DAY_SECONDS}, stale-while-revalidate=${ONE_WEEK_SECONDS}`,
    );
    response.status(200).json(payload);
  } catch (error) {
    response.setHeader('Cache-Control', 'no-store');
    response.status(500).json({
      error: 'LIBRARY_DATA_FETCH_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch public library data.',
    });
  }
}
