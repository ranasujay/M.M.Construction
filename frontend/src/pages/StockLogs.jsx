import { useState, useEffect } from 'react';
import { getStockLogs } from '../services/stockApi';
import { getRawMaterials } from '../services/stockApi';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { formatDateTime } from '../utils/helpers';

const CHANGE_TYPES = ['', 'PURCHASE', 'SALE', 'MANUAL_ADJUSTMENT'];

export default function StockLogs() {
  const [logs, setLogs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    getRawMaterials().then(({ data }) => setMaterials(data.data)).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 30 };
      if (filterMaterial) params.rawMaterial = filterMaterial;
      if (filterType) params.changeType = filterType;
      const { data } = await getStockLogs(params);
      setLogs(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, filterMaterial, filterType]);

  const getTypeColor = (type) => {
    switch (type) {
      case 'PURCHASE': return 'badge-success';
      case 'SALE': return 'badge-danger';
      case 'MANUAL_ADJUSTMENT': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Stock Logs</h1>
        <p className="text-xs text-gray-500">Complete audit trail of stock changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select className="select max-w-xs" value={filterMaterial} onChange={(e) => { setFilterMaterial(e.target.value); setPage(1); }}>
          <option value="">All Materials</option>
          {materials.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <select className="select max-w-xs" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {CHANGE_TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {logs.map((log) => (
              <div key={log._id} className="card !p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-200 text-sm">{log.rawMaterial?.name || 'Unknown'}</span>
                  <span className={getTypeColor(log.changeType) + ' text-[10px]'}>{log.changeType.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{formatDateTime(log.createdAt)}</span>
                  <span className={`font-bold ${log.quantityChanged > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {log.quantityChanged > 0 ? '+' : ''}{log.quantityChanged}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">{log.notes || '-'}</span>
                  <span className="text-gray-400">Bal: {log.balanceAfter}</span>
                </div>
                {log.performedBy && <p className="text-[10px] text-gray-600 mt-1">By: {log.performedBy.name}</p>}
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Balance After</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="text-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="font-medium text-gray-200">{log.rawMaterial?.name || 'Unknown'}</td>
                    <td><span className={getTypeColor(log.changeType)}>{log.changeType.replace('_', ' ')}</span></td>
                    <td>
                      <span className={`font-bold ${log.quantityChanged > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {log.quantityChanged > 0 ? '+' : ''}{log.quantityChanged}
                      </span>
                    </td>
                    <td className="text-gray-400">{log.balanceAfter}</td>
                    <td className="text-xs text-gray-500 max-w-[200px] truncate">{log.notes || '-'}</td>
                    <td className="text-xs text-gray-500">{log.performedBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && <p className="text-center text-gray-500 py-8">No stock logs found.</p>}
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
