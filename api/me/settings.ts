import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  getViewerPayload,
  parseJsonBody,
  requireViewer,
  saveRecentSearchForViewer,
  sendMethodNotAllowed,
  updatePreferencesForViewer,
} from '../_lib/userSystem';

type RecentSearchBody = {
  query?: string;
};

type PreferencesBody = {
  defaultRegion?: string;
  eventPushEnabled?: boolean;
  marketingEnabled?: boolean;
  pushEnabled?: boolean;
  radiusKm?: number;
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

    const resource =
      typeof request.query.resource === 'string' ? request.query.resource : 'preferences';

    if (resource === 'recent-searches') {
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
      return;
    }

    if (request.method === 'GET') {
      const payload = await getViewerPayload(viewer);
      response.status(200).json({
        preferences: payload.preferences,
      });
      return;
    }

    if (request.method === 'PATCH') {
      await updatePreferencesForViewer(
        viewer,
        parseJsonBody<PreferencesBody>(request.body ?? {}),
      );

      const payload = await getViewerPayload(viewer);
      response.status(200).json({
        preferences: payload.preferences,
      });
      return;
    }

    sendMethodNotAllowed(response, ['GET', 'PATCH']);
  } catch (error) {
    response.status(500).json({
      error: 'SETTINGS_ENDPOINT_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to process settings request.',
    });
  }
}
