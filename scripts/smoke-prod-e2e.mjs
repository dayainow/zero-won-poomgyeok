#!/usr/bin/env node
/**
 * 프로덕션 API 스모크 테스트
 * 사용: node scripts/smoke-prod-e2e.mjs
 * 로그인 포함: SMOKE_TEST_EMAIL=... SMOKE_TEST_PASSWORD=... node scripts/smoke-prod-e2e.mjs
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'https://zero-won-poomgyeok.vercel.app';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SMOKE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SMOKE_SUPABASE_KEY;

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

async function getSupabaseToken(email, password) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase env가 없습니다.');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error_description ?? json.msg ?? `auth ${response.status}`);
  }
  return json.access_token;
}

async function main() {
  console.log(`\nSmoke test target: ${BASE}\n`);

  const events = await request('/api/events');
  record(
    'GET /api/events',
    events.response.ok && Array.isArray(events.json?.events),
    `status=${events.response.status} count=${events.json?.count ?? 0}`,
  );

  const eventId =
    events.json?.events?.[0]?.id ?? 'seoul-event-n8idoz';

  const reviews = await request(
    `/api/events/${encodeURIComponent(eventId)}/reviews?limit=3`,
  );
  record(
    'GET /api/events/{id}/reviews',
    reviews.response.ok && Array.isArray(reviews.json?.reviews),
    `status=${reviews.response.status}`,
  );

  const unauthPost = await request('/api/me/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      eventTitle: 'Smoke test event',
      rating: 5,
      comment: 'smoke',
    }),
  });
  record(
    'POST /api/me/reviews (비로그인)',
    unauthPost.response.status === 401,
    `status=${unauthPost.response.status}`,
  );

  const privacy = await fetch(`${BASE}/privacy-policy.html`);
  record(
    'GET /privacy-policy.html',
    privacy.ok && (await privacy.text()).includes('개인정보처리방침'),
    `status=${privacy.status}`,
  );

  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;

  if (email && password) {
    try {
      const token = await getSupabaseToken(email, password);
      record('Supabase 로그인', Boolean(token), email);

      const create = await request('/api/me/reviews', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          eventTitle: events.json?.events?.[0]?.title ?? 'Smoke test',
          rating: 4,
          comment: `smoke ${Date.now()}`,
        }),
      });
      const createdOk = create.response.status === 201 && create.json?.review?.id;
      record(
        'POST /api/me/reviews (로그인)',
        createdOk || create.response.status === 429,
        `status=${create.response.status}`,
      );

      const mine = await request('/api/me/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      record(
        'GET /api/me/reviews',
        mine.response.ok && Array.isArray(mine.json?.reviews),
        `status=${mine.response.status} count=${mine.json?.reviews?.length ?? 0}`,
      );
    } catch (error) {
      record('로그인 플로우', false, error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log('\nSKIP  로그인 플로우 — SMOKE_TEST_EMAIL/PASSWORD 미설정');
  }

  const failed = results.filter((item) => !item.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
