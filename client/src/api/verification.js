import api from './axios';
export const getVerifications = (params) => api.get('/verifications', { params });
export const createVerification = (data) => api.post('/verifications', data);
export const getVerificationItems = (id) => api.get(`/verifications/${id}/items`);
export const getVerificationReport = (id) => api.get(`/verifications/${id}/report`);
export const updateItems = (id, data) => api.put(`/verifications/${id}/items`, data);
export const completeVerification = (id, data) => api.post(`/verifications/${id}/complete`, data);
export const getDiscrepancies = (id) => api.get(`/verifications/${id}/discrepancies`);
export const getOverdue = (params) => api.get('/verifications/overdue/list', { params });
