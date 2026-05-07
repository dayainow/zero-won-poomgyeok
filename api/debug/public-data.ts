import type { VercelRequest, VercelResponse } from '@vercel/node';

import { checkPublicLibraryApi } from '../_lib/publicLibraries';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json(await checkPublicLibraryApi());
}
