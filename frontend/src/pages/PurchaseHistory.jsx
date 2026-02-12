import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPurchases } from '../services/stockApi';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { formatCurrency, formatDate } from '../utils/helpers';
import { HiOutlinePlus, HiOutlinePencil } from 'react-icons/hi';

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (supplier) params.supplier = supplier;
      const { data } = await getPurchases(params);
      setPurchases(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, [page, search, supplier]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Purchase History</h1>
          <p className="text-xs text-gray-500">Raw material purchase records</p>
        </div>
        <Link to="/purchases/create" className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> New Purchase
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input max-w-xs" placeholder="Search bill #..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <input className="input max-w-xs" placeholder="Filter by supplier..." value={supplier} onChange={(e) => { setSupplier(e.target.value); setPage(1); }} />
      </div>

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {purchases.map((p) => (
              <Link key={p._id} to={`/purchases/${p._id}/edit`} className="card !p-3 block hover:border-primary-500/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-primary-400 font-medium text-sm">{p.billNumber}</span>
                  <span className="text-xs text-gray-500">{formatDate(p.purchaseDate)}</span>
                </div>
                <p className="text-sm text-gray-200">{p.supplierName}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-gray-500">{p.items.length} item(s){(p.loadingCost || 0) + (p.carryingCost || 0) > 0 ? ` • Extras: ${formatCurrency((p.loadingCost || 0) + (p.carryingCost || 0))}` : ''}</span>
                  <span className="text-lg font-bold text-primary-400">{formatCurrency(p.grandTotal)}</span>
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p._id}>
                    <td><Link to={`/purchases/${p._id}/edit`} className="text-primary-400 font-medium hover:text-primary-300 hover:underline">{p.billNumber}</Link></td>
                    <td>{formatDate(p.purchaseDate)}</td>
                    <td className="font-medium text-gray-200">{p.supplierName}</td>
                    <td>
                      <div className="text-xs space-y-0.5">
                        {p.items.map((item, i) => (
                          <div key={i}>
                            {item.materialName || item.rawMaterial?.name} — {item.quantity} {item.unit} × {formatCurrency(item.ratePerUnit)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="font-bold text-primary-400">{formatCurrency(p.grandTotal)}</td>
                    <td className="text-gray-500">{p.createdBy?.name}</td>
                    <td>
                      <Link to={`/purchases/${p._id}/edit`} className="text-primary-400 hover:text-primary-300 text-xs" title="Edit">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {purchases.length === 0 && <p className="text-center text-gray-500 py-8">No purchase records found.</p>}
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
