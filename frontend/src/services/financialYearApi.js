import api from './api';

// Financial Year Closing API service

export const getFinancialYearStatus = (fy) =>
  api.get(`/financial-year/${fy}/status`);

export const getFinancialYearPreview = (fy) =>
  api.get(`/financial-year/${fy}/preview`);

export const createFinancialYearBackup = (fy) =>
  api.post(`/financial-year/${fy}/backup`);

export const downloadFinancialYearBackup = (fy) =>
  api.get(`/financial-year/${fy}/download`, { responseType: 'blob' });

export const verifyFinancialYearBackup = (fy) =>
  api.post(`/financial-year/${fy}/verify`);

export const deleteFinancialYearData = (fy, password) =>
  api.post(`/financial-year/${fy}/delete`, { password });

export const getBackupRecords = () =>
  api.get('/financial-year/backups');

export const getAllSummaries = () =>
  api.get('/financial-year/summaries');

// ─── Full Database Backup & Restore ─────────────────────────────────

export const downloadFullDatabaseBackup = () =>
  api.get('/financial-year/full-backup', { responseType: 'blob' });

export const restoreDatabaseFromBackup = (file, mode, password) => {
  const formData = new FormData();
  formData.append('backupFile', file);
  formData.append('mode', mode);
  formData.append('password', password);
  return api.post('/financial-year/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 min timeout for large restores
  });
};
