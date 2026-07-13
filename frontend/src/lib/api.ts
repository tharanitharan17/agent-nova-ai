import type { AppState, GoalFormData, TodayFocus } from '../types';

const TOKEN_KEY = 'nova_auth_token';
const MODEL_KEY = 'nova_selected_model';
const configuredTimeout = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS);
// AI generation can legitimately take longer than a conventional HTTP request,
// particularly when Ollama is running on CPU.
const REQUEST_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout >= 5_000
  ? configuredTimeout
  : 120_000;
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
// Local development remains zero-config. Production deployments must explicitly
// provide VITE_API_URL, avoiding an accidental request to the Netlify host.
const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export interface AuthUser { id: string; name: string; email: string; created_at: string }
interface AuthResponse { token: string; user: AuthUser }

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearSession = () => localStorage.removeItem(TOKEN_KEY);
export const getSelectedModel = () => localStorage.getItem(MODEL_KEY) || 'deepseek-r1:8b';
export const setSelectedModel = (model: 'deepseek-r1:8b' | 'qwen2.5:3b') => localStorage.setItem(MODEL_KEY, model);

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL && !url.startsWith('http')) {
    throw new Error('NOVA is not configured. Set VITE_API_URL to the deployed backend URL.');
  }
  const headers = new Headers(options.headers);
  const token = getToken();
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-LLM-Model', getSelectedModel());
  
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  let response: Response;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(fullUrl, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('NOVA took too long to respond. Please try again.');
    throw new Error(`Unable to reach NOVA at ${API_URL}. Make sure the backend is running.`);
  } finally {
    window.clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.startsWith('/api/auth/')) {
    clearSession();
    window.dispatchEvent(new Event('nova:unauthorized'));
  }
  if (!response.ok) throw new Error(data.error || 'NOVA could not complete the request.');
  return data as T;
}

const request = apiRequest;

async function authenticate(url: string, body: object) {
  const result = await request<AuthResponse>(url, { method: 'POST', body: JSON.stringify(body) });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

let currentUserRequest: Promise<{ user: AuthUser }> | null = null;
let dashboardRequest: Promise<AppState> | null = null;

export function fetchCurrentUser() {
  if (!currentUserRequest) {
    currentUserRequest = request<{ user: AuthUser }>('/api/auth/me').finally(() => {
      currentUserRequest = null;
    });
  }
  return currentUserRequest;
}

export function fetchDashboard() {
  if (!dashboardRequest) {
    dashboardRequest = request<AppState>('/api/dashboard').finally(() => {
      dashboardRequest = null;
    });
  }
  return dashboardRequest;
}
export const signup = (name: string, email: string, password: string) => authenticate('/api/auth/signup', { name, email, password });
export const login = (email: string, password: string) => authenticate('/api/auth/login', { email, password });
export const createGoal = (goal: GoalFormData) => request<AppState>('/api/goals', { method: 'POST', body: JSON.stringify(goal) });
export const completeTask = (taskId: string, note?: string) => request<AppState>(`/api/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ note }) });
export const skipTask = (taskId: string, reason: string) => request<AppState>(`/api/tasks/${taskId}/skip`, { method: 'POST', body: JSON.stringify({ reason }) });
export const rescheduleTask = (taskId: string, scheduledDate: string, reason?: string) => request<AppState>(`/api/tasks/${taskId}/reschedule`, { method: 'POST', body: JSON.stringify({ scheduledDate, reason }) });
export const addProgressNote = (taskId: string, note: string) => request<AppState>(`/api/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ note }) });
export const dailyCheckIn = (value: object) => request<AppState>('/api/check-ins', { method: 'POST', body: JSON.stringify(value) });
export const updateAvailability = (dailyMinutes: number, workingDays: string[]) => request<AppState>('/api/availability', { method: 'POST', body: JSON.stringify({ dailyMinutes, workingDays }) });
export const replanGoal = () => request<AppState>('/api/goals/replan', { method: 'POST' });
export const setGoalStatus = (status: 'active' | 'paused' | 'completed') => request<AppState>('/api/goals/status', { method: 'POST', body: JSON.stringify({ status }) });
export const sendChatMessage = (message: string) => request<{ response: string; dashboard: AppState }>('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
export const fetchToday = () => request<TodayFocus>('/api/today');
