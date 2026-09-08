import type { ApiErrorBody } from "@/shared/types/planRun";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

function buildUrl(path: string, params?: QueryParams): string {
  if (!BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Copy .env.example to .env and point it at the planning API.",
    );
  }
  // Built as a plain string rather than `new URL()` so a relative BASE_URL (e.g.
  // "/api/planning" behind the Vite dev proxy - see vite.config.ts) works the same
  // as an absolute one; `new URL()` throws on relative input with no base.
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return `${BASE_URL}${path}${query ? `?${query}` : ""}`;
}

// Every endpoint was GET-only, JSON, no auth (spec §1) until the Admin Control Panel
// (added 2026-09-07) - its one write path (POST /admin/config/) is unauthenticated same
// as everything else here (see PipelineSettings.updated_by's own backend docstring for
// why), just no longer read-only. This wrapper is intentionally thin: no auth headers,
// no retry-on-401 - none of that applies to this backend contract. App-shell login (§4)
// is a separate concern layered on top, not part of this client.
// Exposes buildUrl for the rare case a caller needs a plain href rather than a fetch
// wrapper - currently only DC Selection's sample-CSV download links (a real browser
// <a href> GET, not a JSON response apiGet could return).
export function apiUrl(path: string, params?: QueryParams): string {
  return buildUrl(path, params);
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON; leave body null
    }
    throw new ApiError(
      res.status,
      body,
      body?.error ?? `Request to ${path} failed with ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

// POST counterpart to apiGet - currently only /admin/config/ uses this. csrf_exempt on
// the backend (no session/auth system exists anywhere in this API), so no CSRF token is
// sent here either - same trust boundary as every GET call, just a mutation this time.
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errBody: ApiErrorBody | null = null;
    try {
      errBody = (await res.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON; leave body null
    }
    throw new ApiError(
      res.status,
      errBody,
      errBody?.error ?? `Request to ${path} failed with ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

// Multipart counterpart to apiPost - only DC Selection's rank/cohort CSV uploader
// (added 2026-09-08) needs a file body. No Content-Type header set here on purpose -
// the browser sets its own multipart boundary when given a FormData body; setting one
// manually would drop the boundary parameter and break parsing server-side.
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
  });

  if (!res.ok) {
    let errBody: ApiErrorBody | null = null;
    try {
      errBody = (await res.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON; leave body null
    }
    throw new ApiError(
      res.status,
      errBody,
      errBody?.error ?? `Request to ${path} failed with ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

export interface PaginatedResult<T> {
  data: T[];
  // X-Total-Count/X-Limit/X-Offset (see _paginated_json_response, views.py) - the body
  // stays a bare array for backward compatibility, so this is the only way to tell a
  // full result from one silently truncated at the endpoint's default limit.
  totalCount: number;
  limit: number;
  offset: number;
}

// Same contract as apiGet, but for the list endpoints that added X-Total-Count/X-Limit/
// X-Offset headers (streaks/completion-stats/runs) instead of changing their body shape.
export async function apiGetPaginated<T>(
  path: string,
  params?: QueryParams,
): Promise<PaginatedResult<T>> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON; leave body null
    }
    throw new ApiError(
      res.status,
      body,
      body?.error ?? `Request to ${path} failed with ${res.status}`,
    );
  }

  const data = (await res.json()) as T[];
  const totalCount = Number(res.headers.get("X-Total-Count") ?? data.length);
  const limit = Number(res.headers.get("X-Limit") ?? data.length);
  const offset = Number(res.headers.get("X-Offset") ?? 0);
  return { data, totalCount, limit, offset };
}
