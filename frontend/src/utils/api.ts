import type {
  DraftQuestion,
  ExportFilename,
  LoginResponse,
  PublicSurvey,
  SurveyAnalytics,
  SurveyDetail,
  SurveyListItem,
  WordCloudData,
} from '../types';
import { clearAuthToken, getAuthToken } from './auth';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload && 'detail' in payload
        ? String(payload.detail)
        : typeof payload === 'string'
          ? payload
          : 'Request failed.';
    if (response.status === 401) {
      clearAuthToken();
    }
    throw new ApiError(detail, response.status);
  }

  return payload as T;
}

async function request<T>(path: string, init: RequestInit = {}, withAuth = false): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (withAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export function loginAdmin(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>(
    '/api/admin/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    false,
  );
}

export function getAdminMe(): Promise<{ username: string }> {
  return request<{ username: string }>('/api/admin/me', {}, true);
}

export function listAdminSurveys(): Promise<SurveyListItem[]> {
  return request<SurveyListItem[]>('/api/admin/surveys', {}, true);
}

export function createAdminSurvey(payload: {
  title: string;
  description: string;
  questions: DraftQuestion[];
}): Promise<SurveyDetail> {
  return request<SurveyDetail>('/api/admin/surveys', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description || null,
      questions: payload.questions.map((question) => ({
        prompt: question.prompt,
        type: question.type,
        required: question.required,
        options: question.options,
      })),
    }),
  }, true);
}

export function getAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  return request<SurveyDetail>(`/api/admin/surveys/${surveyId}`, {}, true);
}

export function updateAdminSurvey(
  surveyId: string,
  payload: {
    title: string;
    description: string;
    questions: DraftQuestion[];
  },
): Promise<SurveyDetail> {
  return request<SurveyDetail>(`/api/admin/surveys/${surveyId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description || null,
      questions: payload.questions.map((question) => ({
        prompt: question.prompt,
        type: question.type,
        required: question.required,
        options: question.options,
      })),
    }),
  }, true);
}

export function duplicateAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  return request<SurveyDetail>(`/api/admin/surveys/${surveyId}/duplicate`, { method: 'POST' }, true);
}

export function archiveAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  return request<SurveyDetail>(`/api/admin/surveys/${surveyId}/archive`, { method: 'POST' }, true);
}

export function activateAdminSurvey(surveyId: string): Promise<SurveyDetail> {
  return request<SurveyDetail>(`/api/admin/surveys/${surveyId}/activate`, { method: 'POST' }, true);
}

export function deleteAdminSurvey(surveyId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/admin/surveys/${surveyId}`, { method: 'DELETE' }, true);
}

export async function getAdminSurveyQr(surveyId: string): Promise<string> {
  const token = getAuthToken();
  const response = await fetch(`/api/admin/surveys/${surveyId}/qr`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(detail || 'Failed to load QR code.', response.status);
  }

  return response.text();
}

export function getSurveyAnalytics(surveyId: string): Promise<SurveyAnalytics> {
  return request<SurveyAnalytics>(`/api/admin/surveys/${surveyId}/analytics`, {}, true);
}

export function getSurveyWordCloud(surveyId: string, questionId?: number): Promise<WordCloudData> {
  const suffix = questionId ? `?question_id=${questionId}` : '';
  return request<WordCloudData>(`/api/admin/surveys/${surveyId}/word-cloud${suffix}`, {}, true);
}

export async function downloadSurveyExport(surveyId: string, filename: ExportFilename): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`/api/admin/surveys/${surveyId}/exports/${filename}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(detail || 'Failed to download the export.', response.status);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function getPublicSurvey(publicToken: string): Promise<PublicSurvey> {
  return request<PublicSurvey>(`/api/public/surveys/${publicToken}`);
}

export function submitPublicSurvey(
  publicToken: string,
  answers: Array<{ question_id: number; value: unknown }>,
): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/public/surveys/${publicToken}/responses`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}
