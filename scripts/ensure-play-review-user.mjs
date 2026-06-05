#!/usr/bin/env node
/**
 * Play Console 검수용 계정 생성·이메일 확인
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/ensure-play-review-user.mjs
 *
 * service role key: Supabase → Project Settings → API → service_role
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.PLAY_REVIEW_EMAIL ?? 'playreview@olalab.kr';
const password = process.env.PLAY_REVIEW_PASSWORD ?? '123456';

if (!url || !serviceKey) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function findUser() {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.msg ?? body.message ?? res.statusText);
  }
  return body.users?.[0] ?? null;
}

async function createUser() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { purpose: 'google_play_review' },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.msg ?? body.message ?? res.statusText);
  }
  return body;
}

async function confirmUser(userId) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.msg ?? body.message ?? res.statusText);
  }
  return body;
}

async function verifyLogin() {
  const anon =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    return;
  }
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Login check failed: ${body.msg ?? body.error_code}`);
  }
  console.log('Login check OK');
}

const existing = await findUser();
if (existing) {
  console.log(`User exists: ${existing.id}`);
  if (!existing.email_confirmed_at) {
    await confirmUser(existing.id);
    console.log('Email confirmed');
  } else {
    console.log('Already confirmed');
  }
} else {
  const user = await createUser();
  console.log(`Created: ${user.id}`);
}

await verifyLogin();
console.log(`Ready: ${email}`);
