import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  response.status(200).json({
    name: 'zero-won-poomgyeok',
    status: 'ok',
    endpoints: {
      libraries: '/api/libraries',
    },
  });
}
