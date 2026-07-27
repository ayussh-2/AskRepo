const BASE_URL = import.meta.env.BASE_API_URL || 'http://localhost:8000';

interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors: unknown;
}

type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export type ApiResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; message: string; errors: unknown };

export interface IngestData {
  job_id: number;
}

export interface IngestionStatusData {
  job_id: number;
  repo_name: string;
  commit_sha: string;
  status: 'pending' | 'completed' | 'failed';
  error_message: string | null;
  updated_at: string | null;
}

export interface ChatHistoryData {
  repo_name: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
}

let currentToken: string | null = null;

// Persistent Storage Helpers
export async function getStoredToken(): Promise<string | null> {
  if (currentToken) return currentToken;
  
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const res = await chrome.storage.local.get(['askrepo_token']);
      if (res.askrepo_token) {
        currentToken = res.askrepo_token;
        return res.askrepo_token;
      }
    } catch (e) {
      console.warn('Failed to read token from chrome.storage:', e);
    }
  }

  if (typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('askrepo_token');
    if (local) {
      currentToken = local;
      return local;
    }
  }

  // Only fallback to guest demo token in development mode
  if (import.meta.env.DEV) {
    const defaultToken = "mock_google_id_token";
    await setApiToken(defaultToken);
    return defaultToken;
  }

  return null;
}

export async function setApiToken(token: string | null): Promise<void> {
  currentToken = token;

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      if (token) {
        await chrome.storage.local.set({ askrepo_token: token });
      } else {
        await chrome.storage.local.remove(['askrepo_token']);
      }
    } catch (e) {
      console.warn('Failed to update token in chrome.storage:', e);
    }
  }

  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('askrepo_token', token);
    } else {
      localStorage.removeItem('askrepo_token');
    }
  }
}

export function getUserNameFromToken(token: string): string {
  if (token === "mock_google_id_token") return "Demo User";
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.name || decoded.email.split("@")[0] || "User";
  } catch {
    return "User";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      headers,
      ...options,
    });

    const json: ApiResponse<T> = await res.json();

    if (json.success) {
      return { ok: true, data: json.data, message: json.message };
    }

    return { ok: false, message: json.message, errors: json.errors };

  } catch (err) {
    const message =
      err instanceof TypeError && err.message === 'Failed to fetch'
        ? 'Cannot reach the askRepo server. Is it running?'
        : 'Unexpected error occurred';
    console.log("Error: ", err);

    return { ok: false, message, errors: err };
  }
}

export const api = {
  ingest: (repoUrl: string) =>
    request<IngestData>('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repo_url: repoUrl }),
    }),
  status: (jobId: number) =>
    request<IngestionStatusData>(`/status?job_id=${jobId}`, {
      method: 'GET',
    }),
  checkRepoStatus: (repoName: string) =>
    request<IngestionStatusData>(`/status?repo_name=${encodeURIComponent(repoName)}`, {
      method: 'GET',
    }),
  getChatHistory: (repoName: string) =>
    request<ChatHistoryData>(`/chat-history?repo_name=${encodeURIComponent(repoName)}`, {
      method: 'GET',
    }),
  clearChatHistory: (repoName: string) =>
    request<null>(`/chat-history?repo_name=${encodeURIComponent(repoName)}`, {
      method: 'DELETE',
    }),
  query: async (repoName: string, queryText: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${BASE_URL}/query?repo_name=${encodeURIComponent(repoName)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: queryText }),
    });
  },
};