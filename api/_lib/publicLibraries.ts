import type { Library, LibraryHours } from '../../src/types';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

type PublicDataRow = Record<string, unknown>;

type FetchLibrariesOptions = {
  maxPages?: number;
  pageSize?: number;
};

export type LibrariesPayload = {
  source: 'public-data';
  updatedAt: string;
  count: number;
  libraries: Library[];
};

const DEFAULT_ENDPOINT = 'https://api.data.go.kr/openapi/tn_pubr_public_lbrry_api';
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_RETRY_COUNT = 2;

export async function buildLibrariesPayload(
  options: FetchLibrariesOptions = {},
): Promise<LibrariesPayload> {
  const libraries = await fetchPublicLibraries(options);

  return {
    source: 'public-data',
    updatedAt: new Date().toISOString(),
    count: libraries.length,
    libraries,
  };
}

export async function fetchPublicLibraries({
  maxPages = DEFAULT_MAX_PAGES,
  pageSize = DEFAULT_PAGE_SIZE,
}: FetchLibrariesOptions = {}) {
  const serviceKey =
    process.env.PUBLIC_DATA_SERVICE_KEY ?? process.env.DATA_GO_KR_SERVICE_KEY;

  if (!serviceKey) {
    throw new Error('Missing PUBLIC_DATA_SERVICE_KEY environment variable.');
  }

  const endpoint = process.env.PUBLIC_DATA_LIBRARY_API_URL ?? DEFAULT_ENDPOINT;
  const rows: PublicDataRow[] = [];
  let totalCount = Number.POSITIVE_INFINITY;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const url = new URL(endpoint);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', String(pageSize));
    url.searchParams.set('type', 'json');

    const json = await requestPublicData(url);
    const { pageRows, total } = readRows(json);

    rows.push(...pageRows);

    if (Number.isFinite(total)) {
      totalCount = total;
    }

    if (pageRows.length === 0 || rows.length >= totalCount) {
      break;
    }
  }

  return rows.map(toLibrary).filter(isLibrary);
}

export async function checkPublicLibraryApi() {
  const serviceKey =
    process.env.PUBLIC_DATA_SERVICE_KEY ?? process.env.DATA_GO_KR_SERVICE_KEY;

  if (!serviceKey) {
    return {
      ok: false,
      endpoint: DEFAULT_ENDPOINT,
      hasServiceKey: false,
      message: 'Missing PUBLIC_DATA_SERVICE_KEY environment variable.',
    };
  }

  const endpoint = process.env.PUBLIC_DATA_LIBRARY_API_URL ?? DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '1');
  url.searchParams.set('type', 'json');

  try {
    const { status, statusText, body } = await requestPublicDataText(url);

    return {
      ok: status >= 200 && status < 300,
      endpoint: `${url.origin}${url.pathname}`,
      hasServiceKey: true,
      status,
      statusText,
      bodyPreview: body.slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      endpoint: `${url.origin}${url.pathname}`,
      hasServiceKey: true,
      message: formatError(error),
    };
  }
}

async function requestPublicData(url: URL) {
  const { body } = await requestPublicDataText(url);

  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw new Error(
      `Public data returned invalid JSON (${url.origin}${url.pathname}): ${formatError(error)}`,
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
    `Public data fetch failed for ${url.origin}${url.pathname}: ${formatError(lastError)}`,
  );
}

async function requestWithFetch(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Connection': 'close',
      'User-Agent': 'zero-won-poomgyeok/1.0',
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Public data request failed with ${response.status} ${response.statusText}. body=${body.slice(0, 300)}`,
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
                  `Public data request failed with ${status} ${statusText}. body=${body.slice(0, 300)}`,
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
        request.destroy(new Error(`Public data request timed out in ${REQUEST_TIMEOUT_MS}ms.`));
      });
      request.end();
    },
  );
}

function readRows(json: unknown) {
  const response = asRecord(json).response;
  const body = asRecord(response).body;
  const itemsContainer = asRecord(body).items;
  const rawItems = Array.isArray(itemsContainer)
    ? itemsContainer
    : asRecord(itemsContainer).item;

  const pageRows = asArray(rawItems)
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);

  const total = toNumber(
    asRecord(body).totalCount ??
      asRecord(body).totalCnt ??
      asRecord(body).total_count,
  );

  return {
    pageRows,
    total: total ?? Number.POSITIVE_INFINITY,
  };
}

function toLibrary(row: PublicDataRow): Library | null {
  const name = pickString(row, ['LBRRY_NM', 'lbrryNm', 'libraryName']);
  const latitude = pickNumber(row, ['LATITUDE', 'latitude', 'lat']);
  const longitude = pickNumber(row, ['LONGITUDE', 'longitude', 'lng', 'lon']);

  if (!name || latitude === null || longitude === null) {
    return null;
  }

  const city = pickString(row, ['CTPRVN_NM', 'ctprvnNm', 'city']) ?? '미분류';
  const district =
    pickString(row, ['SIGNGU_NM', 'signguNm', 'district']) ?? '미분류';
  const address =
    pickString(row, ['RDNMADR', 'rdnmadr', 'LNMADR', 'lnmadr', 'address']) ??
    `${city} ${district}`;
  const homepage =
    pickString(row, ['HOMEPAGE_URL', 'homepageUrl', 'homepage']) ??
    'https://www.data.go.kr';
  const phone = pickString(row, ['PHONE_NUMBER', 'phoneNumber', 'phone']) ?? '';
  const closeDay = pickString(row, ['CLOSE_DAY', 'closeDay']) ?? '기관별 상이';
  const dataDate =
    pickString(row, ['REFERENCE_DATE', 'referenceDate', 'dataDate']) ??
    new Date().toISOString().slice(0, 10);

  return {
    id: createStableId(row, name, city, district, address, latitude, longitude),
    name,
    type: pickString(row, ['LBRRY_SE', 'lbrrySe', 'type']) ?? '공공도서관',
    city,
    district,
    address,
    phone,
    homepage,
    latitude,
    longitude,
    weekdayHours: normalizeHours(
      pickString(row, ['WEEKDAY_OPER_OPEN_HHMM', 'weekdayOperOpenHhmm']),
      pickString(row, [
        'WEEKDAY_OPER_COLSE_HHMM',
        'WEEKDAY_OPER_CLOSE_HHMM',
        'weekdayOperColseHhmm',
        'weekdayOperCloseHhmm',
      ]),
    ),
    saturdayHours: normalizeHours(
      pickString(row, [
        'SAT_OPER_OPER_OPEN_HHMM',
        'SAT_OPER_OPEN_HHMM',
        'satOperOperOpenHhmm',
        'satOperOpenHhmm',
      ]),
      pickString(row, ['SAT_OPER_CLOSE_HHMM', 'satOperCloseHhmm']),
    ),
    sundayHours: normalizeHours(
      pickString(row, ['HOLIDAY_OPER_OPEN_HHMM', 'holidayOperOpenHhmm']),
      pickString(row, [
        'HOLIDAY_CLOSE_OPEN_HHMM',
        'HOLIDAY_OPER_CLOSE_HHMM',
        'holidayCloseOpenHhmm',
        'holidayOperCloseHhmm',
      ]),
    ),
    closedRules: splitClosedRules(closeDay),
    seats: pickNumber(row, ['SEAT_CO', 'seatCo', 'seats']) ?? 0,
    books: pickNumber(row, ['BOOK_CO', 'bookCo', 'books']) ?? 0,
    dataDate,
  };
}

function normalizeHours(
  open: string | null | undefined,
  close: string | null | undefined,
): LibraryHours | null {
  const normalizedOpen = normalizeTime(open);
  const normalizedClose = normalizeTime(close);

  if (!normalizedOpen || !normalizedClose) {
    return null;
  }

  return {
    open: normalizedOpen,
    close: normalizedClose,
  };
}

function normalizeTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === '-' || trimmed === '미운영') {
    return null;
  }

  const match = trimmed.match(/(\d{1,2}):?(\d{2})/);

  if (!match) {
    return null;
  }

  const hours = match[1].padStart(2, '0');
  const minutes = match[2];

  return `${hours}:${minutes}`;
}

function splitClosedRules(value: string) {
  return value
    .split(/[+,]/)
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function createStableId(
  row: PublicDataRow,
  name: string,
  city: string,
  district: string,
  address: string,
  latitude: number,
  longitude: number,
) {
  const providerCode = pickString(row, [
    'instt_code',
    'INSTT_CODE',
    'insttCode',
    'providerCode',
  ]);
  const managementAgency = pickString(row, [
    'MANAGE_INSTT_NM',
    'manageInsttNm',
    'institutionName',
  ]);
  const source = [
    providerCode ?? '',
    managementAgency ?? '',
    city,
    district,
    name,
    address,
    latitude.toFixed(8),
    longitude.toFixed(8),
  ].join(':');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `library-${hash.toString(36)}`;
}

function pickString(row: PublicDataRow, keys: string[]) {
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

function pickNumber(row: PublicDataRow, keys: string[]) {
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

function asRecord(value: unknown): PublicDataRow {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as PublicDataRow;
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

function isLibrary(value: Library | null): value is Library {
  return value !== null;
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
