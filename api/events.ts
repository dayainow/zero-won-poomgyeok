import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildCultureEventsPayload } from './_lib/publicCultureEvents';
import { CULTURE_EVENTS } from '../src/data/events';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const payload = await buildCultureEventsPayload();

    response.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    response.status(200).json(payload);
  } catch (error) {
    response.setHeader('Cache-Control', 'public, s-maxage=300');
    response.status(200).json({
      source: 'mock-culture-events',
      updatedAt: new Date().toISOString(),
      count: CULTURE_EVENTS.length,
      warning:
        error instanceof Error
          ? error.message
          : 'Failed to fetch Seoul culture events.',
      events: CULTURE_EVENTS,
    });
  }
}
