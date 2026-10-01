import api from './axios';

export const getTransitions = (params) => api.get('/transitions', { params });
export const getTransition = (id) => api.get(`/transitions/${id}`);
export const createTransition = (data) => api.post('/transitions', data);
export const updateTransition = (id, data) => api.put(`/transitions/${id}`, data);
export const verifyItems = (id, data) => api.put(`/transitions/${id}/verify`, data);
export const submitForVerification = (id) => api.post(`/transitions/${id}/submit-verification`);
export const finalizeTransition = (id, data) => api.post(`/transitions/${id}/finalize`, data);
export const cancelTransition = (id, data) => api.post(`/transitions/${id}/cancel`, data);
export const getOfficeOrderReport = (id) => api.get(`/transitions/${id}/report/office-order`);
export const getVerificationReport = (id) => api.get(`/transitions/${id}/report/verification`);
