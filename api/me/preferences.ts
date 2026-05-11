import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  getViewerPayload,
  parseJsonBody,
  requireViewer,
  sendMethodNotAllowed,
  updatePreferencesForViewer,
} from '../_lib/userSystem';

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
      error: 'PREFERENCES_ENDPOINT_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to process preferences request.',
    });
  }
}
