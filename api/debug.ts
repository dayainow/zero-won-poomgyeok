import type { VercelRequest, VercelResponse } from '@vercel/node';

import { checkSeoulCultureEventApi } from './_lib/publicCultureEvents';
import { checkPublicLibraryApi } from './_lib/publicLibraries';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');

  const target =
    typeof request.query.target === 'string' ? request.query.target : 'culture-events';

  if (target === 'public-data') {
    response.status(200).json(await checkPublicLibraryApi());
    return;
  }

  response.status(200).json(await checkSeoulCultureEventApi());
}
