import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  deleteSavedEventForViewer,
  requireViewer,
  sendMethodNotAllowed,
} from '../../_lib/userSystem';

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

    if (request.method !== 'DELETE') {
      sendMethodNotAllowed(response, ['DELETE']);
      return;
    }

    const eventId = Array.isArray(request.query.eventId)
      ? request.query.eventId[0]
      : request.query.eventId;

    if (!eventId) {
      response.status(400).json({
        error: 'MISSING_EVENT_ID',
        message: 'eventId is required.',
      });
      return;
    }

    await deleteSavedEventForViewer(viewer, eventId);

    response.status(200).json({
      ok: true,
      eventId,
    });
  } catch (error) {
    response.status(500).json({
      error: 'SAVED_EVENT_DELETE_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to delete saved event.',
    });
  }
}
