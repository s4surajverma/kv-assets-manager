import api from './axios';
export const login = (data) => api.post('/auth/login', data);
export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const logout = () => api.post('/auth/logout');
export const changePassword = (data) => api.post('/auth/change-password', data);
export const registerVidyalaya = (data) => api.post('/auth/register-vidyalaya', data);
export const getMe = () => api.get('/auth/me');
