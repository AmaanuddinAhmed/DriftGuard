import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

export const fetchAlerts = async () => {
  const res = await axios.get(`${BASE_URL}/alerts`);
  return res.data;
};

export const fetchSummary = async () => {
  const res = await axios.get(`${BASE_URL}/summary`);
  return res.data;
};

export const createEvent = async (payload) => {
  const res = await axios.post(`${BASE_URL}/events`, payload);
  return res.data;
};

export const fetchFeedStatus = async () => {
  const res = await axios.get(`${BASE_URL}/feed/status`);
  return res.data;
};

export const remediateAlert = async (systemId, driftedKey) => {
  const res = await axios.post(`${BASE_URL}/remediate`, {
    systemId,
    driftedKey,
  });
  return res.data;
};
