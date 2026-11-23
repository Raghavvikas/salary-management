/** Shape the API uses for every failure. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Violations from a rejected salary change, ready to show next to the form. */
  get violations(): Array<{ code: string; message: string }> {
    return Array.isArray(this.details)
      ? (this.details as Array<{ code: string; message: string }>)
      : [];
  }
}

type QueryValue = string | number | boolean | Array<string | number> | undefined;

/** Arrays go over the wire as `ids=1,4,9`, which is what the API parses. */
export function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? 'UNKNOWN',
      body?.error.message ?? `Request failed with ${response.status}.`,
      body?.error.details,
    );
  }

  return (await response.json()) as T;
}
