import api from './axios';

export const issueAssets = (data) => api.post('/non-consumables/issue', data);
export const returnAssets = (data) => api.post('/non-consumables/return', data);
export const cancelIssue = (id) => api.post(`/non-consumables/${id}/cancel`);

export const getIssues = (params) => api.get('/non-consumables/issues', { params });
export const getIssueById = (id) => api.get(`/non-consumables/issues/${id}`);

export const getAssetTimeline = (assetId) => api.get(`/non-consumables/timeline/${assetId}`);
export const getActiveCustody = (assetId) => api.get(`/non-consumables/active-custody/${assetId}`);

export const getAvailableAssets = (params) => api.get('/non-consumables/available-assets', { params });
export const getActiveIssues = () => api.get('/non-consumables/active-issues');
