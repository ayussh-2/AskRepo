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



async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
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
        console.log("Error: ",err)

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
};