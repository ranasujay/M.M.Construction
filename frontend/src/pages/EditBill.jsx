import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import { formatCurrency, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineTrash, HiOutlinePlus, HiOutlineArrowLeft, HiOutlineSearch } from 'react-icons/hi';

export default function EditBill() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState(null);

  const [productSearch, setProductSearch] = useState({});
  const [showProductDD, setShowProductDD] = useState({});

  // Customer search
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  const [form, setForm] = useState({
    items: [],
    fittingRate: '',
    fittingMode: 'per_weight',
    discount: 0,
    discountType: 'flat',
    paymentReceived: '',
    paymentMode: 'Cash',
    deliveryDate: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [billRes, prodRes] = await Promise.all([
          api.get(`/bills/${id}`),
          api.get('/products', { params: { active: 'true' } }),
        ]);
        const b = billRes.data.data;
        setBill(b);
        setProducts(prodRes.data.data);

        // Determine fittingRate from items (all fitted items share same rate)
        let fRate = '';
        let fMode = 'per_weight';
        const fittedItem = b.items.find((it) => it.fittingCharge > 0);
        if (fittedItem) {
          fRate = fittedItem.fittingCharge;
          if (fittedItem.fittingChargeType === 'fixed') fMode = 'fixed';
        }

        // Build form items + product search state
        const psState = {};
        const formItems = b.items.map((it, i) => {
          psState[i] = `${it.productName} (${it.category})`;
          return {
            product: it.product?._id || it.product,
            quantity: it.quantity,
            rate: it.rate,
            unit: it.unit,
            hasFitting: it.fittingCharge > 0,
          };
        });
        setProductSearch(psState);

        // Set customer
        setSelectedCustomer(b.customer);
        setCustSearch(b.customer?.name || '');

        setForm({
          items: formItems,
          fittingRate: fRate,
          fittingMode: fMode,
          discount: b.discount || 0,
          discountType: b.discountType || 'flat',
          paymentReceived: '',
          paymentMode: 'Cash',
          deliveryDate: b.deliveryDate ? b.deliveryDate.substring(0, 10) : '',
          notes: b.notes || '',
        });
      } catch (err) {
        console.error(err);
        toast.error('Failed to load bill');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Customer search with debounce
  const searchCustomers = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 2) { setCustResults([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: q } });
        setCustResults(data.data || []);
        setShowCustDropdown(true);
      } catch { setCustResults([]); }
    }, 300),
    []
  );

  const handleCustSearch = (val) => {
    setCustSearch(val);
    if (!val) { setSelectedCustomer(null); setShowCustDropdown(false); }
    searchCustomers(val);
  };

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustSearch(c.name);
    setShowCustDropdown(false);
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
    // Clean up product search state
    setProductSearch((prev) => {
      const updated = {};
      Object.keys(prev).forEach((k) => {
        const ki = parseInt(k);
        if (ki < index) updated[ki] = prev[ki];
        else if (ki > index) updated[ki - 1] = prev[ki];
      });
      return updated;
    });
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

  // Fitting: per_weight = sum of weights × rate, fixed = flat amount
  const fittingWeight = form.items
    .filter((item) => item.hasFitting)
    .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const fittingRateNum = parseFloat(form.fittingRate) || 0;
  const totalFittingCharge = form.fittingMode === 'fixed'
    ? fittingRateNum
    : Math.round(fittingWeight * fittingRateNum * 100) / 100;
  const hasFittingItems = form.items.some((item) => item.hasFitting);

  const subtotal = form.items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const discountAmount = form.discountType === 'percent' ? (subtotal * (form.discount || 0)) / 100 : (form.discount || 0);
  const grandTotal = Math.max(0, Math.round(subtotal + totalFittingCharge - discountAmount));
  const paymentReceivedNum = parseFloat(form.paymentReceived) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.some((item) => !item.product || !item.quantity)) {
      toast.error('Complete all line items');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Select a customer');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer: selectedCustomer._id,
        items: (() => {
          let fittingAssigned = false;
          return form.items.map((item) => {
            let fc = 0;
            let fct = 'per_kg';
            if (item.hasFitting) {
              if (form.fittingMode === 'fixed') {
                if (!fittingAssigned) {
                  fc = fittingRateNum;
                  fittingAssigned = true;
                }
                fct = 'fixed';
              } else {
                fc = fittingRateNum;
                fct = 'per_kg';
              }
            }
            return {
              product: item.product,
              quantity: parseFloat(item.quantity),
              rate: parseFloat(item.rate),
              fittingCharge: fc,
              fittingChargeType: fct,
              unit: item.unit,
            };
          });
        })(),
        discount: parseFloat(form.discount) || 0,
        discountType: form.discountType,
        paymentReceived: paymentReceivedNum > 0 ? paymentReceivedNum : undefined,
        paymentMode: paymentReceivedNum > 0 ? form.paymentMode : undefined,
        deliveryDate: form.deliveryDate || undefined,
        notes: form.notes,
      };
      await api.put(`/bills/${id}`, payload);
      toast.success('Bill updated!');
      navigate(`/bills/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader text="Loading bill..." />;
  if (!bill) return <div className="text-center text-gray-400 py-12">Bill not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={`/bills/${id}`} className="text-gray-400 hover:text-gray-200">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-100">Edit Bill — {bill.billNumber}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer search */}
        <div className="card !p-4">
          <label className="label">Customer *</label>
          <div className="relative">
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input !pl-9"
                value={custSearch}
                onChange={(e) => handleCustSearch(e.target.value)}
                placeholder="Search customer by name or phone..."
              />
            </div>
            {showCustDropdown && custResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {custResults.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-2 hover:bg-dark-hover text-sm"
                  >
                    <span className="text-gray-200 font-medium">{c.name}</span>
                    <span className="text-gray-500 ml-2">📱 {c.phone}</span>
                    {c.currentDue > 0 && <span className="text-red-400 ml-2 text-xs">Due: {formatCurrency(c.currentDue)}</span>}
                    {c.advanceBalance > 0 && <span className="text-amber-400 ml-2 text-xs">Adv: {formatCurrency(c.advanceBalance)}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 p-2 bg-dark-bg rounded-lg border border-dark-border text-xs">
                <span className="text-gray-200 font-semibold">{selectedCustomer.name}</span>
                {selectedCustomer.phone && <span className="text-gray-500 ml-2">📱 {selectedCustomer.phone}</span>}
                {selectedCustomer.currentDue > 0 && <span className="text-red-400 ml-3">Due: {formatCurrency(selectedCustomer.currentDue)}</span>}
                {selectedCustomer.advanceBalance > 0 && <span className="text-amber-400 ml-3">Advance: {formatCurrency(selectedCustomer.advanceBalance)}</span>}
              </div>
            )}
          </div>
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
                        if (item.product) updateItem(index, 'product', '');
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
            {hasFittingItems && (
              <div className="p-3 bg-primary-900/20 rounded-lg border border-primary-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">⚙ Fitting Charge</label>
                  {form.fittingMode === 'per_weight' && (
                    <span className="text-[10px] text-gray-500">Fitting Wt: {fittingWeight.toFixed(2)}</span>
                  )}
                </div>
                {/* Fitting mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-dark-border">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, fittingMode: 'per_weight' })}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      form.fittingMode === 'per_weight'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-bg text-gray-400 hover:bg-dark-hover'
                    }`}
                  >
                    Per Weight
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, fittingMode: 'fixed' })}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      form.fittingMode === 'fixed'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-bg text-gray-400 hover:bg-dark-hover'
                    }`}
                  >
                    Fixed Cost
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  className="input !py-2 text-sm"
                  value={form.fittingRate}
                  onChange={(e) => setForm({ ...form, fittingRate: e.target.value })}
                  placeholder={form.fittingMode === 'fixed' ? 'Enter total fitting cost' : 'Enter fitting rate per unit'}
                />
                {totalFittingCharge > 0 && (
                  <p className="text-xs text-primary-400">
                    {form.fittingMode === 'fixed'
                      ? `Fixed: ${formatCurrency(totalFittingCharge)}`
                      : `${fittingWeight.toFixed(2)} × ₹${fittingRateNum} = ${formatCurrency(totalFittingCharge)}`}
                  </p>
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
              <label className="text-[10px] text-gray-500 uppercase">Receive Payment ₹</label>
              <input type="number" step="0.01" min="0" className="input !py-2 text-sm" value={form.paymentReceived} onChange={(e) => setForm({ ...form, paymentReceived: e.target.value })} placeholder="0" onWheel={(e) => e.target.blur()} />
            </div>
            {paymentReceivedNum > 0 && (
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Payment Mode</label>
                <select className="select !py-2 text-sm" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
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
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Fitting {form.fittingMode === 'fixed' ? '(Fixed)' : `(${fittingWeight.toFixed(2)} × ₹${fittingRateNum})`}
                  </span>
                  <span className="text-primary-400">+{formatCurrency(totalFittingCharge)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between"><span className="text-gray-400">Discount {form.discountType === 'percent' ? `(${form.discount}%)` : ''}</span><span className="text-red-400">-{formatCurrency(discountAmount)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-dark-border pt-2">
                <span className="text-gray-200">Grand Total</span><span className="text-primary-400">{formatCurrency(grandTotal)}</span>
              </div>
              {paymentReceivedNum > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment ({form.paymentMode})</span>
                  <span className="text-emerald-400">-{formatCurrency(paymentReceivedNum)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={() => navigate(`/bills/${id}`)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center text-base">
            {submitting ? 'Updating...' : 'Update Bill'}
          </button>
        </div>
      </form>
    </div>
  );
}
