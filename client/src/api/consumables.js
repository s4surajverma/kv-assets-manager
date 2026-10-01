import api from './axios';
export const issueConsumable = (data) => api.post('/consumables/issue', data);
export const returnConsumable = (data) => api.post('/consumables/return', data);
export const attestConsumable = (id) => api.put(`/consumables/${id}/attest`);
export const getConsumables = (params) => api.get('/consumables', { params });
export const getActiveIssues = () => api.get('/consumables/active-issues');
export const getAvailableStock = () => api.get('/consumables/available-stock');
export const getBalance = (params) => api.get('/consumables/balance', { params });
