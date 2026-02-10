import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { formatCurrency } from '../utils/helpers';
import { HiOutlineChartBar, HiOutlineFilter } from 'react-icons/hi';

export default function ProductSales() {
  const [salesData, setSalesData] = useState([]);
  const [totals, setTotals] = useState({ totalRevenue: 0, totalQuantity: 0, totalBills: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/products/categories');
      setCategories(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await api.get('/products/sales-report', { params });
      setSalesData(data.data);
      setTotals(data.totals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchSalesReport(); }, [filterCategory, startDate, endDate]);

  // Group by category for summary
  const categoryTotals = salesData.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = { revenue: 0, quantity: 0, count: 0 };
    acc[item.category].revenue += item.totalRevenue;
    acc[item.category].quantity += item.totalQuantity;
    acc[item.category].count += item.billCount;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Product Sales & Profit</h1>
        <p className="text-xs text-gray-500">Product-wise selling analysis</p>
      </div>

      {/* Filters */}
      <div className="card !p-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Category</label>
            <select
              className="select !py-1.5 text-sm min-w-[120px]"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">From</label>
            <input
              type="date"
              className="input !py-1.5 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">To</label>
            <input
              type="date"
              className="input !py-1.5 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {(filterCategory || startDate || endDate) && (
            <button
              onClick={() => { setFilterCategory(''); setStartDate(''); setEndDate(''); }}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Revenue</p>
          <p className="text-lg font-bold text-primary-400">{formatCurrency(totals.totalRevenue)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Qty Sold</p>
          <p className="text-lg font-bold text-gray-100">{totals.totalQuantity.toFixed(2)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Line Items</p>
          <p className="text-lg font-bold text-gray-100">{totals.totalBills}</p>
        </div>
      </div>

      {/* Category Summary */}
      {Object.keys(categoryTotals).length > 1 && (
        <div className="card !p-3">
          <h3 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-1.5">
            <HiOutlineChartBar className="w-4 h-4 text-primary-400" /> Category Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between px-3 py-2 bg-dark-bg rounded-lg border border-dark-border">
                  <div>
                    <span className="badge-info text-[10px]">{cat}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{data.quantity.toFixed(2)} qty • {data.count} items</p>
                  </div>
                  <span className="text-sm font-semibold text-primary-400">{formatCurrency(data.revenue)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Product Table */}
      {loading ? <Loader /> : salesData.length === 0 ? (
        <EmptyState icon={HiOutlineFilter} title="No sales data" description="No products sold in the selected period" />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-hover border-b border-dark-border">
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Product</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Category</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Qty Sold</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Avg Rate</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Revenue</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Bills</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {salesData.map((item, idx) => (
                  <tr key={item._id || idx} className="hover:bg-dark-hover/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-gray-200 font-medium">{item.productName}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="badge-info text-[10px]">{item.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{item.totalQuantity.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{formatCurrency(item.avgRate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary-400">{formatCurrency(item.totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{item.billCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-gray-500 italic">—</span>
                      <p className="text-[9px] text-gray-600">No purchase data</p>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-dark-hover border-t border-dark-border font-semibold">
                  <td className="px-4 py-2.5 text-gray-200">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-gray-200">{totals.totalQuantity.toFixed(2)}</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-primary-400">{formatCurrency(totals.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{totals.totalBills}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="card !p-3">
        <p className="text-xs text-gray-500">
          <span className="text-yellow-400">Note:</span> Profit column is placeholder — raw material purchase tracking is not yet available. 
          Once purchase data is integrated, profit will be calculated automatically.
        </p>
      </div>
    </div>
  );
}
