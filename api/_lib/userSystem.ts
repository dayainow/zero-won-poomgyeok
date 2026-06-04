import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { Category, CultureEvent } from '../../src/types';

type DatabaseProfile = {
  id: string;
  auth_user_id: string;
  nickname: string;
  district: string | null;
  avatar_url: string | null;
  interests: string[];
  marketing_consent: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DatabasePreferences = {
  user_id: string;
  default_region: string;
  radius_km: number;
  push_enabled: boolean;
  event_push_enabled: boolean;
  marketing_enabled: boolean;
  updated_at: string;
};

type DatabaseSavedEvent = {
  id: string;
  user_id: string;
  event_id: string;
  event_source: string;
  event_title: string;
  event_category: string;
  event_location: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_snapshot: CultureEvent;
  saved_at: string;
};

type DatabaseRecentSearch = {
  id: string;
  query: string;
  searched_at: string;
};

type DatabaseReview = {
  id: string;
  user_id: string;
  event_id: string;
  event_title: string;
  rating: number;
  comment: string;
  status: 'visible' | 'hidden';
  hidden_reason: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
};

type DatabaseReviewReport = {
  id: string;
  review_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
};

type ReviewInput = {
  eventId: string;
  eventTitle: string;
  rating: number;
  comment: string;
};

type ReviewQueryOptions = {
  limit?: number;
};

const REVIEW_COMMENT_MAX_LENGTH = 300;
const REVIEW_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const REVIEW_DEFAULT_LIMIT = 20;
const REVIEW_MAX_LIMIT = 50;
const REPORT_HIDE_THRESHOLD = 3;

export type ViewerContext = {
  profile: DatabaseProfile;
  supabase: SupabaseClient;
  user: User;
};

export function isUserSystemConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export async function requireViewer(
  request: VercelRequest,
  response: VercelResponse,
): Promise<ViewerContext | null> {
  if (!isUserSystemConfigured()) {
    response.status(500).json({
      error: 'USER_SYSTEM_NOT_CONFIGURED',
      message: 'Supabase URL or publishable key is missing.',
    });
    return null;
  }

  const token = getBearerToken(request);

  if (!token) {
    response.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Bearer token is required.',
    });
    return null;
  }

  const supabase = createSupabaseForToken(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    response.status(401).json({
      error: 'UNAUTHORIZED',
      message: error?.message ?? 'Invalid Supabase session.',
    });
    return null;
  }

  const profile = await getOrCreateProfile(supabase, user);
  await ensurePreferences(supabase, profile.id);

  return {
    profile,
    supabase,
    user,
  };
}

export async function getViewerPayload({ profile, supabase }: ViewerContext) {
  const [preferencesResult, savedEventsResult, recentSearchesResult] =
    await Promise.all([
      supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle<DatabasePreferences>(),
      supabase
        .from('user_saved_events')
        .select('*')
        .eq('user_id', profile.id)
        .order('saved_at', { ascending: false })
        .returns<DatabaseSavedEvent[]>(),
      supabase
        .from('user_recent_searches')
        .select('id, query, searched_at')
        .eq('user_id', profile.id)
        .order('searched_at', { ascending: false })
        .limit(10)
        .returns<DatabaseRecentSearch[]>(),
    ]);

  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  if (savedEventsResult.error) {
    throw savedEventsResult.error;
  }

  if (recentSearchesResult.error) {
    throw recentSearchesResult.error;
  }

  const savedEvents = savedEventsResult.data ?? [];

  return {
    profile: toPublicProfile(profile),
    preferences: toPublicPreferences(preferencesResult.data),
    savedEventIds: savedEvents.map((event) => event.event_id),
    savedEvents: savedEvents.map(toPublicSavedEvent),
    recentSearches: (recentSearchesResult.data ?? []).map((item) => ({
      id: item.id,
      query: item.query,
      searchedAt: item.searched_at,
    })),
  };
}

export async function saveEventForViewer(
  { profile, supabase }: ViewerContext,
  event: CultureEvent,
) {
  const { data, error } = await supabase
    .from('user_saved_events')
    .upsert(
      {
        user_id: profile.id,
        event_id: event.id,
        event_source: 'seoul-open-api',
        event_title: event.title,
        event_category: event.category,
        event_location: event.location.address,
        event_start_date: event.schedule.startDate,
        event_end_date: event.schedule.endDate,
        event_snapshot: event,
      },
      {
        onConflict: 'user_id,event_id',
      },
    )
    .select('*')
    .single<DatabaseSavedEvent>();

  if (error) {
    throw error;
  }

  return toPublicSavedEvent(data);
}

export async function deleteSavedEventForViewer(
  { profile, supabase }: ViewerContext,
  eventId: string,
) {
  const { error } = await supabase
    .from('user_saved_events')
    .delete()
    .eq('user_id', profile.id)
    .eq('event_id', eventId);

  if (error) {
    throw error;
  }
}

export async function updatePreferencesForViewer(
  { profile, supabase }: ViewerContext,
  preferences: {
    defaultRegion?: string;
    eventPushEnabled?: boolean;
    marketingEnabled?: boolean;
    pushEnabled?: boolean;
    radiusKm?: number;
  },
) {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: profile.id,
      ...(typeof preferences.defaultRegion === 'string'
        ? { default_region: preferences.defaultRegion }
        : {}),
      ...(typeof preferences.radiusKm === 'number'
        ? { radius_km: preferences.radiusKm }
        : {}),
      ...(typeof preferences.pushEnabled === 'boolean'
        ? { push_enabled: preferences.pushEnabled }
        : {}),
      ...(typeof preferences.eventPushEnabled === 'boolean'
        ? { event_push_enabled: preferences.eventPushEnabled }
        : {}),
      ...(typeof preferences.marketingEnabled === 'boolean'
        ? { marketing_enabled: preferences.marketingEnabled }
        : {}),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    },
  );

  if (error) {
    throw error;
  }
}

export async function saveRecentSearchForViewer(
  { profile, supabase }: ViewerContext,
  query: string,
) {
  const normalized = query.trim();

  if (!normalized) {
    return;
  }

  const { error } = await supabase.from('user_recent_searches').upsert(
    {
      query: normalized,
      searched_at: new Date().toISOString(),
      user_id: profile.id,
    },
    {
      onConflict: 'user_id,query',
    },
  );

  if (error) {
    throw error;
  }
}

export async function createReviewForViewer(
  { supabase, user }: ViewerContext,
  input: ReviewInput,
) {
  const normalized = normalizeReviewInput(input);
  validateReviewInput(normalized);
  await enforceDuplicateReviewWindow(
    supabase,
    user.id,
    normalized.eventId,
    REVIEW_DUPLICATE_WINDOW_MS,
  );

  const now = new Date().toISOString();
  const insertStartedAt = Date.now();
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      comment: normalized.comment,
      created_at: now,
      event_id: normalized.eventId,
      event_title: normalized.eventTitle,
      rating: normalized.rating,
      updated_at: now,
      user_id: user.id,
    })
    .select('*')
    .single<DatabaseReview>();

  if (error) {
    throw error;
  }
  warnIfSlowQuery('create_review_insert', insertStartedAt, {
    eventId: normalized.eventId,
    userId: user.id,
  });

  return toPublicReview(data);
}

export async function getMyReviews(
  { supabase, user }: ViewerContext,
  options: ReviewQueryOptions = {},
) {
  const limit = normalizeLimit(options.limit);
  const queryStartedAt = Date.now();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<DatabaseReview[]>();

  if (error) {
    throw error;
  }
  warnIfSlowQuery('get_my_reviews', queryStartedAt, {
    limit,
    userId: user.id,
  });

  return (data ?? []).map(toPublicReview);
}

export async function getEventReviews(eventId: string, options: ReviewQueryOptions = {}) {
  const normalizedEventId = eventId.trim();
  const limit = normalizeLimit(options.limit);

  if (!normalizedEventId) {
    throw new Error('eventId is required.');
  }

  const supabase = createSupabaseForToken(null);
  const queryStartedAt = Date.now();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('event_id', normalizedEventId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<DatabaseReview[]>();

  if (error) {
    throw error;
  }
  warnIfSlowQuery('get_event_reviews', queryStartedAt, {
    eventId: normalizedEventId,
    limit,
  });

  return (data ?? []).map(toPublicReview);
}

export async function createReviewReportForViewer(
  { supabase, user }: ViewerContext,
  input: {
    reason: string;
    reviewId: string;
  },
) {
  const reviewId = input.reviewId.trim();
  const reason = input.reason.trim();

  if (!reviewId) {
    throw new Error('reviewId is required.');
  }

  if (reason.length > 300) {
    throw new Error('reason must be 300 characters or fewer.');
  }

  const targetReview = await supabase
    .from('reviews')
    .select('id, status')
    .eq('id', reviewId)
    .maybeSingle<{ id: string; status: 'visible' | 'hidden' }>();

  if (targetReview.error) {
    throw targetReview.error;
  }

  if (!targetReview.data) {
    throw new Error('해당 후기를 찾을 수 없습니다.');
  }

  if (targetReview.data.status === 'hidden') {
    return {
      alreadyHidden: true,
      reportCount: REPORT_HIDE_THRESHOLD,
    };
  }

  const reportInsert = await supabase
    .from('review_reports')
    .insert({
      review_id: reviewId,
      reporter_user_id: user.id,
      reason,
    })
    .select('id, review_id, reporter_user_id, reason, created_at')
    .single<DatabaseReviewReport>();

  if (reportInsert.error) {
    if (String(reportInsert.error.code) === '23505') {
      throw new Error('이미 신고한 후기입니다.');
    }
    throw reportInsert.error;
  }

  const countResult = await supabase
    .from('review_reports')
    .select('*', { count: 'exact', head: true })
    .eq('review_id', reviewId);

  if (countResult.error) {
    throw countResult.error;
  }

  const reportCount = countResult.count ?? 0;
  const hideTriggered = reportCount >= REPORT_HIDE_THRESHOLD;

  if (hideTriggered) {
    const now = new Date().toISOString();
    const hideResult = await supabase
      .from('reviews')
      .update({
        hidden_at: now,
        hidden_reason: 'community_reports',
        status: 'hidden',
        updated_at: now,
      })
      .eq('id', reviewId)
      .eq('status', 'visible');

    if (hideResult.error) {
      throw hideResult.error;
    }
  }

  return {
    alreadyHidden: false,
    hideTriggered,
    reportCount,
  };
}

export function sendMethodNotAllowed(
  response: VercelResponse,
  methods: string[],
) {
  response.setHeader('Allow', methods.join(', '));
  response.status(405).json({
    error: 'METHOD_NOT_ALLOWED',
    message: `Use ${methods.join(' or ')} for this endpoint.`,
  });
}

export function parseJsonBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }

  return body as T;
}

function createSupabaseForToken(token: string | null) {
  const authorization = token ? `Bearer ${token}` : undefined;

  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: authorization
        ? {
            Authorization: authorization,
          }
        : undefined,
    },
  });
}

async function getOrCreateProfile(supabase: SupabaseClient, user: User) {
  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle<DatabaseProfile>();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  const nickname =
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    `user-${user.id.slice(0, 8)}`;
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: user.id,
      nickname,
      district: '서울',
      interests: ['전시', '공연'],
    })
    .select('*')
    .single<DatabaseProfile>();

  if (error) {
    throw error;
  }

  return data;
}

async function ensurePreferences(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
    },
    {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw error;
  }
}

function getBearerToken(request: VercelRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}

function getSupabaseUrl() {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL.');
  }

  return value;
}

function getSupabasePublishableKey() {
  const value =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  return value;
}

function toPublicProfile(profile: DatabaseProfile) {
  return {
    id: profile.id,
    nickname: profile.nickname,
    district: profile.district,
    avatarUrl: profile.avatar_url,
    interests: profile.interests as Category[],
    marketingConsent: profile.marketing_consent,
    onboardingCompletedAt: profile.onboarding_completed_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function toPublicPreferences(preferences: DatabasePreferences | null) {
  return {
    defaultRegion: preferences?.default_region ?? '서울',
    radiusKm: preferences?.radius_km ?? 5,
    pushEnabled: preferences?.push_enabled ?? true,
    eventPushEnabled: preferences?.event_push_enabled ?? true,
    marketingEnabled: preferences?.marketing_enabled ?? false,
    updatedAt: preferences?.updated_at ?? null,
  };
}

function toPublicSavedEvent(savedEvent: DatabaseSavedEvent) {
  return {
    id: savedEvent.id,
    eventId: savedEvent.event_id,
    eventSource: savedEvent.event_source,
    eventTitle: savedEvent.event_title,
    eventCategory: savedEvent.event_category,
    eventLocation: savedEvent.event_location,
    eventStartDate: savedEvent.event_start_date,
    eventEndDate: savedEvent.event_end_date,
    eventSnapshot: savedEvent.event_snapshot,
    savedAt: savedEvent.saved_at,
  };
}

function toPublicReview(review: DatabaseReview) {
  return {
    comment: review.comment,
    createdAt: review.created_at,
    eventId: review.event_id,
    eventTitle: review.event_title,
    id: review.id,
    rating: review.rating,
    status: review.status,
    updatedAt: review.updated_at,
  };
}

function normalizeReviewInput(input: ReviewInput) {
  return {
    comment: String(input.comment ?? '').trim(),
    eventId: String(input.eventId ?? '').trim(),
    eventTitle: String(input.eventTitle ?? '').trim(),
    rating: Number(input.rating),
  };
}

function validateReviewInput(input: ReviewInput) {
  if (!input.eventId) {
    throw new Error('eventId is required.');
  }

  if (!input.eventTitle) {
    throw new Error('eventTitle is required.');
  }

  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('rating must be between 1 and 5.');
  }

  if (input.comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    throw new Error(`comment must be ${REVIEW_COMMENT_MAX_LENGTH} characters or fewer.`);
  }
}

async function enforceDuplicateReviewWindow(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  windowMs: number,
) {
  const { data, error } = await supabase
    .from('reviews')
    .select('created_at')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  if (error) {
    throw error;
  }

  if (!data?.created_at) {
    return;
  }

  const createdAt = new Date(data.created_at).getTime();
  if (Number.isNaN(createdAt)) {
    return;
  }

  if (Date.now() - createdAt < windowMs) {
    throw new Error('같은 행사에 대한 후기는 잠시 후 다시 작성해 주세요.');
  }
}

function normalizeLimit(input: number | undefined) {
  if (!Number.isFinite(input)) {
    return REVIEW_DEFAULT_LIMIT;
  }

  const value = Math.trunc(input as number);
  if (value < 1) {
    return 1;
  }

  if (value > REVIEW_MAX_LIMIT) {
    return REVIEW_MAX_LIMIT;
  }

  return value;
}

function warnIfSlowQuery(event: string, startedAt: number, meta: Record<string, unknown>) {
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < 250) {
    return;
  }
  console.warn(
    JSON.stringify({
      event,
      level: 'warn',
      message: 'Slow query detected',
      elapsedMs,
      timestamp: new Date().toISOString(),
      ...meta,
    }),
  );
}
