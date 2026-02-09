import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import { formatCurrency } from '../utils/helpers';
import { HiOutlineSearch } from 'react-icons/hi';
import { IoLogoWhatsapp } from 'react-icons/io5';

export default function AdvanceList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAdvance, setTotalAdvance] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/customers/advances');
        setCustomers(data.data);
        setTotalAdvance(data.totalAdvance);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Filter by search
  const filtered = customers.filter((c) => {
    if (!search) return true;
    const lc = search.toLowerCase();
    return c.name.toLowerCase().includes(lc) || c.phone.includes(lc);
  });

  const filteredTotal = filtered.reduce((sum, c) => sum + c.advanceBalance, 0);

  if (loading) return <Loader text="Loading advance list..." />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Advance Balance</h1>
          <p className="text-xs text-gray-500">{customers.length} customers with advance</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalAdvance)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Total Advance</p>
        </div>
      </div>

      {/* Search */}
      {customers.length > 0 && (
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9 !py-2 text-sm"
            placeholder="Search by name or WhatsApp no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Summary bar */}
      {search && (
        <div className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-400">
            Showing <span className="text-gray-200 font-medium">{filtered.length}</span> of {customers.length}
          </span>
          <span className="text-emerald-400 font-semibold">{formatCurrency(filteredTotal)}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">{search ? 'No matching customers' : 'No customers with advance balance'}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((c) => (
              <div key={c._id} className="card !p-3">
                <div className="flex items-center justify-between">
                  <Link to={`/customers/${c._id}/ledger`} className="text-gray-200 font-medium text-sm hover:text-primary-400">
                    {c.name}
                  </Link>
                  <span className="text-emerald-400 font-bold text-sm">{formatCurrency(c.advanceBalance)}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs">
                  <a
                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <IoLogoWhatsapp className="w-3.5 h-3.5" />
                    {c.phone}
                  </a>
                  <div className="flex gap-3 text-gray-500">
                    <span>Billed: {formatCurrency(c.totalBilled)}</span>
                    <span>Paid: {formatCurrency(c.totalPaid)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>WhatsApp No.</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th>Advance Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c._id}>
                    <td className="text-gray-500">{i + 1}</td>
                    <td>
                      <Link to={`/customers/${c._id}/ledger`} className="text-gray-200 hover:text-primary-400 font-medium">
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <a
                        href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                      >
                        <IoLogoWhatsapp className="w-3.5 h-3.5" />
                        {c.phone}
                      </a>
                    </td>
                    <td className="text-gray-400">{formatCurrency(c.totalBilled)}</td>
                    <td className="text-gray-400">{formatCurrency(c.totalPaid)}</td>
                    <td className="text-emerald-400 font-bold">{formatCurrency(c.advanceBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-border">
                  <td colSpan="5" className="text-right font-semibold text-gray-300">Total Advance</td>
                  <td className="text-emerald-400 font-bold text-base">{formatCurrency(filteredTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
