import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import { formatDateTime } from '../utils/helpers';
import { HiOutlineUserAdd, HiOutlineShieldCheck, HiOutlineBan, HiOutlinePencil } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'staff' });
  const [submitting, setSubmitting] = useState(false);

  // Credential editing
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'staff', password: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/register', form);
      toast.success('User registered successfully');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'staff' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (userId, isActive) => {
    try {
      await api.put(`/auth/users/${userId}/status`, { isActive: !isActive });
      toast.success(`User ${isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openEditModal = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', role: user.role, password: '' });
    setEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name: editForm.name, email: editForm.email, phone: editForm.phone, role: editForm.role };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/auth/users/${editUser._id}/credentials`, payload);
      toast.success('Credentials updated');
      setEditModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">User Management</h1>
          <p className="text-xs text-gray-500">Manage accounts, roles & credentials</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlineUserAdd className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {users.map((user) => (
          <div key={user._id} className="card !p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${user.role === 'owner' ? 'bg-primary-600' : 'bg-gray-600'}`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-200 text-sm truncate">{user.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <span className={`${user.isActive ? 'badge-success' : 'badge-danger'} text-[10px]`}>
                {user.isActive ? 'Active' : 'Off'}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Role</span>
                <span className="text-gray-300 capitalize flex items-center gap-1">
                  {user.role === 'owner' && <HiOutlineShieldCheck className="w-3.5 h-3.5 text-primary-400" />}
                  {user.role}
                </span>
              </div>
              {user.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="text-gray-300">{user.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Joined</span>
                <span className="text-gray-400">{formatDateTime(user.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-2 border-t border-dark-border">
              <button
                onClick={() => openEditModal(user)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors"
              >
                <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
              </button>
              {user.role !== 'owner' && (
                <button
                  onClick={() => toggleStatus(user._id, user.isActive)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    user.isActive
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {user.isActive ? <><HiOutlineBan className="w-3.5 h-3.5" /> Off</> : 'Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create User Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New User">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input name="name" className="input" value={form.name} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input name="email" type="email" className="input" value={form.email} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Password *</label>
            <input name="password" type="password" className="input" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="input" value={form.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Role</label>
              <select name="role" className="select" value={form.role} onChange={handleChange}>
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Credentials Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Edit — ${editUser?.name}`}>
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">New Password <span className="text-gray-500 font-normal">(leave blank to keep)</span></label>
            <input type="password" className="input" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••" minLength={6} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="select" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
