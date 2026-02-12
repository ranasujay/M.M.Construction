import api from './api';

// ─── Raw Materials ───────────────────────────────────────────────
export const getRawMaterials = (params) => api.get('/raw-materials', { params });
export const getRawMaterial = (id) => api.get(`/raw-materials/${id}`);
export const createRawMaterial = (data) => api.post('/raw-materials', data);
export const updateRawMaterial = (id, data) => api.put(`/raw-materials/${id}`, data);
export const adjustStock = (id, data) => api.post(`/raw-materials/${id}/adjust`, data);
export const getStockDashboard = () => api.get('/raw-materials/dashboard');

// ─── Purchases ───────────────────────────────────────────────────
export const getPurchases = (params) => api.get('/purchases', { params });
export const getPurchase = (id) => api.get(`/purchases/${id}`);
export const createPurchase = (data) => api.post('/purchases', data);
export const updatePurchase = (id, data) => api.put(`/purchases/${id}`, data);
export const getPurchaseStats = () => api.get('/purchases/stats');
export const getPurchaseExpenses = (params) => api.get('/purchases/expenses', { params });
export const getSupplierNames = (q) => api.get('/purchases/supplier-names', { params: { q } });

// ─── Stock Logs ──────────────────────────────────────────────────
export const getStockLogs = (params) => api.get('/stock-logs', { params });

// ─── Suppliers ───────────────────────────────────────────────────
export const getSuppliers = (params) => api.get('/suppliers', { params });
export const getSupplier = (id) => api.get(`/suppliers/${id}`);
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const paySupplier = (id, data) => api.post(`/suppliers/${id}/pay`, data);
export const getSupplierPayments = (id, params) => api.get(`/suppliers/${id}/payments`, { params });
export const getSupplierLedger = (id) => api.get(`/suppliers/${id}/ledger`);
export const updateSupplierPayment = (supplierId, paymentId, data) => api.put(`/suppliers/${supplierId}/payments/${paymentId}`, data);
export const deleteSupplierPayment = (supplierId, paymentId) => api.delete(`/suppliers/${supplierId}/payments/${paymentId}`);

// ─── Custom Expenses ────────────────────────────────────────────────
export const getCustomExpenses = (params) => api.get('/custom-expenses', { params });
export const createCustomExpense = (data) => api.post('/custom-expenses', data);
export const updateCustomExpense = (id, data) => api.put(`/custom-expenses/${id}`, data);
export const deleteCustomExpense = (id) => api.delete(`/custom-expenses/${id}`);
