import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil } from 'react-icons/hi';

const CATEGORIES = ['Grill', 'Shutter', 'Railing', 'Window', 'Gate', 'Custom'];
const UNITS = ['kg', 'sqft', 'piece', 'rft'];
const FITTING_TYPES = ['per_kg', 'per_sqft', 'per_piece', 'fixed'];

const defaultForm = {
  name: '', category: 'Grill', baseRate: '', unit: 'kg',
  fittingCharge: '0', fittingChargeType: 'per_kg', description: '', isActive: true,
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory) params.category = filterCategory;
      const { data } = await api.get('/products', { params });
      setProducts(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [filterCategory]);

  const openCreateModal = () => {
    setForm(defaultForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setForm({
      name: product.name,
      category: product.category,
      baseRate: product.baseRate.toString(),
      unit: product.unit,
      fittingCharge: product.fittingCharge?.toString() || '0',
      fittingChargeType: product.fittingChargeType || 'per_kg',
      description: product.description || '',
      isActive: product.isActive,
    });
    setEditingId(product._id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.baseRate) {
      toast.error('Name and rate are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        baseRate: parseFloat(form.baseRate),
        fittingCharge: parseFloat(form.fittingCharge) || 0,
      };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Products</h1>
          <p className="text-xs text-gray-500">Catalog & pricing</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !filterCategory ? 'bg-primary-600 text-white' : 'bg-dark-card text-gray-400 hover:bg-dark-hover border border-dark-border'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterCategory === cat ? 'bg-primary-600 text-white' : 'bg-dark-card text-gray-400 hover:bg-dark-hover border border-dark-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p._id} className={`card !p-3 sm:!p-4 relative ${!p.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="badge-info text-[10px] mb-1">{p.category}</span>
                  <h3 className="text-sm font-semibold text-gray-100 mt-1">{p.name}</h3>
                  {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                </div>
                <button onClick={() => openEditModal(p)} className="text-gray-400 hover:text-gray-200 p-1">
                  <HiOutlinePencil className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-lg sm:text-xl font-bold text-primary-400">{formatCurrency(p.baseRate)}</p>
                  <p className="text-[10px] text-gray-500">per {p.unit}</p>
                </div>
                {p.fittingCharge > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Fitting: {formatCurrency(p.fittingCharge)}</p>
                    <p className="text-xs text-gray-500">{p.fittingChargeType.replace('_', '/')}</p>
                  </div>
                )}
              </div>
              {!p.isActive && (
                <span className="absolute top-3 right-12 badge-danger">Inactive</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Product' : 'New Product'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Product Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MS Grill" />
            </div>
            <div>
              <label className="label">Category *</label>
              <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Base Rate (₹) *</label>
              <input type="number" step="0.01" className="input" value={form.baseRate} onChange={(e) => setForm({ ...form, baseRate: e.target.value })} placeholder="85" />
            </div>
            <div>
              <label className="label">Unit *</label>
              <select className="select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fitting Charge (₹)</label>
              <input type="number" step="0.01" className="input" value={form.fittingCharge} onChange={(e) => setForm({ ...form, fittingCharge: e.target.value })} />
            </div>
            <div>
              <label className="label">Fitting Charge Type</label>
              <select className="select" value={form.fittingChargeType} onChange={(e) => setForm({ ...form, fittingChargeType: e.target.value })}>
                {FITTING_TYPES.map((ft) => <option key={ft} value={ft}>{ft.replace('_', '/')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {editingId && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded" />
              <label htmlFor="isActive" className="text-sm text-gray-400">Active</label>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
