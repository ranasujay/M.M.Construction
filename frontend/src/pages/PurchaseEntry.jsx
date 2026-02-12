import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRawMaterials, createPurchase, getSupplierNames } from '../services/stockApi';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineArrowLeft } from 'react-icons/hi';

// Searchable dropdown component
function SearchSelect({ value, onChange, options, placeholder, displayKey, valueKey, renderOption, className = '' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    (displayKey ? o[displayKey] : o).toLowerCase().includes(query.toLowerCase())
  );

  const selectedLabel = value ? options.find((o) => (valueKey ? o[valueKey] : o) === value) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        className="input w-full"
        placeholder={placeholder}
        value={open ? query : selectedLabel ? (displayKey ? selectedLabel[displayKey] : selectedLabel) : query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-dark-card border border-dark-border rounded-lg shadow-xl">
          {filtered.map((o, i) => (
            <button key={valueKey ? o[valueKey] : i} type="button"
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-dark-hover transition-colors"
              onClick={() => { onChange(valueKey ? o[valueKey] : o); setQuery(displayKey ? o[displayKey] : o); setOpen(false); }}
            >
              {renderOption ? renderOption(o) : (displayKey ? o[displayKey] : o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchaseEntry() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [supplierName, setSupplierName] = useState('');
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const supplierRef = useRef(null);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loadingCost, setLoadingCost] = useState('');
  const [carryingCost, setCarryingCost] = useState('');
  const [discount, setDiscount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [items, setItems] = useState([{ rawMaterial: '', quantity: '', ratePerUnit: '' }]);

  useEffect(() => {
    const handler = (e) => { if (supplierRef.current && !supplierRef.current.contains(e.target)) setShowSupplierDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (supplierName.trim().length >= 1) {
      getSupplierNames(supplierName).then((res) => setSupplierSuggestions(res.data.data)).catch(() => {});
    } else { setSupplierSuggestions([]); }
  }, [supplierName]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const matRes = await getRawMaterials({ active: 'true' });
        setMaterials(matRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const addItem = () => setItems([...items, { rawMaterial: '', quantity: '', ratePerUnit: '' }]);

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const getItemTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.ratePerUnit) || 0;
    return Math.round(qty * rate * 100) / 100;
  };

  const itemsTotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const extraCosts = (parseFloat(loadingCost) || 0) + (parseFloat(carryingCost) || 0);
  const discountAmt = parseFloat(discount) || 0;
  const grandTotal = Math.round((itemsTotal + extraCosts - discountAmt) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierName.trim()) { toast.error('Supplier name is required'); return; }

    const validItems = items.filter((item) => item.rawMaterial && item.quantity && item.ratePerUnit);
    if (validItems.length === 0) { toast.error('Add at least one valid item'); return; }

    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const validItems = items.filter((item) => item.rawMaterial && item.quantity && item.ratePerUnit);
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const payload = {
        supplierName: supplierName.trim(),
        purchaseDate,
        notes,
        loadingCost: parseFloat(loadingCost) || 0,
        carryingCost: parseFloat(carryingCost) || 0,
        discount: parseFloat(discount) || 0,
        paidAmount: parseFloat(paidAmount) || 0,
        items: validItems.map((item) => ({
          rawMaterial: item.rawMaterial,
          quantity: parseFloat(item.quantity),
          ratePerUnit: parseFloat(item.ratePerUnit),
        })),
      };
      await createPurchase(payload);
      toast.success('Purchase bill created & stock updated');
      navigate('/purchases');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader text="Loading materials..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/purchases')} className="text-gray-400 hover:text-gray-200">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-100">New Purchase Bill</h1>
          <p className="text-xs text-gray-500">Record a raw material purchase</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name *</label>
              <div ref={supplierRef} className="relative">
                <input className="input" value={supplierName} onChange={(e) => { setSupplierName(e.target.value); setShowSupplierDropdown(true); }} onFocus={() => setShowSupplierDropdown(true)} placeholder="e.g. ABC Steel Traders" />
                {showSupplierDropdown && supplierSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto bg-dark-card border border-dark-border rounded-lg shadow-xl">
                    {supplierSuggestions.filter(n => n.toLowerCase().includes(supplierName.toLowerCase())).map((name) => (
                      <button key={name} type="button" className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-dark-hover transition-colors" onClick={() => { setSupplierName(name); setShowSupplierDropdown(false); }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Purchase Date *</label>
              <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Items</label>
              <button type="button" onClick={addItem} className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
                <HiOutlinePlus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <label className="text-xs text-gray-500">Material *</label>
                      <SearchSelect
                        value={item.rawMaterial}
                        onChange={(val) => updateItem(i, 'rawMaterial', val)}
                        options={materials}
                        placeholder="Search material..."
                        displayKey="name"
                        valueKey="_id"
                        renderOption={(m) => <span>{m.name} <span className="text-gray-500">({m.unit})</span></span>}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs text-gray-500">Quantity *</label>
                      <input type="number" step="0.01" min="0.01" className="input !py-2 text-sm" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} placeholder="0" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs text-gray-500">Rate / Unit (₹) *</label>
                      <input type="number" step="0.01" min="0" className="input !py-2 text-sm" value={item.ratePerUnit} onChange={(e) => updateItem(i, 'ratePerUnit', e.target.value)} placeholder="0" />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-sm font-semibold text-primary-400">{formatCurrency(getItemTotal(item))}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-1">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extra costs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="label">Loading Cost (₹)</label>
              <input type="number" step="0.01" min="0" className="input" value={loadingCost} onChange={(e) => setLoadingCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Carrying / Freight (₹)</label>
              <input type="number" step="0.01" min="0" className="input" value={carryingCost} onChange={(e) => setCarryingCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Discount (₹)</label>
              <input type="number" step="0.01" min="0" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Payment Given (₹)</label>
              <input type="number" step="0.01" min="0" className="input" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Grand total */}
          <div className="flex justify-end">
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border text-right min-w-[200px]">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Items Total</span>
                  <span>{formatCurrency(itemsTotal)}</span>
                </div>
                {(parseFloat(loadingCost) || 0) > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Loading</span>
                    <span>+{formatCurrency(parseFloat(loadingCost))}</span>
                  </div>
                )}
                {(parseFloat(carryingCost) || 0) > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Carrying</span>
                    <span>+{formatCurrency(parseFloat(carryingCost))}</span>
                  </div>
                )}
                {discountAmt > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dark-border pt-1">
                  <span className="text-xs text-gray-500">Grand Total</span>
                  <span className="text-xl font-bold text-primary-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate('/purchases')} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : 'Save Purchase Bill'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title="Create Purchase Bill?"
        message={`Save purchase of ${formatCurrency(grandTotal)} from "${supplierName}"? Stock will be updated automatically.`}
        confirmText="Create & Update Stock"
        variant="info"
        loading={submitting}
      />
    </div>
  );
}
