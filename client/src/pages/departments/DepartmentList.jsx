import { useState, useEffect } from 'react';
import { getDepartments, createDepartment, updateDepartment } from '../../api/masters';
import { getUsers } from '../../api/users';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import RoleGate from '../../components/RoleGate';

export default function DepartmentList() {
  const [depts, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({ code: '', name: '', incharge_employee_code: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getDepartments().then(r => setDepts(r.data)),
      getUsers().then(r => setUsers(r.data))
    ]).finally(() => setLoading(false));
  };

  const handleOpen = (data = null) => {
    if (data) {
      setEditData(data);
      setFormData({ code: data.code, name: data.name, incharge_employee_code: data.incharge_employee_code || '' });
    } else {
      setEditData(null);
      setFormData({ code: '', name: '', incharge_employee_code: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, incharge_employee_code: formData.incharge_employee_code || null };
      if (editData) {
        await updateDepartment(editData.id, payload);
        toast.success('Department updated');
      } else {
        await createDepartment(payload);
        toast.success('Department created');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {}
  };

  const columns = [
    { key: 'code', label: 'Department Code' },
    { key: 'name', label: 'Department Name' },
    { key: 'incharge_name', label: 'Assigned In-Charge', render: (_, row) => (
      row.incharge_name ? (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
            {row.incharge_name.charAt(0)}
          </div>
          <span className="font-medium text-gray-800">{row.incharge_name}</span>
          <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">{row.incharge_employee_code}</span>
        </div>
      ) : <span className="text-gray-400 italic">Unassigned</span>
    )},
    {
      key: 'actions', label: '', render: (_, row) => (
        <RoleGate roles={['Admin']}>
          <button onClick={() => handleOpen(row)} 
            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            Edit Details
          </button>
        </RoleGate>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
            <span className="text-xl">🏢</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Operational Departments</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage school departments and assign in-charge staff.</p>
          </div>
        </div>
        <RoleGate roles={['Admin']}>
          <button onClick={() => handleOpen()} 
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <span className="text-lg leading-none">+</span> Add Department
          </button>
        </RoleGate>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable columns={columns} data={depts} loading={loading} emptyMessage="No operational departments configured yet." />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editData ? 'Update Department' : 'Create New Department'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department Code</label>
                <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow uppercase font-mono" 
                  placeholder="e.g. SCI_LAB" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
                  placeholder="e.g. Science Laboratory" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department In-Charge</label>
                <select value={formData.incharge_employee_code} onChange={e => setFormData({...formData, incharge_employee_code: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white">
                  <option value="">— Unassigned —</option>
                  {users.map(u => (
                    <option key={u.employee_code} value={u.employee_code}>
                      {u.name} • {u.designation || 'Staff'} ({u.employee_code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1.5">Assigning an in-charge gives them permission to verify stock for this department.</p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} 
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {editData ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
