import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getRoles, resetUserPassword } from '../../api/users';
import { getDepartments } from '../../api/masters';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import RoleGate from '../../components/RoleGate';
import { formatDate } from '../../utils/helpers';
import { Key, Eye, EyeOff, Sparkles, Lock } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  // Dedicated Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '', email: '', employee_code: '', password: '', operational_department_id: '', designation: '', role_ids: [], is_active: true
  });

  useEffect(() => {
    getRoles().then(r => setRoles(r.data));
    getDepartments().then(r => setDepts(r.data));
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    getUsers().then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  const handleOpen = (data = null) => {
    if (data) {
      setEditData(data);
      setFormData({
        name: data.name, email: data.email, employee_code: data.employee_code || '', password: '',
        operational_department_id: data.operational_department_id || '',
        designation: data.designation || '', is_active: data.is_active
      });
    } else {
      setEditData(null);
      setFormData({ name: '', email: '', employee_code: '', password: '', operational_department_id: '', designation: '', role_ids: [], is_active: true });
    }
    setShowModal(true);
  };

  const handleRoleToggle = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId]
    }));
  };

  const handleOpenPasswordReset = (user) => {
    setResetModalUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleClosePasswordReset = () => {
    setResetModalUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Kvs@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
    toast.success('Generated suggested password');
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    try {
      setResettingPassword(true);
      await resetUserPassword(resetModalUser.id, newPassword);
      toast.success(`Password for ${resetModalUser.name} has been reset successfully!`);
      handleClosePasswordReset();
    } catch (err) {
      // Handled by axios interceptor
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, operational_department_id: formData.operational_department_id ? parseInt(formData.operational_department_id) : null };
      if (editData) {
        if (!payload.password || !payload.password.trim()) {
          delete payload.password; // skip if blank
        }
        delete payload.email; // email is readonly usually
        delete payload.role_ids;
        await updateUser(editData.id, payload);
        toast.success('User updated successfully');
      } else {
        await createUser(payload);
        toast.success('User created');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {}
  };

  const handleDelete = async (row) => {
    if (window.confirm("This will permanently remove the user’s access.\nExisting records will NOT be affected.")) {
      try {
        const res = await deleteUser(row.id);
        toast.success(res.message || 'User deleted');
        fetchData();
      } catch (err) {}
    }
  };

  const columns = [
    { key: 'name', label: 'Employee', render: (_, r) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shadow-sm">
          {r.name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-gray-900">{r.name}</div>
          <div className="text-[10px] text-gray-400 font-mono tracking-wide">{r.employee_code}</div>
        </div>
      </div>
    )},
    { key: 'email', label: 'Email Address', render: (v) => <span className="text-gray-600">{v}</span> },
    { key: 'designation', label: 'Designation', render: (v) => <span className="font-medium text-gray-700">{v || '—'}</span> },
    { key: 'roles', label: 'Assigned Roles', render: (v) => (
      <div className="flex flex-wrap gap-1">
        {v?.length ? v.map(role => (
          <span key={role} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded border border-slate-200">
            {role}
          </span>
        )) : <span className="text-gray-400 italic">No Roles</span>}
      </div>
    )},
    { key: 'is_active', label: 'Account Status', render: (v) => (
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${v ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
        {v ? 'Active' : 'Disabled'}
      </span>
    )},
    { key: 'last_login', label: 'Last Login', render: (v) => <span className="text-xs text-gray-500">{formatDate(v) || 'Never Logged In'}</span> },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => handleOpenPasswordReset(row)} 
            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
            title={`Set a new desired password for ${row.name}`}
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>Reset Password</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpen(row)} 
            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row)} 
            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Revoke Access
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-[90rem] mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
            <span className="text-xl">👥</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage employee access, roles, and system permissions.</p>
          </div>
        </div>
        <button onClick={() => handleOpen()} 
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <span className="text-lg leading-none">+</span> Add New User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable columns={columns} data={users} loading={loading} emptyMessage="No users found in the system." />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{editData ? 'Update User Profile' : 'Create New User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
                    placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input required type="email" disabled={!!editData} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow disabled:bg-gray-50 disabled:text-gray-500" 
                    placeholder="name@kvs.gov.in" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Employee Code</label>
                  <input required type="text" value={formData.employee_code} onChange={e => setFormData({...formData, employee_code: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow font-mono" 
                    placeholder="e.g. EMP001" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Designation</label>
                  <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
                    placeholder="e.g. PGT Computer Science" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Primary Department (Optional)</label>
                <select value={formData.operational_department_id} onChange={e => setFormData({...formData, operational_department_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white">
                  <option value="">— Unassigned —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>

              {!editData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Temporary Password</label>
                    <input required minLength={6} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
                      placeholder="Minimum 6 characters" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">System Roles</label>
                    <div className="flex flex-wrap gap-2">
                      {roles.filter(r => r.name !== 'RegionalOfficer' && r.name !== 'SuperAdmin').map(r => (
                        <label key={r.id} className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${formData.role_ids.includes(r.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={formData.role_ids.includes(r.id)} onChange={() => handleRoleToggle(r.id)} />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {editData && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Reset Password (Optional)</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Leave blank to keep unchanged</span>
                    </div>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white font-mono"
                      placeholder="Enter new desired password (min 6 chars)"
                      minLength={6}
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Account is Active</div>
                        <div className="text-xs text-gray-500">Uncheck to disable this user's login access entirely.</div>
                      </div>
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button type="button" onClick={() => setShowModal(false)} 
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {editData ? 'Save Profile' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dedicated Reset Password Modal ── */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-amber-50 to-indigo-50/40 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset User Password</h3>
                  <p className="text-xs text-slate-500">Set a new desired password for this account</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleClosePasswordReset}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            {/* Target User Info Card */}
            <div className="px-6 pt-5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">
                    {resetModalUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{resetModalUser.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{resetModalUser.employee_code} • {resetModalUser.email}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                  {resetModalUser.designation || 'Staff'}
                </span>
              </div>
            </div>

            {/* Password Form */}
            <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    New Desired Password
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Auto-Suggest</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow font-mono"
                    placeholder="Enter desired password (min 6 chars)"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow font-mono"
                  placeholder="Re-type desired password"
                  minLength={6}
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                <strong>Immediate Effect:</strong> This account will be able to log in right away using their employee code (<code className="font-bold">{resetModalUser.employee_code}</code>) and this new password.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClosePasswordReset}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{resettingPassword ? 'Resetting...' : 'Set New Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
