import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

export const fetchAlerts = async () => {
  const res = await axios.get(`${BASE_URL}/alerts`);
  return res.data;
};

export const remediateAlert = async (systemId, driftedKey) => {
  const res = await axios.post(`${BASE_URL}/remediate`, { systemId, driftedKey });
  return res.data;
};