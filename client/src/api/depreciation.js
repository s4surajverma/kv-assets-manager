import api from './axios';
export const runDepreciation = (data) => api.post('/depreciation/run', data);
export const previewDepreciation = (data) => api.post('/depreciation/run-preview', data);
export const getLedger = (params) => api.get('/depreciation/ledger', { params });
export const getSummary = (params) => api.get('/depreciation/summary', { params });
export const calcCondemnation = (data) => api.post('/depreciation/calculate-condemnation', data);
export const getAssetHistory  = (id) => api.get(`/depreciation/asset/${id}/history`);
