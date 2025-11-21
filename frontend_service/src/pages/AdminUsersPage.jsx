import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Search, CheckCircle, Loader } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State για το "Activate All" loading
  const [activatingAll, setActivatingAll] = useState(false);

  const getErrorMessage = (err) => {
    return err.response?.data?.detail || 'An unexpected error occurred.';
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- HANDLERS ---

  const handleActivate = async (username) => {
    try {
      await api.users.activate(username);
      fetchUsers(); 
    } catch (err) {
      alert(`Failed to activate: ${getErrorMessage(err)}`);
    }
  };

  // ΝΕΟΣ HANDLER: ACTIVATE ALL
  const handleActivateAll = async () => {
    // Βρίσκουμε τους ανενεργούς
    const inactiveUsers = users.filter(u => !u.active);
    
    if (inactiveUsers.length === 0) {
        alert("All users are already active!");
        return;
    }

    if (!window.confirm(`Are you sure you want to activate all ${inactiveUsers.length} pending users?`)) return;

    setActivatingAll(true);
    try {
        // Στέλνουμε όλα τα requests ταυτόχρονα για ταχύτητα
        await Promise.all(inactiveUsers.map(u => api.users.activate(u.username)));
        
        // Μόλις τελειώσουν όλα, ανανεώνουμε τη λίστα
        await fetchUsers();
        alert(`Successfully activated ${inactiveUsers.length} users.`);
        
    } catch (err) {
        console.error(err);
        alert("Some activations might have failed. Please check the list.");
        fetchUsers(); // Ανανεώνουμε όπως και να 'χει
    } finally {
        setActivatingAll(false);
    }
  };

  const handleDeactivate = async (username) => {
    if (!window.confirm(`Are you sure you want to deactivate user ${username}? They won't be able to log in.`)) return;
    try {
      await api.users.deactivate(username);
      fetchUsers();
    } catch (err) {
      alert(`Failed to deactivate: ${getErrorMessage(err)}`);
    }
  };

  const handleDelete = async (username) => {
    if (!window.confirm(`Are you sure you want to delete ${username}? This cannot be undone.`)) return;
    try {
      await api.users.delete(username);
      setUsers(users.filter(u => u.username !== username));
    } catch (err) {
      alert(`Failed to delete: ${getErrorMessage(err)}`);
    }
  };

  const handleRoleChange = async (username, newRole) => {
    const confirmMessage = `Are you sure you want to change ${username}'s role to ${newRole.toUpperCase()}?`;
    if (!window.confirm(confirmMessage)) {
      fetchUsers();
      return;
    }

    try {
      await api.users.updateRole(username, newRole);
      fetchUsers();
    } catch (err) {
      alert(`Error: ${getErrorMessage(err)}`);
      fetchUsers();
    }
  };

  // --- FILTERING ---
  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.first_name && user.first_name.toLowerCase().includes(term)) ||
      (user.last_name && user.last_name.toLowerCase().includes(term))
    );
  });

  // Μετράμε πόσοι είναι ανενεργοί για να δούμε αν θα εμφανίσουμε το κουμπί
  const inactiveCount = users.filter(u => !u.active).length;

  if (loading && users.length === 0) return <div className="p-6">Loading users...</div>;
  if (error) return <div className="p-6 text-red-500 font-bold">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        
        {/* --- ACTIVATE ALL BUTTON --- */}
        {inactiveCount > 0 && (
            <button 
                onClick={handleActivateAll}
                disabled={activatingAll}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-70"
            >
                {activatingAll ? (
                    <>
                        <Loader className="w-5 h-5 mr-2 animate-spin" /> Activating...
                    </>
                ) : (
                    <>
                        <CheckCircle className="w-5 h-5 mr-2" /> Activate All ({inactiveCount})
                    </>
                )}
            </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by username, email or name..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Status / Actions</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Danger Zone</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                  
                  {/* USER INFO */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                        <Link to={`/admin/users/${user.username}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                            {user.username}
                        </Link>
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">{user.first_name} {user.last_name}</div>
                  </td>

                  {/* ROLE SELECTOR */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select 
                      value={user.role} 
                      onChange={(e) => handleRoleChange(user.username, e.target.value)}
                      className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer py-1 bg-white"
                    >
                      <option value="member">Member</option>
                      <option value="team_leader">Team Leader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  {/* STATUS & TOGGLE BUTTON */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                        {user.active ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                            </span>
                        ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Inactive
                            </span>
                        )}

                        {user.active ? (
                            <button 
                                onClick={() => handleDeactivate(user.username)}
                                className="text-xs font-medium text-amber-600 hover:text-amber-800 border border-amber-200 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                                title="Deactivate User"
                            >
                                Deactivate
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleActivate(user.username)}
                                className="text-xs font-medium text-green-700 hover:text-green-900 border border-green-200 bg-green-50 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                                title="Activate User"
                            >
                                Enable
                            </button>
                        )}
                    </div>
                  </td>

                  {/* DELETE BUTTON */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handleDelete(user.username)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </td>

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No users found matching "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}