import axios from 'axios';

const normalizeBaseUrl = (value) => (value || '').toString().trim().replace(/\/$/, '');

const inferDefaultBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname?.endsWith('onrender.com')) {
    const renderHost = window.location.hostname.replace(/^fichas-frontend(?=\.onrender\.com$)/, 'fichas-backend');
    return `${window.location.protocol}//${renderHost}`;
  }

  return 'http://localhost:3001';
};

export const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || inferDefaultBaseUrl()
);

axios.defaults.baseURL = API_BASE_URL;

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const buildCandidates = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const candidates = [];

  if (API_BASE_URL) candidates.push(`${API_BASE_URL}${normalizedPath}`);

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, host, hostname } = window.location;
    // Same origin
    candidates.push(`${protocol}//${host}${normalizedPath}`);

    // Replace "frontend" with "backend" when common naming used on Render
    if (hostname.includes('frontend')) {
      const backendHost = hostname.replace(/frontend/g, 'backend');
      candidates.push(`${protocol}//${backendHost}${normalizedPath}`);
    }
  }

  // Local dev fallback
  candidates.push(`http://localhost:3001${normalizedPath}`);

  // Remove duplicates preserving order
  return [...new Set(candidates)];
};

export const apiFetch = async (path, options) => {
  const candidates = buildCandidates(path);
  let lastError = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
      // try next candidate
    }
  }

  // If all attempts fail, throw the last error
  throw lastError || new Error('Network error');
};