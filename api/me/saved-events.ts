import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { CultureEvent } from '../../src/types';
import {
  getViewerPayload,
  parseJsonBody,
  requireViewer,
  saveEventForViewer,
  sendMethodNotAllowed,
} from '../_lib/userSystem';

type SaveEventBody = {
  event?: CultureEvent;
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
        savedEventIds: payload.savedEventIds,
        savedEvents: payload.savedEvents,
      });
      return;
    }

    if (request.method === 'POST') {
      const { event } = parseJsonBody<SaveEventBody>(request.body ?? {});

      if (!event?.id || !event.title) {
        response.status(400).json({
          error: 'INVALID_EVENT',
          message: 'A CultureEvent snapshot is required.',
        });
        return;
      }

      response.status(200).json({
        savedEvent: await saveEventForViewer(viewer, event),
      });
      return;
    }

    sendMethodNotAllowed(response, ['GET', 'POST']);
  } catch (error) {
    response.status(500).json({
      error: 'SAVED_EVENTS_ENDPOINT_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to process saved events request.',
    });
  }
}
