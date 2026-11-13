import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('qms_token');
      window.dispatchEvent(new Event('qms-unauthorized'));
    }
    return Promise.reject(err);
  }
);

export function createSubmissionToken() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${rand()}-${rand().slice(0, 4)}-4${rand().slice(0, 3)}-a${rand().slice(0, 3)}-${rand()}${rand().slice(0, 4)}`;
}

export function getErrorMessage(err, fallback = 'Request failed.') {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.status >= 500 && !err?.response?.data) {
    return 'Cannot reach the backend API server (port 5000). Ensure the server is running ("npm start" in server/).';
  }
  return err?.message || fallback;
}

export async function fetchProtectedBlob(url) {
  const response = await api.get(url, { responseType: 'blob' });
  return response.data;
}

export async function downloadProtectedFile(url, filename) {
  const blob = await fetchProtectedBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

