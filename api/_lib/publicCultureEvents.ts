import type { Category, CultureEvent, PriceTier } from '../../src/types';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

type PublicCultureRow = Record<string, unknown>;

type FetchCultureEventsOptions = {
  maxPages?: number;
  pageSize?: number;
};

export type CultureEventsPayload = {
  source: 'seoul-open-api';
  updatedAt: string;
  count: number;
  events: CultureEvent[];
};

const DEFAULT_ENDPOINT =
  'http://openapi.seoul.go.kr:8088/{key}/json/culturalEventInfo/{start}/{end}';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 5;
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_RETRY_COUNT = 2;

export async function buildCultureEventsPayload(
  options: FetchCultureEventsOptions = {},
): Promise<CultureEventsPayload> {
  const events = await fetchSeoulCultureEvents(options);

  return {
    source: 'seoul-open-api',
    updatedAt: new Date().toISOString(),
    count: events.length,
    events,
  };
}

export async function fetchSeoulCultureEvents({
  maxPages = DEFAULT_MAX_PAGES,
  pageSize = DEFAULT_PAGE_SIZE,
}: FetchCultureEventsOptions = {}) {
  const apiKey =
    process.env.SEOUL_OPEN_API_KEY ?? process.env.SEOUL_PUBLIC_DATA_API_KEY;

  if (!apiKey) {
    throw new Error('Missing SEOUL_OPEN_API_KEY environment variable.');
  }

  const rows: PublicCultureRow[] = [];
  let totalCount = Number.POSITIVE_INFINITY;

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * pageSize + 1;
    const end = start + pageSize - 1;
    const url = createCultureEventUrl(apiKey, start, end);
    const json = await requestPublicData(url);
    const { pageRows, total } = readCultureRows(json);

    rows.push(...pageRows);

    if (Number.isFinite(total)) {
      totalCount = total;
    }

    if (pageRows.length === 0 || rows.length >= totalCount) {
      break;
    }
  }

  return rows.map(toCultureEvent).filter(isCultureEvent);
}

export async function checkSeoulCultureEventApi() {
  const apiKey =
    process.env.SEOUL_OPEN_API_KEY ?? process.env.SEOUL_PUBLIC_DATA_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      endpoint: 'culturalEventInfo',
      hasApiKey: false,
      message: 'Missing SEOUL_OPEN_API_KEY environment variable.',
    };
  }

  const url = createCultureEventUrl(apiKey, 1, 1);

  try {
    const { status, statusText, body } = await requestPublicDataText(url);

    return {
      ok: status >= 200 && status < 300,
      endpoint: safeUrlForLog(url),
      hasApiKey: true,
      status,
      statusText,
      bodyPreview: body.slice(0, 700),
    };
  } catch (error) {
    return {
      ok: false,
      endpoint: safeUrlForLog(url),
      hasApiKey: true,
      message: formatError(error),
    };
  }
}

function createCultureEventUrl(apiKey: string, start: number, end: number) {
  const endpoint = process.env.SEOUL_CULTURE_EVENT_API_URL ?? DEFAULT_ENDPOINT;
  const encodedKey = encodeURIComponent(apiKey);
  const urlText = endpoint
    .replace('{key}', encodedKey)
    .replace('{authKey}', encodedKey)
    .replace('{start}', String(start))
    .replace('{StartIndex}', String(start))
    .replace('{end}', String(end))
    .replace('{EndIndex}', String(end));

  return new URL(urlText);
}

async function requestPublicData(url: URL) {
  const { body } = await requestPublicDataText(url);

  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw new Error(
      `Seoul culture API returned invalid JSON (${safeUrlForLog(url)}): ${formatError(error)}`,
    );
  }
}

async function requestPublicDataText(url: URL) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
    try {
      try {
        return await requestWithFetch(url);
      } catch (error) {
        lastError = error;
        return await requestWithNode(url);
      }
    } catch (error) {
      lastError = error;

      if (attempt === REQUEST_RETRY_COUNT) {
        break;
      }
    }
  }

  throw new Error(
    `Seoul culture API fetch failed for ${safeUrlForLog(url)}: ${formatError(lastError)}`,
  );
}

async function requestWithFetch(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Connection: 'close',
      'User-Agent': 'zero-won-poomgyeok/1.0',
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Seoul culture API request failed with ${response.status} ${response.statusText}. body=${body.slice(0, 300)}`,
    );
  }

  return {
    status: response.status,
    statusText: response.statusText,
    body,
  };
}

function requestWithNode(url: URL) {
  return new Promise<{ status: number; statusText: string; body: string }>(
    (resolve, reject) => {
      const requestFn = url.protocol === 'http:' ? httpRequest : httpsRequest;
      const request = requestFn(
        url.toString(),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Connection: 'close',
            'User-Agent': 'zero-won-poomgyeok/1.0',
          },
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on('data', (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const status = response.statusCode ?? 0;
            const statusText = response.statusMessage ?? '';

            if (status < 200 || status >= 300) {
              reject(
                new Error(
                  `Seoul culture API request failed with ${status} ${statusText}. body=${body.slice(0, 300)}`,
                ),
              );
              return;
            }

            resolve({
              status,
              statusText,
              body,
            });
          });
        },
      );

      request.on('error', reject);
      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.destroy(
          new Error(`Seoul culture API request timed out in ${REQUEST_TIMEOUT_MS}ms.`),
        );
      });
      request.end();
    },
  );
}

function readCultureRows(json: unknown) {
  const root = asRecord(json).culturalEventInfo;
  const container = asRecord(root);
  const pageRows = asArray(container.row)
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
  const total = toNumber(container.list_total_count);

  return {
    pageRows,
    total: total ?? Number.POSITIVE_INFINITY,
  };
}

function toCultureEvent(row: PublicCultureRow): CultureEvent | null {
  const title = pickString(row, ['TITLE']);
  const subtitle = pickString(row, ['PLACE', 'ORG_NAME', 'GUNAME']);
  const lat = pickNumber(row, ['LAT']);
  const lng = pickNumber(row, ['LOT']);

  if (!title || !subtitle || lat === null || lng === null) {
    return null;
  }

  const codeName = pickString(row, ['CODENAME']) ?? '행사';
  const guname = pickString(row, ['GUNAME']) ?? '서울';
  const feeText = pickString(row, ['USE_FEE']) ?? '';
  const isFree = isFreeEvent(row, feeText);
  const priceTier = toPriceTier(isFree, feeText);
  const startDate = toDateOnly(pickString(row, ['STRTDATE']) ?? pickString(row, ['DATE']));
  const endDate = toDateOnly(
    pickString(row, ['END_DATE']) ?? pickString(row, ['STRTDATE']) ?? pickString(row, ['DATE']),
  );
  const homepage =
    pickString(row, ['HMPG_ADDR', 'ORG_LINK']) ?? 'https://culture.seoul.go.kr';
  const image =
    pickString(row, ['MAIN_IMG']) ??
    'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=900&q=80';
  const description =
    pickString(row, ['PROGRAM', 'ETC_DESC']) ??
    `${guname}에서 진행되는 ${codeName} 문화행사입니다.`;

  return {
    id: createStableId(row, title, subtitle, lat, lng),
    title,
    subtitle,
    category: toCategory(codeName),
    priceTier,
    priceLabel: isFree ? '무료' : feeText || '요금 확인',
    reservationRequired: Boolean(homepage),
    thumbnail: image,
    images: [image],
    description,
    hashtags: createHashtags(codeName, guname, isFree),
    location: {
      address: [guname, subtitle].filter(Boolean).join(' · '),
      lat,
      lng,
    },
    schedule: {
      startDate: startDate ?? new Date().toISOString().slice(0, 10),
      endDate: endDate ?? startDate ?? new Date().toISOString().slice(0, 10),
      operatingHours: pickString(row, ['PRO_TIME']) ?? pickString(row, ['DATE']) ?? '시간 확인',
      closedDays: '기관별 상이',
    },
    rating: 4.5,
    reviewCount: 0,
    favoriteCount: 0,
    reservationUrl: homepage,
  };
}

function toCategory(value: string): Exclude<Category, '전체'> {
  if (value.includes('전시') || value.includes('미술')) {
    return '전시';
  }

  if (
    value.includes('공연') ||
    value.includes('음악') ||
    value.includes('콘서트') ||
    value.includes('무용') ||
    value.includes('연극')
  ) {
    return '공연';
  }

  if (
    value.includes('교육') ||
    value.includes('체험') ||
    value.includes('강좌') ||
    value.includes('클래스')
  ) {
    return '클래스';
  }

  if (value.includes('공간') || value.includes('관광')) {
    return '공간';
  }

  return '행사';
}

function isFreeEvent(row: PublicCultureRow, feeText: string) {
  const freeFlag = pickString(row, ['IS_FREE']);

  if (freeFlag?.includes('무료')) {
    return true;
  }

  return feeText.includes('무료') && !feeText.includes('유료');
}

function toPriceTier(isFree: boolean, feeText: string): PriceTier {
  if (isFree) {
    return 'free';
  }

  const prices = [...feeText.matchAll(/([\d,]+)\s*원/g)]
    .map((match) => Number(match[1].replaceAll(',', '')))
    .filter(Number.isFinite);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  if (minPrice !== null && minPrice <= 10000) {
    return 'cheap';
  }

  return 'mid';
}

function createHashtags(codeName: string, guname: string, isFree: boolean) {
  return [
    codeName.replaceAll('/', ''),
    guname,
    isFree ? '무료문화' : '문화행사',
  ].filter(Boolean);
}

function toDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}-\d{2}-\d{2}/);

  return match?.[0] ?? null;
}

function createStableId(
  row: PublicCultureRow,
  title: string,
  subtitle: string,
  lat: number,
  lng: number,
) {
  const source = [
    pickString(row, ['HMPG_ADDR', 'ORG_LINK']) ?? '',
    title,
    subtitle,
    lat.toFixed(8),
    lng.toFixed(8),
    pickString(row, ['STRTDATE']) ?? '',
  ].join(':');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `seoul-event-${hash.toString(36)}`;
}

function pickString(row: PublicCultureRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return null;
}

function pickNumber(row: PublicCultureRow, keys: string[]) {
  for (const key of keys) {
    const parsed = toNumber(row[key]);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replaceAll(',', ''));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asRecord(value: unknown): PublicCultureRow {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as PublicCultureRow;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function isCultureEvent(value: CultureEvent | null): value is CultureEvent {
  return value !== null;
}

function safeUrlForLog(url: URL) {
  const parts = url.pathname.split('/');

  if (parts.length > 2) {
    parts[1] = '***';
  }

  return `${url.origin}${parts.join('/')}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const cause =
      'cause' in error && error.cause
        ? ` cause=${JSON.stringify(error.cause)}`
        : '';

    return `${error.name}: ${error.message}${cause}`;
  }

  return String(error);
}
