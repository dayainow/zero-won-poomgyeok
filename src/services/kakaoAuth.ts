import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { isSupabaseAuthConfigured, supabase } from './authClient';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_AUTH_PATH = 'auth/callback';

export function getKakaoRedirectUri() {
  return makeRedirectUri({
    path: KAKAO_AUTH_PATH,
    scheme: 'zero-won-poomgyeok',
  });
}

export function isKakaoAuthConfigured() {
  return isSupabaseAuthConfigured();
}

function parseAuthRedirectUrl(url: string) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryPart =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';
  const params = new URLSearchParams(hashPart || queryPart);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    code: params.get('code'),
    error: params.get('error'),
    error_description: params.get('error_description'),
  };
}

export async function signInWithKakao() {
  if (!supabase) {
    throw new Error('Supabase Auth 환경변수가 아직 설정되지 않았습니다.');
  }

  const redirectTo = getKakaoRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('카카오 로그인 URL을 받지 못했습니다.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: true,
  });

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('카카오 로그인이 취소되었습니다.');
  }

  if (result.type !== 'success') {
    throw new Error('카카오 로그인을 완료하지 못했습니다.');
  }

  const params = parseAuthRedirectUrl(result.url);

  if (params.error) {
    throw new Error(params.error_description ?? params.error);
  }

  if (params.access_token && params.refresh_token) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (sessionError) {
      throw sessionError;
    }

    return sessionData;
  }

  if (params.code) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(params.code);

    if (sessionError) {
      throw sessionError;
    }

    return sessionData;
  }

  throw new Error('카카오 로그인 세션을 만들지 못했습니다. Supabase Redirect URL 설정을 확인해 주세요.');
}
