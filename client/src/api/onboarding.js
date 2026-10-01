import api from './axios';

export const previewOnboarding = (data) => api.post('/onboarding/preview', data);
export const executeOnboarding = (data) => api.post('/onboarding/execute', data);
export const getOpeningBalances = (fy) => api.get('/onboarding/opening-balances', { params: { fy } });
export const saveOpeningBalances = (data) => api.post('/onboarding/opening-balances', data);
export const getSetupStatus = (fy) => api.get('/onboarding/status', { params: { fy } });
export const bulkOnboard = (rows) => api.post('/onboarding/bulk', { rows });

