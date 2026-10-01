import api from './axios';
export const getEntries = (params) => api.get('/stock/entries', { params });
export const getEntry = (id) => api.get(`/stock/entries/${id}`);
export const createEntry = (data) => api.post('/stock/entries', data);
export const writeOff = (data) => api.post('/stock/write-off', data);
export const transfer = (data) => api.post('/stock/transfer', data);
export const getBalance = (params) => api.get('/stock/balance', { params });
export const getRegister = (params) => api.get('/stock/register', { params });
export const classifyEntry = (id, data) => api.put(`/stock/entries/${id}/classify`, data);
