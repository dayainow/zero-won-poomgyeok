import type { VercelRequest, VercelResponse } from '@vercel/node';

import { checkSeoulCultureEventApi } from '../_lib/publicCultureEvents';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json(await checkSeoulCultureEventApi());
}
