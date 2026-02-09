import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineTrash, HiOutlinePlus, HiOutlineSearch, HiOutlineUserAdd } from 'react-icons/hi';

export default function CreateBill() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline new customer creation
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', address: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [productSearch, setProductSearch] = useState({});
  const [showProductDD, setShowProductDD] = useState({});

  const [form, setForm] = useState({
    customer: null,
    customerName: '',
    items: [{ product: '', quantity: '', rate: '', unit: 'kg', hasFitting: false }],
    fittingRate: '',
    discount: 0,
    discountType: 'flat',
    advancePayment: 0,
    advancePaymentMode: 'Cash',
    deliveryDate: '',
    notes: '',
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await api.get('/products', { params: { active: 'true' } });
        setProducts(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  const searchCustomers = useCallback(
    debounce(async (term) => {
      if (!term) { setCustomers([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: term, limit: 8 } });
        setCustomers(data.data);
        setShowCustomerDropdown(true);
      } catch (err) {
        console.error(err);
      }
    }, 300),
    []
  );

  const selectCustomer = (customer) => {
    setForm((prev) => ({ ...prev, customer: customer._id, customerName: `${customer.name} — ${customer.phone}`, customerAdvance: customer.advanceBalance || 0 }));
    setCustomerSearch(`${customer.name} — ${customer.phone}`);
    setShowCustomerDropdown(false);
    setShowNewCustomer(false);
  };

  // Create new customer inline
  const handleCreateCustomer = async () => {
    if (!newCustForm.name || !newCustForm.phone || !newCustForm.address) {
      toast.error('Name, WhatsApp no. & address are required');
      return;
    }
    setCreatingCustomer(true);
    try {
      const { data } = await api.post('/customers', newCustForm);
      const c = data.data;
      selectCustomer(c);
      toast.success(`Customer "${c.name}" created`);
      setNewCustForm({ name: '', phone: '', address: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product: '', quantity: '', rate: '', unit: 'kg', hasFitting: false }],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'product' && value) {
        const product = products.find((p) => p._id === value);
        if (product) {
          items[index].rate = product.baseRate;
          items[index].unit = product.unit;
          items[index].hasFitting = product.fittingCharge > 0;
          // Set the search text to show product name
          setProductSearch((prev) => ({ ...prev, [index]: `${product.name} (${product.category})` }));
          setShowProductDD((prev) => ({ ...prev, [index]: false }));
        }
      }
      return { ...prev, items };
    });
  };

  const getFilteredProducts = (index) => {
    const term = (productSearch[index] || '').toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );
  };

  const calculateLineTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    return qty * rate;
  };

  // Fitting: sum of weights of checked items × single fitting rate
  const fittingWeight = form.items
    .filter((item) => item.hasFitting)
    .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const fittingRateNum = parseFloat(form.fittingRate) || 0;
  const totalFittingCharge = Math.round(fittingWeight * fittingRateNum * 100) / 100;
  const hasFittingItems = form.items.some((item) => item.hasFitting);

  const subtotal = form.items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const discountAmount = form.discountType === 'percent' ? (subtotal * (form.discount || 0)) / 100 : (form.discount || 0);
  const grandTotal = Math.max(0, subtotal + totalFittingCharge - discountAmount);
  const dueAmount = Math.max(0, grandTotal - (form.advancePayment || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer) {
      toast.error('Please select a customer');
      return;
    }
    if (form.items.some((item) => !item.product || !item.quantity)) {
      toast.error('Complete all line items');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer: form.customer,
        items: form.items.map((item) => ({
          product: item.product,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          fittingCharge: item.hasFitting ? fittingRateNum : 0,
          fittingChargeType: 'per_kg',
          unit: item.unit,
        })),
        discount: parseFloat(form.discount) || 0,
        discountType: form.discountType,
        advancePayment: parseFloat(form.advancePayment) || 0,
        advancePaymentMode: form.advancePaymentMode || 'Cash',
        deliveryDate: form.deliveryDate || undefined,
        notes: form.notes,
      };
      const { data } = await api.post('/bills', payload);
      toast.success(`Bill ${data.data.billNumber} created!`);
      navigate(`/bills/${data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Create New Bill</h1>
        <p className="text-xs text-gray-500">Add items, set rates, and generate invoice</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer selection */}
        <div className="card !p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">Customer</h3>
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="input pl-9 !py-2 text-sm"
              placeholder="Search by name or WhatsApp no..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
                if (!e.target.value) setForm((prev) => ({ ...prev, customer: null, customerName: '' }));
              }}
              onFocus={() => customers.length > 0 && setShowCustomerDropdown(true)}
            />
            {showCustomerDropdown && customers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-dark-hover transition-colors border-b border-dark-border last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-200">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone} {c.address ? `• ${c.address}` : ''}</p>
                    {c.currentDue > 0 && <p className="text-xs text-red-400">Due: {formatCurrency(c.currentDue)}</p>}
                    {c.advanceBalance > 0 && <p className="text-xs text-emerald-400">Advance: {formatCurrency(c.advanceBalance)}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.customer && (
            <div className="mt-1.5 flex items-center gap-3">
              <p className="text-xs text-emerald-400">✓ {form.customerName}</p>
              {form.customerAdvance > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Advance: {formatCurrency(form.customerAdvance)} (will auto-apply)
                </span>
              )}
            </div>
          )}

          {/* New customer toggle */}
          {!form.customer && (
            <button
              type="button"
              onClick={() => setShowNewCustomer(!showNewCustomer)}
              className="mt-2 text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <HiOutlineUserAdd className="w-4 h-4" />
              {showNewCustomer ? 'Cancel' : 'Create new customer'}
            </button>
          )}

          {/* Inline new customer form */}
          {showNewCustomer && !form.customer && (
            <div className="mt-3 p-3 bg-dark-bg rounded-lg border border-dark-border space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className="input !py-2 text-sm" placeholder="Name *" value={newCustForm.name} onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })} />
                <input className="input !py-2 text-sm" placeholder="WhatsApp No. *" value={newCustForm.phone} onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })} />
              </div>
              <input className="input !py-2 text-sm" placeholder="Address *" value={newCustForm.address} onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })} />
              <div className="flex justify-end">
                <button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer} className="btn-primary !py-2 !px-4 text-sm whitespace-nowrap">
                  {creatingCustomer ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Line Items</h3>
            <button type="button" onClick={addItem} className="btn-secondary !py-1.5 !px-3 text-xs">
              <HiOutlinePlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={index} className="p-3 bg-dark-bg rounded-lg border border-dark-border space-y-2">
                {/* Product search + delete */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className="input text-sm !py-2 w-full"
                      placeholder="Type product name..."
                      value={productSearch[index] ?? ''}
                      onChange={(e) => {
                        setProductSearch((prev) => ({ ...prev, [index]: e.target.value }));
                        setShowProductDD((prev) => ({ ...prev, [index]: true }));
                        // Clear selection if user edits text
                        if (item.product) {
                          updateItem(index, 'product', '');
                        }
                      }}
                      onFocus={() => setShowProductDD((prev) => ({ ...prev, [index]: true }))}
                      onBlur={() => setTimeout(() => setShowProductDD((prev) => ({ ...prev, [index]: false })), 200)}
                    />
                    {showProductDD[index] && (
                      <div className="absolute z-20 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-44 overflow-y-auto">
                        {getFilteredProducts(index).length > 0 ? (
                          getFilteredProducts(index).map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => updateItem(index, 'product', p._id)}
                              className="w-full text-left px-3 py-2 hover:bg-dark-hover border-b border-dark-border last:border-0"
                            >
                              <span className="text-sm text-gray-200">{p.name}</span>
                              <span className="text-[10px] text-gray-500 ml-2">({p.category})</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-xs text-gray-500">No products found</p>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => removeItem(index)} disabled={form.items.length === 1} className="text-red-400 hover:text-red-300 disabled:opacity-30 p-2">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
                {/* Qty, Unit, Rate */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Qty/Wt</label>
                    <input type="number" step="0.01" className="input text-sm !py-1.5" placeholder="0" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Unit</label>
                    <select className="select text-sm !py-1.5" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)}>
                      <option value="kg">kg</option><option value="sqft">sqft</option><option value="piece">pc</option><option value="rft">rft</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Rate ₹</label>
                    <input type="number" step="0.01" className="input text-sm !py-1.5" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} />
                  </div>
                </div>
                {/* Fitting checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.hasFitting || false}
                    onChange={(e) => updateItem(index, 'hasFitting', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">Fitting</span>
                  {item.hasFitting && parseFloat(item.quantity) > 0 && (
                    <span className="text-[10px] text-gray-500 ml-1">({parseFloat(item.quantity)} {item.unit})</span>
                  )}
                </label>
                <div className="text-right">
                  <span className="text-xs text-gray-500">Total: </span>
                  <span className="text-sm font-semibold text-primary-400">{formatCurrency(calculateLineTotal(item))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extras + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card !p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Extras</h3>
            {/* Fitting rate — shown when any item has fitting checked */}
            {hasFittingItems && (
              <div className="p-3 bg-primary-900/20 rounded-lg border border-primary-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">⚙ Fitting Rate ₹ / unit</label>
                  <span className="text-[10px] text-gray-500">Fitting Wt: {fittingWeight.toFixed(2)}</span>
                </div>
                <input type="number" step="0.01" className="input !py-2 text-sm" value={form.fittingRate} onChange={(e) => setForm({ ...form, fittingRate: e.target.value })} placeholder="Enter fitting rate" />
                {totalFittingCharge > 0 && (
                  <p className="text-xs text-primary-400">{fittingWeight.toFixed(2)} × ₹{fittingRateNum} = {formatCurrency(totalFittingCharge)}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Discount</label>
                <input type="number" step="0.01" className="input !py-2 text-sm" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Type</label>
                <select className="select !py-2 text-sm" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                  <option value="flat">Flat ₹</option><option value="percent">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Advance ₹</label>
              <input type="number" step="0.01" className="input !py-2 text-sm" value={form.advancePayment} onChange={(e) => setForm({ ...form, advancePayment: e.target.value })} />
            </div>
            {(parseFloat(form.advancePayment) || 0) > 0 && (
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Advance Mode</label>
                <select className="select !py-2 text-sm" value={form.advancePaymentMode} onChange={(e) => setForm({ ...form, advancePaymentMode: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Delivery</label>
              <input type="date" className="input !py-2 text-sm" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Notes</label>
              <textarea className="input text-sm" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            </div>
          </div>

          <div className="card !p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Bill Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="text-gray-200">{formatCurrency(subtotal)}</span></div>
              {totalFittingCharge > 0 && (
                <div className="flex justify-between"><span className="text-gray-400">Fitting ({fittingWeight.toFixed(2)} × ₹{fittingRateNum})</span><span className="text-primary-400">+{formatCurrency(totalFittingCharge)}</span></div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between"><span className="text-gray-400">Discount {form.discountType === 'percent' ? `(${form.discount}%)` : ''}</span><span className="text-red-400">-{formatCurrency(discountAmount)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-dark-border pt-2">
                <span className="text-gray-200">Grand Total</span><span className="text-primary-400">{formatCurrency(grandTotal)}</span>
              </div>
              {(form.advancePayment || 0) > 0 && (
                <div className="flex justify-between"><span className="text-gray-400">Advance</span><span className="text-emerald-400">-{formatCurrency(form.advancePayment)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-dark-border pt-2">
                <span className="text-gray-200">Due</span>
                <span className={dueAmount > 0 ? 'text-red-400' : 'text-emerald-400'}>{formatCurrency(dueAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={() => navigate('/bills')} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-success w-full sm:w-auto justify-center text-base">
            {submitting ? 'Creating...' : 'Create Bill'}
          </button>
        </div>
      </form>
    </div>
  );
}
