import axios from 'axios';

const normalizeBaseUrl = (value) => (value || '').toString().trim().replace(/\/$/, '');

export const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001'
);

axios.defaults.baseURL = API_BASE_URL;

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiFetch = (path, options) => fetch(apiUrl(path), options);