import { useState, useEffect } from 'react';
import { getPurchaseExpenses, getCustomExpenses, createCustomExpense, updateCustomExpense, deleteCustomExpense } from '../services/stockApi';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  HiOutlineTruck,
  HiOutlineCurrencyRupee,
  HiOutlineReceiptTax,
  HiOutlineFilter,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
} from 'react-icons/hi';

const defaultExpenseForm = { title: '', amount: '', date: '', category: '', notes: '' };

export default function PurchaseExpenses() {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({
    totalLoadingCost: 0,
    totalCarryingCost: 0,
    totalDiscount: 0,
    totalGrand: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [tab, setTab] = useState('purchase');

  // Custom expenses state
  const [customExpenses, setCustomExpenses] = useState([]);
  const [customTotal, setCustomTotal] = useState(0);
  const [customCategories, setCustomCategories] = useState([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(defaultExpenseForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (supplier) params.supplier = supplier;
      const res = await getPurchaseExpenses(params);
      setData(res.data.data);
      setTotals(res.data.totals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomExpenses = async () => {
    try {
      setCustomLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await getCustomExpenses(params);
      setCustomExpenses(res.data.data);
      setCustomTotal(res.data.total);
      setCustomCategories(res.data.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setCustomLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCustomExpenses();
  }, [startDate, endDate, supplier]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSupplier('');
  };

  const totalExtras = totals.totalLoadingCost + totals.totalCarryingCost;

  const openCreate = () => {
    setExpenseForm({ ...defaultExpenseForm, date: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setExpenseForm({
      title: exp.title,
      amount: exp.amount.toString(),
      date: new Date(exp.date).toISOString().split('T')[0],
      category: exp.category || '',
      notes: exp.notes || '',
    });
    setEditingId(exp._id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) { toast.error('Title is required'); return; }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: expenseForm.title,
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date || new Date(),
        category: expenseForm.category || 'Other',
        notes: expenseForm.notes,
      };
      if (editingId) {
        await updateCustomExpense(editingId, payload);
        toast.success('Expense updated');
      } else {
        await createCustomExpense(payload);
        toast.success('Expense added');
      }
      setModalOpen(false);
      fetchCustomExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteCustomExpense(deleteConfirm._id);
      toast.success('Expense deleted');
      setDeleteConfirm(null);
      fetchCustomExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Purchase & Custom Expenses</h1>
        <p className="text-sm text-gray-400">Loading costs, carrying charges, discounts & other expenses</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-border pb-0">
        <button
          onClick={() => setTab('purchase')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${tab === 'purchase' ? 'bg-dark-card text-primary-400 border border-dark-border border-b-transparent' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Purchase Expenses
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${tab === 'custom' ? 'bg-dark-card text-primary-400 border border-dark-border border-b-transparent' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Custom Expenses ({customExpenses.length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <HiOutlineFilter className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200" />
          </div>
          {tab === 'purchase' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Supplier</label>
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Search supplier..." className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500" />
            </div>
          )}
          <div className="flex items-end">
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition">
              <HiOutlineRefresh className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>
      </div>

      {tab === 'purchase' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Loading Costs" value={formatCurrency(totals.totalLoadingCost)} icon={HiOutlineTruck} color="blue" />
            <StatCard title="Carrying Costs" value={formatCurrency(totals.totalCarryingCost)} icon={HiOutlineCurrencyRupee} color="yellow" />
            <StatCard title="Total Extras" value={formatCurrency(totalExtras)} icon={HiOutlineReceiptTax} color="red" />
            <StatCard title="Total Discount" value={formatCurrency(totals.totalDiscount)} icon={HiOutlineCurrencyRupee} color="green" />
          </div>

          {/* Net Extra Cost */}
          <div className="bg-gray-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-sm text-gray-400">Net Extra Cost (Loading + Carrying - Discount)</span>
              <p className="text-lg font-bold text-gray-100">{formatCurrency(totalExtras - totals.totalDiscount)}</p>
            </div>
            <div className="text-sm text-gray-400">
              From <span className="text-gray-200 font-medium">{totals.count}</span> purchase bills
            </div>
          </div>

          {/* Detail List */}
          {loading ? (
            <Loader />
          ) : data.length === 0 ? (
            <EmptyState message="No purchase expenses found" />
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2">
                {data.map((p) => (
                  <div key={p._id} className="bg-gray-800 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-blue-400 font-mono">#{p.billNumber}</span>
                        <p className="text-sm font-medium text-gray-200">{p.supplierName}</p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-gray-700">
                      <div>
                        <p className="text-[10px] text-gray-500">Loading Cost</p>
                        <p className="text-xs font-medium text-blue-400">{formatCurrency(p.loadingCost || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Carrying Cost</p>
                        <p className="text-xs font-medium text-yellow-400">{formatCurrency(p.carryingCost || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Discount</p>
                        <p className="text-xs font-medium text-green-400">{formatCurrency(p.discount || 0)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between pt-1">
                      {p.paidAmount > 0 && (
                        <span className="text-[10px] text-emerald-400">Paid: {formatCurrency(p.paidAmount)}</span>
                      )}
                      <span className="text-[10px] text-gray-500 ml-auto">Bill Total: <span className="text-gray-300">{formatCurrency(p.grandTotal)}</span></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="px-4 py-3">Bill #</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Loading Cost</th>
                        <th className="px-4 py-3 text-right">Carrying Cost</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Bill Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {data.map((p) => (
                        <tr key={p._id} className="hover:bg-gray-750">
                          <td className="px-4 py-3 text-blue-400 font-mono text-xs">#{p.billNumber}</td>
                          <td className="px-4 py-3 text-gray-200">{p.supplierName}</td>
                          <td className="px-4 py-3 text-gray-400">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-blue-400">{formatCurrency(p.loadingCost || 0)}</td>
                          <td className="px-4 py-3 text-right text-yellow-400">{formatCurrency(p.carryingCost || 0)}</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatCurrency(p.discount || 0)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{p.paidAmount > 0 ? formatCurrency(p.paidAmount) : <span className="text-gray-600">—</span>}</td>
                          <td className="px-4 py-3 text-right text-gray-200 font-medium">{formatCurrency(p.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-600">
                      <tr className="font-medium text-gray-200">
                        <td colSpan={3} className="px-4 py-3">Totals ({data.length} bills with extras)</td>
                        <td className="px-4 py-3 text-right text-blue-400">{formatCurrency(data.reduce((s, p) => s + (p.loadingCost || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-yellow-400">{formatCurrency(data.reduce((s, p) => s + (p.carryingCost || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-green-400">{formatCurrency(data.reduce((s, p) => s + (p.discount || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(data.reduce((s, p) => s + (p.paidAmount || 0), 0))}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(data.reduce((s, p) => s + p.grandTotal, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        /* Custom Expenses Tab */
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="card !p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Total Custom Expenses</p>
              <p className="text-lg font-bold text-red-400">{formatCurrency(customTotal)}</p>
            </div>
            <div className="card !p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Expense Count</p>
              <p className="text-lg font-bold text-gray-100">{customExpenses.length}</p>
            </div>
            <div className="card !p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] text-gray-500 uppercase">Categories</p>
              <p className="text-lg font-bold text-primary-400">{customCategories.length}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={openCreate} className="btn-primary !py-2 !px-4 text-sm">
              <HiOutlinePlus className="w-4 h-4" /> Add Expense
            </button>
          </div>

          {customLoading ? <Loader /> : customExpenses.length === 0 ? (
            <EmptyState message="No custom expenses yet. Add your first expense!" />
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2">
                {customExpenses.map((exp) => (
                  <div key={exp._id} className="bg-gray-800 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{exp.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded">{exp.category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(exp)} className="text-gray-400 hover:text-gray-200 p-1"><HiOutlinePencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm(exp)} className="text-red-400 hover:text-red-300 p-1"><HiOutlineTrash className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-xs text-gray-400">{new Date(exp.date).toLocaleDateString('en-IN')}</span>
                      <span className="text-sm font-bold text-red-400">{formatCurrency(exp.amount)}</span>
                    </div>
                    {exp.notes && <p className="text-xs text-gray-500">{exp.notes}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {customExpenses.map((exp) => (
                        <tr key={exp._id} className="hover:bg-gray-750">
                          <td className="px-4 py-3 text-gray-200 font-medium">{exp.title}</td>
                          <td className="px-4 py-3"><span className="text-[10px] px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded">{exp.category}</span></td>
                          <td className="px-4 py-3 text-gray-400">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{exp.notes || '—'}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-semibold">{formatCurrency(exp.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(exp)} className="text-gray-400 hover:text-gray-200 p-1" title="Edit"><HiOutlinePencil className="w-4 h-4" /></button>
                              <button onClick={() => setDeleteConfirm(exp)} className="text-red-400 hover:text-red-300 p-1" title="Delete"><HiOutlineTrash className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-600">
                      <tr className="font-medium text-gray-200">
                        <td colSpan={4} className="px-4 py-3">Total ({customExpenses.length} expenses)</td>
                        <td className="px-4 py-3 text-right text-red-400 font-bold">{formatCurrency(customTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Grand Total Banner */}
      <div className="bg-gray-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-dark-border">
        <div>
          <span className="text-sm text-gray-400">Grand Total All Expenses</span>
          <p className="text-lg font-bold text-red-400">
            {formatCurrency((totalExtras - totals.totalDiscount) + customTotal)}
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Purchase extras: {formatCurrency(totalExtras - totals.totalDiscount)} + Custom: {formatCurrency(customTotal)}
        </div>
      </div>

      {/* Create/Edit Custom Expense Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Expense' : 'New Custom Expense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} placeholder="e.g. Transport, Phone Bill, Brokerage" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" step="0.01" className="input" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="e.g. Transport, Office, Labour" list="expCatList" />
            <datalist id="expCatList">
              {customCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Optional" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={deleteConfirm ? `Delete "${deleteConfirm.title}" (${formatCurrency(deleteConfirm.amount)})? This cannot be undone.` : ''}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
