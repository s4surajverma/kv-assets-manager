import api from './axios';
export const getDisposals     = ()       => api.get('/disposals');
export const getDisposal      = (id)     => api.get(`/disposals/${id}`);
export const createDisposal   = (data)   => api.post('/disposals', data);
export const updateSale       = (id, data) => api.put(`/disposals/${id}/sale`, data);
export const completeDisposal = (id, data) => api.post(`/disposals/${id}/complete`, data);
