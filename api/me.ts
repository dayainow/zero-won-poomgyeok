import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  getViewerPayload,
  parseJsonBody,
  requireViewer,
  sendMethodNotAllowed,
} from './_lib/userSystem';

type PatchMeBody = {
  district?: string;
  interests?: string[];
  marketingConsent?: boolean;
  nickname?: string;
  onboardingCompleted?: boolean;
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
      response.status(200).json(await getViewerPayload(viewer));
      return;
    }

    if (request.method === 'PATCH') {
      const body = parseJsonBody<PatchMeBody>(request.body ?? {});
      const patch = {
        ...(typeof body.nickname === 'string' && body.nickname.trim()
          ? { nickname: body.nickname.trim() }
          : {}),
        ...(typeof body.district === 'string'
          ? { district: body.district.trim() || null }
          : {}),
        ...(Array.isArray(body.interests) ? { interests: body.interests } : {}),
        ...(typeof body.marketingConsent === 'boolean'
          ? { marketing_consent: body.marketingConsent }
          : {}),
        ...(body.onboardingCompleted
          ? { onboarding_completed_at: new Date().toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      };

      const { error } = await viewer.supabase
        .from('profiles')
        .update(patch)
        .eq('id', viewer.profile.id);

      if (error) {
        throw error;
      }

      const refreshed = await requireViewer(request, response);

      if (!refreshed) {
        return;
      }

      response.status(200).json(await getViewerPayload(refreshed));
      return;
    }

    sendMethodNotAllowed(response, ['GET', 'PATCH']);
  } catch (error) {
    response.status(500).json({
      error: 'ME_ENDPOINT_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to process current user request.',
    });
  }
}
