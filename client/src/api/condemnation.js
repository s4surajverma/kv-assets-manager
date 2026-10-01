import api from './axios';
export const getCondemnations    = (params) => api.get('/condemnations', { params });
export const getCondemnation     = (id)     => api.get(`/condemnations/${id}`);
export const createCondemnation  = (data)   => api.post('/condemnations', data);
export const checkCondemnation   = (id, data) => api.put(`/condemnations/${id}/check`, data);
export const boardReview         = (id, data) => api.post(`/condemnations/${id}/board-review`, data);
export const rejectCondemnation  = (id, data) => api.post(`/condemnations/${id}/reject`, data);
export const getSummary          = (params) => api.get('/condemnations/summary/report', { params });
export const getEligibleAssets   = (params) => api.get('/condemnations/eligible-assets', { params });
export const calculateBulk       = (data)   => api.post('/condemnations/calculate-bulk', data);

