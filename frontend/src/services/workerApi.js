import api from './api';

// ─── Workers ────────────────────────────────────────────────────────
export const workerAPI = {
  getAll: (params) => api.get('/workers', { params }),
  getById: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  toggleStatus: (id) => api.patch(`/workers/${id}/toggle-status`),
};

// ─── Attendance ─────────────────────────────────────────────────────
export const attendanceAPI = {
  getDaily: (date) => api.get('/attendance/daily', { params: { date } }),
  markSingle: (data) => api.post('/attendance', data),
  markBulk: (data) => api.post('/attendance/bulk', data),
  getMonthly: (workerId, month, year) =>
    api.get(`/attendance/monthly/${workerId}`, { params: { month, year } }),
  getSummary: (month, year) =>
    api.get('/attendance/summary', { params: { month, year } }),
  getCalendar: (month, year) =>
    api.get('/attendance/calendar', { params: { month, year } }),
  getWorkerStats: (workerId, params) =>
    api.get(`/attendance/worker-stats/${workerId}`, { params }),
};

// ─── Worker Advances ────────────────────────────────────────────────
export const workerAdvanceAPI = {
  getAll: (params) => api.get('/advances/worker', { params }),
  give: (data) => api.post('/advances/worker', data),
  getWorkerMonthly: (workerId, month, year) =>
    api.get(`/advances/worker/${workerId}/monthly`, { params: { month, year } }),
  delete: (id) => api.delete(`/advances/worker/${id}`),
};

// ─── Salary ─────────────────────────────────────────────────────────
export const salaryAPI = {
  getRecords: (month, year, workerId) =>
    api.get('/salary', { params: { month, year, workerId } }),
  generate: (data) => api.post('/salary/generate', data),
  generateAll: (month, year) => api.post('/salary/generate-all', { month, year }),
  markPaid: (id) => api.patch(`/salary/${id}/pay`),
  getDashboard: () => api.get('/salary/dashboard'),
};
