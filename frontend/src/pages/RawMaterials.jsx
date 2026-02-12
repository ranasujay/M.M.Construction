import { useState, useEffect } from 'react';
import { getRawMaterials, createRawMaterial, updateRawMaterial, adjustStock } from '../services/stockApi';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineAdjustments } from 'react-icons/hi';

const UNITS = ['kg', 'piece', 'meter', 'sqft', 'rft', 'foot'];

const defaultForm = { name: '', unit: 'kg', currentStock: '0', minimumStockAlert: '0', isActive: true };

export default function RawMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', notes: '' });
  const [adjustMaterial, setAdjustMaterial] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmData, setConfirmData] = useState({});

  const fetchMaterials = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await getRawMaterials(params);
      setMaterials(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMaterials(); }, [search]);

  const openCreate = () => {
    setForm(defaultForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (m) => {
    setForm({
      name: m.name,
      unit: m.unit,
      currentStock: m.currentStock.toString(),
      minimumStockAlert: m.minimumStockAlert.toString(),
      isActive: m.isActive,
      stockUpdateNotes: '',
    });
    setEditingId(m._id);
    setModalOpen(true);
  };

  const openAdjust = (m) => {
    setAdjustMaterial(m);
    setAdjustForm({ quantity: '', notes: '' });
    setAdjustOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    if (editingId) {
      // Check if stock is being manually changed
      const orig = materials.find(m => m._id === editingId);
      const newStock = parseFloat(form.currentStock) || 0;
      if (orig && newStock !== orig.currentStock) {
        setConfirmData({
          title: 'Confirm Stock Update',
          message: `Change stock of "${form.name}" from ${orig.currentStock} to ${newStock} ${orig.unit}? This will create an audit log.`,
          variant: 'warning',
        });
        setConfirmAction('submit');
        setConfirmOpen(true);
        return;
      }
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        currentStock: parseFloat(form.currentStock) || 0,
        minimumStockAlert: parseFloat(form.minimumStockAlert) || 0,
        stockUpdateNotes: form.stockUpdateNotes || '',
      };
      if (editingId) {
        await updateRawMaterial(editingId, payload);
        toast.success('Material updated');
      } else {
        await createRawMaterial(payload);
        toast.success('Material created');
      }
      setModalOpen(false);
      setLoading(true);
      fetchMaterials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const qty = parseFloat(adjustForm.quantity);
    if (!qty || qty === 0) { toast.error('Enter a valid quantity (+ or -)'); return; }
    setConfirmData({
      title: 'Confirm Stock Adjustment',
      message: `Adjust "${adjustMaterial.name}" stock by ${qty > 0 ? '+' : ''}${qty} ${adjustMaterial.unit}? Current: ${adjustMaterial.currentStock} → New: ${adjustMaterial.currentStock + qty}`,
      variant: qty < 0 ? 'danger' : 'warning',
    });
    setConfirmAction('adjust');
    setConfirmOpen(true);
  };

  const doAdjust = async () => {
    const qty = parseFloat(adjustForm.quantity);
    setSubmitting(true);
    try {
      await adjustStock(adjustMaterial._id, { quantity: qty, notes: adjustForm.notes });
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setLoading(true);
      fetchMaterials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    if (confirmAction === 'submit') doSubmit();
    else if (confirmAction === 'adjust') doAdjust();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Raw Materials</h1>
          <p className="text-xs text-gray-500">Manage inventory & stock levels</p>
        </div>
        <button onClick={openCreate} className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Search */}
      <input
        className="input max-w-sm"
        placeholder="Search materials..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {materials.map((m) => (
              <div key={m._id} className={`card !p-3 ${!m.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-100">{m.name}</h3>
                    <p className="text-xs text-gray-500">{m.unit}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openAdjust(m)} className="text-amber-400 hover:text-amber-300 p-1" title="Adjust stock">
                      <HiOutlineAdjustments className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-gray-200 p-1">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="text-xs text-gray-500">Current Stock</span>
                    <p className={`text-lg font-bold ${m.currentStock < 0 ? 'text-red-400' : m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {m.currentStock} {m.unit}
                    </p>
                  </div>
                  {m.minimumStockAlert > 0 && m.currentStock <= m.minimumStockAlert && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.currentStock < 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {m.currentStock < 0 ? '⚠ Negative' : '⚠ Low Stock'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                  <th>Min. Alert</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m._id} className={!m.isActive ? 'opacity-50' : ''}>
                    <td className="font-medium text-gray-200">{m.name}</td>
                    <td>{m.unit}</td>
                    <td>
                      <span className={`font-bold ${m.currentStock < 0 ? 'text-red-400' : m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {m.currentStock}
                      </span>
                    </td>
                    <td className="text-gray-500">{m.minimumStockAlert || '-'}</td>
                    <td>
                      {m.currentStock < 0 ? (
                        <span className="badge-danger">Negative</span>
                      ) : m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0 ? (
                        <span className="badge-warning">Low</span>
                      ) : (
                        <span className="badge-success">OK</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openAdjust(m)} className="text-amber-400 hover:text-amber-300 p-1" title="Adjust stock">
                          <HiOutlineAdjustments className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-gray-200 p-1" title="Edit">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {materials.length === 0 && <p className="text-center text-gray-500 py-8">No raw materials found.</p>}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Material' : 'New Raw Material'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Material Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Iron Rod" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Unit *</label>
              <select className="select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Min. Stock Alert</label>
              <input type="number" step="0.01" className="input" value={form.minimumStockAlert} onChange={(e) => setForm({ ...form, minimumStockAlert: e.target.value })} placeholder="10" />
            </div>
          </div>
          {!editingId && (
            <div>
              <label className="label">Opening Stock</label>
              <input type="number" step="0.01" className="input" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} placeholder="0" />
            </div>
          )}
          {editingId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Current Stock</label>
                <input type="number" step="0.01" className="input" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
              </div>
              <div>
                <label className="label">Reason for change</label>
                <input className="input" value={form.stockUpdateNotes || ''} onChange={(e) => setForm({ ...form, stockUpdateNotes: e.target.value })} placeholder="e.g. Physical count" />
              </div>
            </div>
          )}
          {editingId && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="matActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded" />
              <label htmlFor="matActive" className="text-sm text-gray-400">Active</label>
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

      {/* Stock Adjustment Modal */}
      <Modal isOpen={adjustOpen} onClose={() => setAdjustOpen(false)} title="Manual Stock Adjustment">
        {adjustMaterial && (
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
              <p className="text-sm text-gray-400">Material: <span className="text-gray-100 font-semibold">{adjustMaterial.name}</span></p>
              <p className="text-sm text-gray-400 mt-1">Current Stock: <span className={`font-bold ${adjustMaterial.currentStock < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{adjustMaterial.currentStock} {adjustMaterial.unit}</span></p>
            </div>
            <div>
              <label className="label">Quantity (use + or -) *</label>
              <input type="number" step="0.01" className="input" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} placeholder="e.g. 50 or -20" autoFocus />
              <p className="text-[10px] text-gray-500 mt-1">Positive = add stock, Negative = remove stock</p>
            </div>
            <div>
              <label className="label">Reason / Notes</label>
              <textarea className="input" rows="2" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} placeholder="Reason for adjustment..." />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAdjustOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
                {submitting ? 'Adjusting...' : 'Adjust Stock'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={confirmData.title}
        message={confirmData.message}
        variant={confirmData.variant || 'warning'}
      />
    </div>
  );
}
