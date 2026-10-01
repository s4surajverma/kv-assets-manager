import api from './axios';

export const getUsers = (params) => api.get('/users', { params });
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const getRoles = () => api.get('/users/roles');
export const resetUserPassword = (id, password) => api.post(`/users/${id}/reset-password`, { password });
