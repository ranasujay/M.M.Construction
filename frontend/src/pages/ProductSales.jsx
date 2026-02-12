import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { formatCurrency } from '../utils/helpers';
import { HiOutlineChartBar, HiOutlineFilter } from 'react-icons/hi';

export default function ProductSales() {
  const [salesData, setSalesData] = useState([]);
  const [totals, setTotals] = useState({ totalRevenue: 0, totalQuantity: 0, totalBills: 0, totalCost: 0, totalProfit: 0, totalFittingRevenue: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fittingOnly, setFittingOnly] = useState(false);

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
      if (filterProduct) params.product = filterProduct;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (fittingOnly) params.fittingOnly = 'true';
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
  useEffect(() => { fetchSalesReport(); }, [filterCategory, filterProduct, startDate, endDate, fittingOnly]);

  // Group by category for summary
  const categoryTotals = salesData.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = { revenue: 0, quantity: 0, count: 0, cost: 0, profit: 0, unitQty: {} };
    acc[item.category].revenue += item.totalRevenue;
    acc[item.category].quantity += item.totalQuantity;
    acc[item.category].count += item.billCount;
    acc[item.category].cost += item.totalCost || 0;
    acc[item.category].profit += item.profit || 0;
    const u = item.unit || 'piece';
    acc[item.category].unitQty[u] = (acc[item.category].unitQty[u] || 0) + item.totalQuantity;
    return acc;
  }, {});

  // Group total qty by unit
  const totalQtyByUnit = salesData.reduce((acc, item) => {
    const u = item.unit || 'piece';
    acc[u] = (acc[u] || 0) + item.totalQuantity;
    return acc;
  }, {});
  const totalQtyDisplay = Object.entries(totalQtyByUnit).map(([u, q]) => `${q.toFixed(2)} ${u}`).join(', ');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">
          {fittingOnly ? 'Fitting Sales & Profit' : 'Product Sales & Profit'}
        </h1>
        <p className="text-xs text-gray-500">
          {fittingOnly ? 'Showing only products with fitting charges' : 'Product-wise selling analysis'}
        </p>
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
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Product</label>
            <input
              type="text"
              className="input !py-1.5 text-sm min-w-[140px]"
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              placeholder="Search product..."
            />
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
          <div className="flex items-end">
            <button
              onClick={() => setFittingOnly(!fittingOnly)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                fittingOnly
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-hover text-gray-400 border border-dark-border'
              }`}
            >
              {fittingOnly ? '✓ Fitting Only' : 'Fitting Only'}
            </button>
          </div>
          {(filterCategory || filterProduct || startDate || endDate || fittingOnly) && (
            <button
              onClick={() => { setFilterCategory(''); setFilterProduct(''); setStartDate(''); setEndDate(''); setFittingOnly(false); }}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Revenue</p>
          <p className="text-lg font-bold text-primary-400">{formatCurrency(totals.totalRevenue)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Material Cost</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totals.totalCost)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Profit</p>
          <p className={`text-lg font-bold ${totals.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totals.totalProfit)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Fitting Revenue</p>
          <p className="text-lg font-bold text-yellow-400">{formatCurrency(totals.totalFittingRevenue)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Qty Sold</p>
          <p className="text-sm font-bold text-gray-100">{totalQtyDisplay || '0'}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Profit Margin</p>
          <p className={`text-lg font-bold ${totals.totalRevenue > 0 && (totals.totalProfit / totals.totalRevenue) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totals.totalRevenue > 0 ? ((totals.totalProfit / totals.totalRevenue) * 100).toFixed(1) : 0}%
          </p>
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
                    <p className="text-xs text-gray-500 mt-0.5">{Object.entries(data.unitQty).map(([u, q]) => `${q.toFixed(1)} ${u}`).join(', ')} • {data.count} items</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-primary-400">{formatCurrency(data.revenue)}</span>
                    {data.profit !== 0 && (
                      <p className={`text-[10px] ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Profit: {formatCurrency(data.profit)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Product Table */}
      {loading ? <Loader /> : salesData.length === 0 ? (
        <EmptyState icon={HiOutlineFilter} title="No sales data" description="No products sold in the selected period" />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {salesData.map((item, idx) => (
              <div key={item._id || idx} className="card !p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{item.productName}</p>
                    <span className="badge-info text-[10px]">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary-400">{formatCurrency(item.totalRevenue)}</p>
                    <p className="text-[10px] text-gray-500">{item.totalQuantity.toFixed(2)} {item.unit || 'pcs'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-dark-border">
                  {item.fittingRevenue > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500">Fitting</p>
                      <p className="text-xs font-medium text-yellow-400">{formatCurrency(item.fittingRevenue)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-500">Cost</p>
                    <p className="text-xs font-medium text-red-400">
                      {item.hasCostData ? formatCurrency(item.totalCost) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Profit</p>
                    <p className={`text-xs font-medium ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.hasCostData ? formatCurrency(item.profit) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Margin</p>
                    <p className={`text-xs font-medium ${item.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.hasCostData ? `${item.profitMargin.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-hover border-b border-dark-border">
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Product</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Category</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Qty Sold</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Avg Rate</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Revenue</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Fitting</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Cost</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Profit</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase text-gray-500 font-semibold">Margin</th>
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
                    <td className="px-4 py-2.5 text-right text-gray-300">{item.totalQuantity.toFixed(2)} <span className="text-[10px] text-gray-500">{item.unit || 'pcs'}</span></td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{formatCurrency(item.avgRate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary-400">{formatCurrency(item.totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right text-yellow-400">
                      {item.fittingRevenue > 0 ? formatCurrency(item.fittingRevenue) : <span className="text-[10px] text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {item.hasCostData ? (
                        <span className="text-red-400">{formatCurrency(item.totalCost)}</span>
                      ) : (
                        <span className="text-[10px] text-gray-600 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {item.hasCostData ? (
                        <span className={`font-semibold ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(item.profit)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-600 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {item.hasCostData ? (
                        <span className={`text-xs ${item.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.profitMargin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-600 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-dark-hover border-t border-dark-border font-semibold">
                  <td className="px-4 py-2.5 text-gray-200">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-gray-200 text-xs">{totalQtyDisplay}</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-primary-400">{formatCurrency(totals.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right text-yellow-400">{formatCurrency(totals.totalFittingRevenue)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{formatCurrency(totals.totalCost)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={totals.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(totals.totalProfit)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={totals.totalRevenue > 0 && (totals.totalProfit / totals.totalRevenue) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {totals.totalRevenue > 0 ? ((totals.totalProfit / totals.totalRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </>
      )}

      <div className="card !p-3">
        <p className="text-xs text-gray-500">
          <span className="text-primary-400">Info:</span> Profit is calculated based on raw material consumption mapped to each product and average purchase rates. 
          Products showing "N/A" don't have material consumption data configured — update them in Products page.
        </p>
      </div>
    </div>
  );
}
