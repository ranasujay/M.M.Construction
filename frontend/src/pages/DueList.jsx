import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { formatCurrency, formatDate, debounce } from '../utils/helpers';
import {
  HiOutlineExclamationCircle,
  HiOutlineSearch,
  HiOutlineSortDescending,
  HiOutlineSortAscending,
  HiOutlinePhone,
  HiOutlinePrinter,
} from 'react-icons/hi';
import { IoLogoWhatsapp } from 'react-icons/io5';

export default function DueList() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc = highest due first
  const [minDue, setMinDue] = useState('');
  const [maxDue, setMaxDue] = useState('');
  const [totalDue, setTotalDue] = useState(0);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers/dues');
      setCustomers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, []);

  // Apply client-side filtering and sorting whenever data or filters change
  useEffect(() => {
    let result = [...customers];

    // Search filter
    if (search) {
      const lc = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(lc) ||
          c.phone?.toLowerCase().includes(lc)
      );
    }

    // Amount range filter
    if (minDue) {
      result = result.filter((c) => c.currentDue >= parseFloat(minDue));
    }
    if (maxDue) {
      result = result.filter((c) => c.currentDue <= parseFloat(maxDue));
    }

    // Sort
    result.sort((a, b) =>
      sortOrder === 'desc'
        ? b.currentDue - a.currentDue
        : a.currentDue - b.currentDue
    );

    setFilteredCustomers(result);
    setTotalDue(result.reduce((sum, c) => sum + c.currentDue, 0));
  }, [customers, search, sortOrder, minDue, maxDue]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const clearFilters = () => {
    setSearch('');
    setMinDue('');
    setMaxDue('');
    setSortOrder('desc');
  };

  const hasFilters = search || minDue || maxDue;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Due List</h1>
          <p className="text-xs text-gray-500">
            All customers with outstanding dues
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-lg font-bold text-red-400">
              {formatCurrency(totalDue)}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="btn-secondary !py-2 !px-3 text-sm no-print"
            title="Print due list"
          >
            <HiOutlinePrinter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-gray-500 uppercase mb-1 block">
              Search
            </label>
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input !py-2 text-sm pl-9"
                placeholder="Name or WhatsApp no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Min due */}
          <div className="w-28">
            <label className="text-[10px] text-gray-500 uppercase mb-1 block">
              Min Due ₹
            </label>
            <input
              type="number"
              className="input !py-2 text-sm"
              placeholder="0"
              value={minDue}
              onChange={(e) => setMinDue(e.target.value)}
            />
          </div>
          {/* Max due */}
          <div className="w-28">
            <label className="text-[10px] text-gray-500 uppercase mb-1 block">
              Max Due ₹
            </label>
            <input
              type="number"
              className="input !py-2 text-sm"
              placeholder="∞"
              value={maxDue}
              onChange={(e) => setMaxDue(e.target.value)}
            />
          </div>
          {/* Sort toggle */}
          <button
            onClick={toggleSort}
            className="btn-secondary !py-2 !px-3 text-sm"
            title={sortOrder === 'desc' ? 'Highest first' : 'Lowest first'}
          >
            {sortOrder === 'desc' ? (
              <HiOutlineSortDescending className="w-4 h-4" />
            ) : (
              <HiOutlineSortAscending className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {sortOrder === 'desc' ? 'Highest' : 'Lowest'}
            </span>
          </button>
          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-200 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm text-gray-400 px-1 no-print">
        <span>
          {filteredCustomers.length} customer
          {filteredCustomers.length !== 1 ? 's' : ''} with dues
        </span>
        {hasFilters && (
          <span className="text-xs text-primary-400">
            Filtered from {customers.length} total
          </span>
        )}
      </div>

      {/* List */}
      {loading ? (
        <Loader text="Loading dues..." />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={HiOutlineExclamationCircle}
          title={hasFilters ? 'No matching dues' : 'No outstanding dues'}
          description={
            hasFilters
              ? 'Try adjusting your filters.'
              : 'All customers are clear! 🎉'
          }
        />
      ) : (
        <>
          {/* Print header — only visible when printing */}
          <div className="print-header hidden">
            <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>M.M. Construction — Due List</h1>
            <p style={{ fontSize: '9px', margin: '2px 0', color: '#555' }}>
              Printed on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {hasFilters && ' (Filtered)'}
              {search && ` | Search: "${search}"`}
              {minDue && ` | Min: ₹${minDue}`}
              {maxDue && ` | Max: ₹${maxDue}`}
            </p>
            <hr style={{ margin: '4px 0', borderColor: '#333' }} />
          </div>

          {/* Print table — only visible when printing */}
          <div className="hidden print-table-show">
            <div className="table-container">
              <table className="table print-compact-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>WhatsApp No.</th>
                    <th>Billed</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Promise</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, idx) => (
                    <tr key={c._id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: '600' }}>{c.name}</td>
                      <td>{c.phone}</td>
                      <td>{formatCurrency(c.totalBilled)}</td>
                      <td>{formatCurrency(c.totalPaid)}</td>
                      <td style={{ fontWeight: '700', color: '#f87171' }}>{formatCurrency(c.currentDue)}</td>
                      <td>{c.nextPromiseDate ? `${formatDate(c.nextPromiseDate)} — ${formatCurrency(c.nextPromiseAmount)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: '700' }}>Total Outstanding</td>
                    <td style={{ fontWeight: '700', color: '#f87171' }}>{formatCurrency(totalDue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style={{ fontSize: '8px', textAlign: 'center', color: '#888', marginTop: '6px' }}>
              {filteredCustomers.length} customers | M.M. Construction
            </p>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden no-print">
            {filteredCustomers.map((c, idx) => (
              <div key={c._id} className="card !p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs text-gray-600 font-mono mt-0.5 flex-shrink-0">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/customers/${c._id}/ledger`}
                        className="font-medium text-gray-200 hover:text-primary-400 text-sm block truncate"
                      >
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-1 mt-0.5">
                        <IoLogoWhatsapp className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <a
                          href={`https://wa.me/91${c.phone?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-green-400"
                        >
                          {c.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-red-400 font-bold text-sm">
                      {formatCurrency(c.currentDue)}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      of {formatCurrency(c.totalBilled)}
                    </p>
                  </div>
                </div>
                {c.nextPromiseDate && (
                  <div className="mt-2 pt-2 border-t border-dark-border flex items-center justify-between text-xs">
                    <span className="text-amber-400">
                      Promise: {formatDate(c.nextPromiseDate)}
                    </span>
                    <span className="text-amber-400 font-semibold">
                      {formatCurrency(c.nextPromiseAmount)}
                    </span>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-dark-border flex items-center gap-3 text-xs">
                  <Link
                    to={`/customers/${c._id}/ledger`}
                    className="text-primary-400 font-medium"
                  >
                    Ledger →
                  </Link>
                  <span className="text-gray-600">
                    Paid: {formatCurrency(c.totalPaid)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="table-container hidden lg:block no-print">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>WhatsApp No.</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={toggleSort}
                  >
                    <span className="flex items-center gap-1">
                      Due
                      {sortOrder === 'desc' ? (
                        <HiOutlineSortDescending className="w-3.5 h-3.5" />
                      ) : (
                        <HiOutlineSortAscending className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                  <th>Promise Date</th>
                  <th>Promise Amt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, idx) => (
                  <tr key={c._id}>
                    <td className="text-gray-600 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="font-medium text-gray-200">{c.name}</td>
                    <td>
                      <a
                        href={`https://wa.me/91${c.phone?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-gray-300 hover:text-green-400"
                      >
                        <IoLogoWhatsapp className="w-3.5 h-3.5 text-green-400" />
                        {c.phone}
                      </a>
                    </td>
                    <td>{formatCurrency(c.totalBilled)}</td>
                    <td className="text-emerald-400">
                      {formatCurrency(c.totalPaid)}
                    </td>
                    <td className="text-red-400 font-bold">
                      {formatCurrency(c.currentDue)}
                    </td>
                    <td>
                      {c.nextPromiseDate ? (
                        <span className="text-amber-400 text-xs">
                          {formatDate(c.nextPromiseDate)}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td>
                      {c.nextPromiseAmount > 0 ? (
                        <span className="text-amber-400 font-semibold text-xs">
                          {formatCurrency(c.nextPromiseAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/customers/${c._id}/ledger`}
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                      >
                        Ledger
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-border">
                  <td colSpan="5" className="text-right font-semibold text-gray-300 text-xs">
                    Total Outstanding
                  </td>
                  <td className="text-red-400 font-bold">
                    {formatCurrency(totalDue)}
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
