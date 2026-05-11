import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  getViewerPayload,
  parseJsonBody,
  requireViewer,
  saveRecentSearchForViewer,
  sendMethodNotAllowed,
} from '../_lib/userSystem';

type RecentSearchBody = {
  query?: string;
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store');

  try {
    const viewer = await requireViewer(request, response);

    if (!viewer) {
      return;
    }

    if (request.method === 'GET') {
      const payload = await getViewerPayload(viewer);
      response.status(200).json({
        recentSearches: payload.recentSearches,
      });
      return;
    }

    if (request.method === 'POST') {
      const body = parseJsonBody<RecentSearchBody>(request.body ?? {});

      if (!body.query?.trim()) {
        response.status(400).json({
          error: 'INVALID_QUERY',
          message: 'query is required.',
        });
        return;
      }

      await saveRecentSearchForViewer(viewer, body.query);

      const payload = await getViewerPayload(viewer);
      response.status(200).json({
        recentSearches: payload.recentSearches,
      });
      return;
    }

    sendMethodNotAllowed(response, ['GET', 'POST']);
  } catch (error) {
    response.status(500).json({
      error: 'RECENT_SEARCHES_ENDPOINT_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to process recent searches request.',
    });
  }
}
