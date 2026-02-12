import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStockDashboard } from '../services/stockApi';
import Loader from '../components/Loader';
import StatCard from '../components/StatCard';
import { formatCurrency } from '../utils/helpers';
import { HiOutlineCube, HiOutlineExclamation, HiOutlineTrendingDown, HiOutlineShoppingCart } from 'react-icons/hi';

export default function StockDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getStockDashboard();
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <Loader text="Loading stock dashboard..." />;
  if (!data) return <div className="text-center text-gray-400 py-12">Failed to load dashboard</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Stock Dashboard</h1>
        <p className="text-xs text-gray-500">Raw material inventory overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <StatCard icon={HiOutlineCube} label="Total Materials" value={data.totalMaterials} color="primary" />
        <StatCard icon={HiOutlineTrendingDown} label="Negative Stock" value={data.negativeStock.length} color={data.negativeStock.length > 0 ? 'red' : 'green'} />
        <StatCard icon={HiOutlineExclamation} label="Low Stock" value={data.lowStock.length} color={data.lowStock.length > 0 ? 'yellow' : 'green'} />
        <StatCard icon={HiOutlineShoppingCart} label="Monthly Purchases" value={formatCurrency(data.monthlyPurchases.totalSpent)} subtext={`${data.monthlyPurchases.count} bill(s)`} color="purple" />
      </div>

      {/* Negative Stock */}
      {data.negativeStock.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-red-400 mb-3">⚠ Negative Stock Materials</h3>
          <div className="space-y-2">
            {data.negativeStock.map((m) => (
              <div key={m._id} className="flex items-center justify-between bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <span className="font-medium text-gray-200">{m.name}</span>
                <span className="text-red-400 font-bold">{m.currentStock} {m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock */}
      {data.lowStock.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-amber-400 mb-3">⚠ Low Stock Materials</h3>
          <div className="space-y-2">
            {data.lowStock.map((m) => (
              <div key={m._id} className="flex items-center justify-between bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <div>
                  <span className="font-medium text-gray-200">{m.name}</span>
                  <span className="text-xs text-gray-500 ml-2">(min: {m.minimumStockAlert})</span>
                </div>
                <span className="text-amber-400 font-bold">{m.currentStock} {m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Materials Stock */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-100">All Materials</h3>
          <Link to="/raw-materials" className="text-primary-400 hover:text-primary-300 text-sm">Manage →</Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th>Current Stock</th>
                <th>Min. Alert</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.materials.map((m) => (
                <tr key={m._id}>
                  <td className="font-medium text-gray-200">{m.name}</td>
                  <td>{m.unit}</td>
                  <td>
                    <span className={`font-bold ${m.currentStock < 0 ? 'text-red-400' : m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {m.currentStock}
                    </span>
                  </td>
                  <td className="text-gray-500">{m.minimumStockAlert || '-'}</td>
                  <td>
                    {m.currentStock < 0 ? <span className="badge-danger">Negative</span> :
                     m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0 ? <span className="badge-warning">Low</span> :
                     <span className="badge-success">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Consumption (Current Month) */}
      {data.monthlyConsumption.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-100 mb-3">This Month's Consumption</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Total Consumed</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyConsumption.map((mc) => (
                  <tr key={mc._id}>
                    <td className="font-medium text-gray-200">{mc.name}</td>
                    <td className="text-red-400 font-semibold">{mc.totalConsumed}</td>
                    <td>{mc.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12-Month Consumption History */}
      {data.yearlyConsumption && data.yearlyConsumption.length > 0 && (() => {
        // Build month columns for last 12 months
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) });
        }

        // Group by material
        const matMap = {};
        data.yearlyConsumption.forEach((item) => {
          const key = item.materialId;
          if (!matMap[key]) matMap[key] = { name: item.name, unit: item.unit, months: {} };
          matMap[key].months[`${item.year}-${item.month}`] = item.totalConsumed;
        });

        return (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">12-Month Consumption History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-hover border-b border-dark-border">
                    <th className="text-left px-3 py-2 text-[10px] uppercase text-gray-500 font-semibold sticky left-0 bg-dark-hover z-10">Material</th>
                    {months.map((m) => (
                      <th key={m.label} className="text-right px-2 py-2 text-[10px] uppercase text-gray-500 font-semibold whitespace-nowrap">{m.label}</th>
                    ))}
                    <th className="text-right px-3 py-2 text-[10px] uppercase text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {Object.values(matMap).sort((a, b) => a.name.localeCompare(b.name)).map((mat) => {
                    let total = 0;
                    return (
                      <tr key={mat.name} className="hover:bg-dark-hover/50">
                        <td className="px-3 py-2 font-medium text-gray-200 whitespace-nowrap sticky left-0 bg-dark-card z-10">
                          {mat.name} <span className="text-[10px] text-gray-500">({mat.unit})</span>
                        </td>
                        {months.map((m) => {
                          const val = mat.months[`${m.year}-${m.month}`] || 0;
                          total += val;
                          return (
                            <td key={m.label} className={`px-2 py-2 text-right ${val > 0 ? 'text-red-400' : 'text-gray-700'}`}>
                              {val > 0 ? val : '-'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-bold text-red-400">{total > 0 ? total : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
