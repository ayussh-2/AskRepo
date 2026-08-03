import { BASE_URL } from "./utils";

export type ApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

export async function handleApiRequest<T>(
  requestFn: () => Promise<Response>,
  onUnauthorized?: () => void
): Promise<ApiResult<T>> {
  try {
    const res = await requestFn();

    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
      return { success: false, data: null, error: "Unauthorized session" };
    }

    const body = await res.json().catch(() => null);

    if (!res.ok || (body && body.success === false)) {
      const errorMessage =
        body?.message || body?.detail || body?.error || `HTTP error ${res.status}`;
      return { success: false, data: null, error: errorMessage };
    }

    return { success: true, data: body?.data ?? body ?? ({} as T), error: null };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to connect to backend server.";
    return { success: false, data: null, error: errorMsg };
  }
}

export function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export interface RepoApiItem {
  repo_name: string;
  status: string;
  latest_commit_sha: string;
}

export interface ReposResponseData {
  repos?: RepoApiItem[];
}

export interface CheckSyncResponseData {
  up_to_date?: boolean;
  is_up_to_date?: boolean;
}

export interface IngestResponseData {
  job_id?: number;
  repo_name?: string;
  already_indexed?: boolean;
  status?: string;
}

export interface IngestStatusData {
  job_id: number;
  status: string;
  repo_name?: string;
  error_message?: string | null;
}

export interface ChatHistoryMessage {
  id?: string;
  role: "user" | "bot" | "assistant";
  content: string;
}

export async function fetchReposApi(
  token: string,
  onUnauthorized?: () => void
) {
  return handleApiRequest<ReposResponseData>(
    () =>
      fetch(`${BASE_URL}/repos`, {
        method: "GET",
        headers: buildHeaders(token),
      }),
    onUnauthorized
  );
}

export async function checkRepoSyncApi(
  repoName: string,
  token: string,
  onUnauthorized?: () => void
) {
  return handleApiRequest<CheckSyncResponseData>(
    () =>
      fetch(`${BASE_URL}/check-sync?repo_name=${encodeURIComponent(repoName)}`, {
        method: "GET",
        headers: buildHeaders(token),
      }),
    onUnauthorized
  );
}

export async function triggerIngestApi(
  repoUrl: string,
  token: string,
  onUnauthorized?: () => void
) {
  return handleApiRequest<IngestResponseData>(
    () =>
      fetch(`${BASE_URL}/ingest`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ repo_url: repoUrl }),
      }),
    onUnauthorized
  );
}

export async function checkIngestStatusApi(
  jobId: number,
  token: string,
  onUnauthorized?: () => void
) {
  return handleApiRequest<IngestStatusData>(
    () =>
      fetch(`${BASE_URL}/status?job_id=${jobId}`, {
        method: "GET",
        headers: buildHeaders(token),
      }),
    onUnauthorized
  );
}

export async function fetchChatHistoryApi(
  repoName: string,
  token: string,
  onUnauthorized?: () => void
) {
  return handleApiRequest<{ history: ChatHistoryMessage[] }>(
    () =>
      fetch(`${BASE_URL}/chat-history?repo_name=${encodeURIComponent(repoName)}`, {
        method: "GET",
        headers: buildHeaders(token),
      }),
    onUnauthorized
  );
}

export async function streamQueryApi(
  repoName: string,
  query: string,
  provider: string,
  token: string,
  onUnauthorized?: () => void
): Promise<{ res: Response | null; error: string | null }> {
  try {
    const res = await fetch(
      `${BASE_URL}/query?repo_name=${encodeURIComponent(repoName)}`,
      {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({
          query,
          provider: provider !== "auto" ? provider : undefined,
        }),
      }
    );

    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
      return { res: null, error: "Unauthorized session" };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return {
        res: null,
        error:
          body?.message || body?.detail || `Server responded with status ${res.status}`,
      };
    }

    return { res, error: null };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to connect to backend server.";
    return { res: null, error: errorMsg };
  }
}
