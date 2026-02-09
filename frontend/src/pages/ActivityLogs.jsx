import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/helpers';
import { HiOutlineClipboardList } from 'react-icons/hi';

const ACTION_OPTIONS = [
  'BILL_CREATED', 'BILL_UPDATED', 'BILL_DELETED',
  'PAYMENT_ADDED', 'PAYMENT_DELETED',
  'CUSTOMER_CREATED', 'CUSTOMER_UPDATED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_PRICE_CHANGED',
  'PROMISE_CREATED', 'PROMISE_UPDATED', 'PROMISE_FULFILLED',
  'USER_LOGIN', 'USER_CREATED', 'USER_STATUS_CHANGED', 'USER_CREDENTIALS_UPDATED',
];

const ENTITY_OPTIONS = ['bill', 'payment', 'customer', 'product', 'promise', 'user'];

const actionColors = {
  BILL_CREATED: 'badge-success',
  BILL_UPDATED: 'badge-info',
  BILL_DELETED: 'badge-danger',
  PAYMENT_ADDED: 'badge-success',
  PAYMENT_DELETED: 'badge-danger',
  CUSTOMER_CREATED: 'badge-info',
  CUSTOMER_UPDATED: 'badge-warning',
  PRODUCT_CREATED: 'badge-info',
  PRODUCT_UPDATED: 'badge-warning',
  PRODUCT_PRICE_CHANGED: 'badge-warning',
  PROMISE_CREATED: 'badge-info',
  PROMISE_UPDATED: 'badge-warning',
  PROMISE_FULFILLED: 'badge-success',
  USER_LOGIN: 'badge-info',
  USER_CREATED: 'badge-info',
  USER_STATUS_CHANGED: 'badge-danger',
  USER_CREDENTIALS_UPDATED: 'badge-warning',
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, action, entity]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (action) params.action = action;
      if (entity) params.entity = entity;
      const { data } = await api.get('/activity-logs', { params });
      setLogs(data.data);
      setPagination({ pages: data.totalPages, total: data.total });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setAction('');
    setEntity('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Activity Logs</h1>
        <p className="text-sm text-gray-500">Audit trail of all actions performed in the system</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Action</label>
            <select className="select" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entity</label>
            <select className="select" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
              <option value="">All Entities</option>
              {ENTITY_OPTIONS.map((e) => (
                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
              ))}
            </select>
          </div>
          {(action || entity) && (
            <button onClick={clearFilters} className="btn-secondary text-sm">Clear</button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={HiOutlineClipboardList}
          title="No Logs"
          description="No activity logs found matching your filters."
        />
      ) : (
        <>
          <div className="card p-0">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td>
                        <span className={actionColors[log.action] || 'badge-info'}>
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="capitalize text-gray-300">{log.entity}</td>
                      <td className="text-gray-400 text-sm max-w-xs truncate">{log.description}</td>
                      <td className="text-gray-300">{log.performedBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
