import api from './axios';

export const getAuditLogs = (params) => api.get('/audit/logs', { params });
export const getAuditTrail = (table, id) => api.get(`/audit/trail/${table}/${id}`);
