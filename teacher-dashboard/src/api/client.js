const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

export const storageKeys = {
  token: 'teacherToken'
};

export function getAuthToken() {
  return window.localStorage.getItem(storageKeys.token);
}

export function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(storageKeys.token, token);
  } else {
    window.localStorage.removeItem(storageKeys.token);
  }
}

export function getBaseUrl() {
  return DEFAULT_BASE_URL || window.location.origin;
}

export async function apiRequest(path, { method = 'GET', data, token, signal } = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = new Headers({
    'Content-Type': 'application/json'
  });

  const authToken = token ?? getAuthToken();
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const options = {
    method,
    headers,
    signal,
    credentials: 'include'
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    // ignore JSON parsing errors for empty responses
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.error || response.statusText || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload ?? { success: response.ok };
}
