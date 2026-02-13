import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePrinter, HiOutlineCreditCard, HiOutlinePencil } from 'react-icons/hi';

export default function BillDetail() {
  const { id } = useParams();
  const { isOwner } = useAuth();
  const [bill, setBill] = useState(null);
  const [billPayments, setBillPayments] = useState([]);
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBill = async () => {
    try {
      const promises = [
        api.get(`/bills/${id}`),
      ];
      if (isOwner) {
        promises.push(api.get(`/bills/${id}/profit`).catch(() => ({ data: { data: null } })));
      }
      const results = await Promise.all(promises);
      setBill(results[0].data.data);
      setBillPayments(results[0].data.payments || []);
      if (isOwner && results[1]) {
        setProfitData(results[1].data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBill(); }, [id]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/payments', {
        customer: bill.customer?._id || bill.customer,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber,
        notes: payForm.notes,
      });
      toast.success('Payment recorded');
      setPaymentModal(false);
      setPayForm({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
      setLoading(true);
      fetchBill();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader text="Loading bill..." />;
  if (!bill) return <div className="text-center text-gray-400 py-12">Bill not found</div>;

  return (
    <div className="space-y-4">
      {/* Header — hidden on print */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link to="/bills" className="text-gray-400 hover:text-gray-200">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-100">{bill.billNumber}</h1>
            <p className="text-xs text-gray-500">Created {formatDateTime(bill.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/bills/${id}/edit`} className="btn-secondary !py-2 !px-3 text-sm flex items-center gap-1">
            <HiOutlinePencil className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
          </Link>
          <button onClick={() => setPaymentModal(true)} className="btn-success !py-2 !px-3 text-sm">
            <HiOutlineCreditCard className="w-4 h-4" /> <span className="hidden sm:inline">Pay</span>
          </button>
          <button onClick={() => window.print()} className="btn-secondary !py-2 !px-3 text-sm">
            <HiOutlinePrinter className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* ─── PRINT AREA ─── */}
      <div id="bill-print-area">
        {/* Print header */}
        <div className="print-header hidden">
          <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>M.M. Construction</h1>
          <p style={{ fontSize: '9px', margin: '1px 0', color: '#555' }}>Iron Fabrication & Installation</p>
          <hr style={{ margin: '4px 0', borderColor: '#333' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '2px' }}>
            <span><strong>Bill:</strong> {bill.billNumber}</span>
            <span><strong>Date:</strong> {formatDate(bill.createdAt)}</span>
          </div>
          <div style={{ fontSize: '9px', marginTop: '2px' }}>
            <strong>To:</strong> {bill.customer?.name} | {bill.customer?.phone}
            {bill.customer?.address && <span> | {bill.customer.address}</span>}
          </div>
        </div>

        {/* Bill info cards — screen only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
          <div className="card !p-4">
            <h3 className="text-xs font-medium text-gray-400 mb-2">Customer</h3>
            <p className="text-base font-semibold text-gray-100">{bill.customer?.name}</p>
            <p className="text-sm text-gray-400">{bill.customer?.phone}</p>
            {bill.customer?.address && <p className="text-xs text-gray-500 mt-1">{bill.customer.address}</p>}
            <Link to={`/customers/${bill.customer?._id}/ledger`} className="text-xs text-primary-400 hover:text-primary-300 mt-2 inline-block">
              View Ledger →
            </Link>
          </div>
          <div className="card !p-4">
            <h3 className="text-xs font-medium text-gray-400 mb-2">Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Grand Total</span>
                <span className="font-bold text-primary-400 text-base">{formatCurrency(bill.grandTotal)}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-red-400">{bill.discountType === 'percent' ? `${bill.discount}%` : formatCurrency(bill.discount)}</span>
                </div>
              )}
              {bill.deliveryDate && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Delivery</span>
                  <span className="text-xs">{formatDate(bill.deliveryDate)}</span>
                </div>
              )}
              {bill.advanceAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Advance Paid</span>
                  <span className="text-emerald-400">{formatCurrency(bill.advanceAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items — responsive table with print styles */}
        <div className="card !p-4 print-items">
          <h3 className="text-sm font-semibold text-gray-200 mb-3 no-print">Items</h3>
          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden no-print">
            {bill.items.map((item, i) => (
              <div key={item._id} className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-200 text-sm">{item.productName}</span>
                  <span className="badge-info text-[10px]">{item.category}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{item.quantity} {item.unit} × {formatCurrency(item.rate)}</span>
                  {item.fittingCharge > 0 && <span>Fit: {formatCurrency(item.fittingCharge)}</span>}
                </div>
                <div className="text-right mt-1">
                  <span className="text-sm font-semibold text-primary-400">{formatCurrency(item.lineTotal)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop & print table */}
          <div className="table-container hidden sm:block print-table-show">
            <table className="table print-compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Fitting</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, i) => (
                  <tr key={item._id}>
                    <td>{i + 1}</td>
                    <td className="font-medium text-gray-200">{item.productName}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{formatCurrency(item.rate)}</td>
                    <td>{item.fittingCharge > 0 ? formatCurrency(item.fittingCharge) : '-'}</td>
                    <td className="font-semibold text-primary-400">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-border">
                  <td colSpan="5" className="text-right text-gray-400 text-xs">Subtotal</td>
                  <td className="font-semibold">{formatCurrency(bill.subtotal)}</td>
                </tr>
                {bill.discount > 0 && (
                  <tr>
                    <td colSpan="5" className="text-right text-gray-400 text-xs">Discount {bill.discountType === 'percent' ? `(${bill.discount}%)` : ''}</td>
                    <td className="text-red-400">-{formatCurrency(bill.discountType === 'percent' ? (bill.subtotal * bill.discount / 100) : bill.discount)}</td>
                  </tr>
                )}
                <tr className="border-t border-dark-border">
                  <td colSpan="5" className="text-right font-bold text-gray-200 text-xs">Grand Total</td>
                  <td className="font-bold text-primary-400">{formatCurrency(bill.grandTotal)}</td>
                </tr>

              </tfoot>
            </table>
          </div>
          {bill.notes && (
            <p className="text-xs text-gray-500 mt-3">
              <span className="font-medium text-gray-400">Notes:</span> {bill.notes}
            </p>
          )}
        </div>

        {/* Payments received for this bill */}
        {billPayments.length > 0 && (
          <div className="card !p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <HiOutlineCreditCard className="w-4 h-4 text-emerald-400" />
              Payments Received ({billPayments.length})
            </h3>
            {/* Mobile */}
            <div className="space-y-2 sm:hidden">
              {billPayments.map((p) => (
                <div key={p._id} className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(p.amount)}</span>
                    <div className="flex items-center gap-1">
                      <span className="badge-info text-[10px]">{p.mode}</span>
                      {p.lessAmount > 0 && <span className="badge-warning text-[10px]">Less {formatCurrency(p.lessAmount)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{formatDateTime(p.createdAt)}</span>
                    <span>{p.receivedBy?.name}</span>
                  </div>
                  {p.referenceNumber && <p className="text-[10px] text-gray-500 mt-1">Ref: {p.referenceNumber}</p>}
                  {p.notes && <p className="text-[10px] text-gray-500 mt-1 italic">{p.notes}</p>}
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="table-container hidden sm:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th>Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {billPayments.map((p) => (
                    <tr key={p._id}>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                      <td className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</td>
                      <td><span className="badge-info">{p.mode}</span>{p.lessAmount > 0 && <span className="badge-warning ml-1">Less {formatCurrency(p.lessAmount)}</span>}</td>
                      <td className="text-gray-500 text-xs">{p.referenceNumber || '-'}</td>
                      <td className="text-gray-500 text-xs max-w-[200px] truncate">{p.notes || '-'}</td>
                      <td className="text-gray-500 text-xs">{p.receivedBy?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* Print footer */}
        <div className="print-footer hidden" style={{ marginTop: '8px', fontSize: '8px', textAlign: 'center', color: '#888' }}>
          Thank you for your business! — M.M. Construction
        </div>
      </div>
      {/* ─── END PRINT AREA ─── */}



      {/* Profit Analysis — Owner only, no print */}
      {isOwner && profitData && (
        <div className="card !p-4 no-print border-l-4 border-green-500/50">
          <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
            📊 Profit Analysis
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Owner Only</span>
          </h3>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-dark-bg rounded-lg p-2.5 border border-dark-border text-center">
              <p className="text-[10px] text-gray-500 uppercase">Bill Total</p>
              <p className="text-sm font-bold text-primary-400">{formatCurrency(profitData.billTotal)}</p>
            </div>
            <div className="bg-dark-bg rounded-lg p-2.5 border border-dark-border text-center">
              <p className="text-[10px] text-gray-500 uppercase">Material Cost</p>
              <p className="text-sm font-bold text-red-400">{formatCurrency(profitData.totalCost)}</p>
            </div>
            <div className="bg-dark-bg rounded-lg p-2.5 border border-dark-border text-center">
              <p className="text-[10px] text-gray-500 uppercase">Profit</p>
              <p className={`text-sm font-bold ${profitData.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(profitData.totalProfit)}
              </p>
            </div>
            <div className="bg-dark-bg rounded-lg p-2.5 border border-dark-border text-center">
              <p className="text-[10px] text-gray-500 uppercase">Margin</p>
              <p className={`text-sm font-bold ${profitData.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profitData.profitMargin}%
              </p>
            </div>
          </div>

          {/* Item-wise profit */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-dark-hover border-b border-dark-border">
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-gray-500">Product</th>
                  <th className="text-right px-2 py-2 text-[10px] uppercase text-gray-500">Qty</th>
                  <th className="text-right px-2 py-2 text-[10px] uppercase text-gray-500">Revenue</th>
                  <th className="text-right px-2 py-2 text-[10px] uppercase text-gray-500">Cost/Unit</th>
                  <th className="text-right px-2 py-2 text-[10px] uppercase text-gray-500">Total Cost</th>
                  <th className="text-right px-2 py-2 text-[10px] uppercase text-gray-500">Profit</th>
                  <th className="text-right px-3 py-2 text-[10px] uppercase text-gray-500">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {profitData.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-dark-hover/50">
                    <td className="px-3 py-2 text-gray-200 font-medium">{item.productName}</td>
                    <td className="px-2 py-2 text-right text-gray-400">{item.quantity}</td>
                    <td className="px-2 py-2 text-right text-primary-400">{formatCurrency(item.lineTotal)}</td>
                    <td className="px-2 py-2 text-right">
                      {item.hasCostData ? (
                        <span className="text-gray-300">{formatCurrency(item.costPerUnit)}</span>
                      ) : (
                        <span className="text-gray-600 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {item.hasCostData ? (
                        <span className="text-red-400">{formatCurrency(item.totalCost)}</span>
                      ) : (
                        <span className="text-gray-600 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {item.hasCostData ? (
                        <span className={`font-semibold ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(item.profit)}
                        </span>
                      ) : (
                        <span className="text-gray-600 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.hasCostData ? (
                        <span className={item.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {item.profitMargin}%
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            Cost based on avg. purchase rates. Products with "N/A" have no material consumption data.
          </p>
        </div>
      )}

      {/* Payment modal */}
      <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="Record Payment">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
            <p className="text-sm text-gray-400">Outstanding: <span className="text-red-400 font-semibold">{formatCurrency(bill.dueAmount)}</span></p>
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" autoFocus />
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <select className="select" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank Transfer</option><option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="label">Reference #</label>
            <input className="input" value={payForm.referenceNumber} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPaymentModal(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success w-full sm:w-auto justify-center">
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
