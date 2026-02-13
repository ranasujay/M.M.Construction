import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { formatCurrency, formatDate } from '../utils/helpers';
import { HiOutlinePlus, HiOutlineSearch } from 'react-icons/hi';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchBills = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await api.get('/bills', { params });
      setBills(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBills(); }, [page, startDate, endDate]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Bills</h1>
          <p className="text-xs text-gray-500">Manage invoices</p>
        </div>
        <Link to="/bills/create" className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> New
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="label">Search Bill #</label>
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input className="input pl-10" placeholder="MMC-2026-0001" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </form>
          <div className="min-w-[150px]">
            <label className="label">From</label>
            <input type="date" className="input" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </div>
          <div className="min-w-[150px]">
            <label className="label">To</label>
            <input type="date" className="input" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {bills.map((bill) => (
              <Link key={bill._id} to={`/bills/${bill._id}`} className="card !p-3 block">
                <div className="flex items-center justify-between">
                  <span className="text-primary-400 font-medium text-sm">{bill.billNumber}</span>
                  <span className="text-gray-100 font-semibold text-sm">{formatCurrency(bill.grandTotal)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-gray-200 font-medium">{bill.customer?.name}</span>
                  <span className="text-gray-500">{formatDate(bill.createdAt)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{bill.createdBy?.name}</div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Grand Total</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill._id}>
                    <td>
                      <Link to={`/bills/${bill._id}`} className="text-primary-400 hover:text-primary-300 font-medium">
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td className="font-medium text-gray-200">{bill.customer?.name}</td>
                    <td>{formatDate(bill.createdAt)}</td>
                    <td className="font-semibold">{formatCurrency(bill.grandTotal)}</td>
                    <td className="text-gray-500">{bill.createdBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
