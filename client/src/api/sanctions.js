import api from './axios';
export const getSanctions = (params) => api.get('/sanctions', { params });
export const createSanction = (data) => api.post('/sanctions', data);
export const getLimits = (params) => api.get('/sanctions/limits', { params });
