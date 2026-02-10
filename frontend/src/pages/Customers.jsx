import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { formatCurrency, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineUsers, HiOutlineSearch, HiOutlinePlus } from 'react-icons/hi';
import { IoLogoWhatsapp } from 'react-icons/io5';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', altPhone: '', address: '', notes: '', openingBalance: '' });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(async (searchTerm = '', pageNum = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers', {
        params: { search: searchTerm, page: pageNum, limit: 15 },
      });
      setCustomers(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers(search, page);
  }, [page]);

  const debouncedSearch = useCallback(
    debounce((term) => {
      setPage(1);
      fetchCustomers(term, 1);
    }, 400),
    []
  );

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    debouncedSearch(e.target.value);
  };

  const openCreateModal = () => {
    setForm({ name: '', phone: '', altPhone: '', address: '', notes: '', openingBalance: '' });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setForm({
      name: customer.name,
      phone: customer.phone,
      altPhone: customer.altPhone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      openingBalance: customer.openingBalance || '',
    });
    setEditingId(customer._id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) {
      toast.error('Name, WhatsApp no., and address are required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', form);
        toast.success('Customer created');
      }
      setModalOpen(false);
      fetchCustomers(search, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Customers</h1>
          <p className="text-sm text-gray-500">Manage customer records & ledgers</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <HiOutlinePlus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          className="input pl-10"
          placeholder="Search by name or WhatsApp no..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {/* Table */}
      {loading ? (
        <Loader />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={HiOutlineUsers}
          title="No customers found"
          description="Add your first customer to start billing."
          action={<button onClick={openCreateModal} className="btn-primary"><HiOutlinePlus className="w-5 h-5" /> Add Customer</button>}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {customers.map((c) => (
              <div key={c._id} className="card !p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-200">{c.name}</p>
                    <p className="text-sm text-gray-400 flex items-center gap-1"><IoLogoWhatsapp className="w-3.5 h-3.5 text-green-400" />{c.phone}</p>
                    {c.address && <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>}
                  </div>
                  <span className={c.currentDue > 0 ? 'text-red-400 font-semibold text-sm' : 'text-emerald-400 text-sm'}>
                    {formatCurrency(c.currentDue)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-dark-border">
                  <Link to={`/customers/${c._id}/ledger`} className="text-primary-400 text-sm font-medium">Ledger</Link>
                  <button onClick={() => openEditModal(c)} className="text-gray-400 text-sm">Edit</button>
                  <span className="ml-auto text-xs text-gray-500">Billed: {formatCurrency(c.totalBilled)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>WhatsApp No.</th>
                  <th>Address</th>
                  <th>Total Billed</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td className="font-medium text-gray-200">{c.name}</td>
                    <td>
                      <a href={`https://wa.me/91${c.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-300 hover:text-green-400">
                        <IoLogoWhatsapp className="w-3.5 h-3.5 text-green-400" />{c.phone}
                      </a>
                    </td>
                    <td className="text-gray-400 text-xs max-w-[200px] truncate">{c.address || '-'}</td>
                    <td>{formatCurrency(c.totalBilled)}</td>
                    <td className="text-emerald-400">{formatCurrency(c.totalPaid)}</td>
                    <td className={c.currentDue > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                      {formatCurrency(c.currentDue)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link to={`/customers/${c._id}/ledger`} className="text-primary-400 hover:text-primary-300 text-sm font-medium">Ledger</Link>
                        <button onClick={() => openEditModal(c)} className="text-gray-400 hover:text-gray-200 text-sm">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Customer' : 'New Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" />
            </div>
            <div>
              <label className="label">WhatsApp No. *</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp number" />
            </div>
            <div>
              <label className="label">Alt WhatsApp / Phone</label>
              <input className="input" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} placeholder="Alternate number" />
            </div>
          </div>
          <div>
            <label className="label">Address *</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Opening Balance (₹)</label>
              <input type="number" min="0" className="input" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="Pre-existing due amount" />
              <p className="text-[10px] text-gray-500 mt-0.5">Any due before using this system</p>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
