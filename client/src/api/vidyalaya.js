import axios from './axios';

export const getVidyalayas = async () => {
  const { data } = await axios.get('/vidyalayas');
  return data;
};

export const updateVidyalaya = async (id, payload) => {
  const { data } = await axios.put(`/vidyalayas/${id}`, payload);
  return data;
};

export const getMyVidyalaya = async () => {
  const res = await axios.get('/vidyalayas/my-profile');
  return res.data;
};

export const updateMyVidyalaya = async (payload) => {
  const res = await axios.put('/vidyalayas/my-profile', payload);
  return res.data;
};

export const resetAllData = async (password) => {
  const res = await axios.post('/vidyalayas/reset-data', { password });
  return res.data;
};

export const deleteAccount = async (password, confirmPhrase) => {
  const res = await axios.post('/vidyalayas/delete-account', { password, confirmPhrase });
  return res.data;
};

