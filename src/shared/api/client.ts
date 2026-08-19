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

// All 28 endpoints are GET-only, JSON, no auth (spec §1). This wrapper is intentionally
// thin: no auth headers, no retry-on-401 - none of that applies to this backend contract.
// App-shell login (§4) is a separate concern layered on top, not part of this client.
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
