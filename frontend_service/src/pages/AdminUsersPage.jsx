import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // <--- ΠΡΟΣΘΗΚΗ
import { api } from '../api/endpoints';
import { Search } from 'lucide-react'; // Εικονίδιο για ομορφιά (προαιρετικό, αλλά υπάρχει στο πακέτο που βάλαμε)

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ΝΕΟ STATE: Για την αναζήτηση
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function για τα μηνύματα λάθους του Backend
  const getErrorMessage = (err) => {
    return err.response?.data?.detail || 'An unexpected error occurred.';
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ------------------------------------------------------
  // LOGIC: Φιλτράρισμα λίστας με βάση το Search Term
  // ------------------------------------------------------
  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    // Αναζήτηση σε: Username, Email, First Name, Last Name
    return (
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.first_name && user.first_name.toLowerCase().includes(term)) ||
      (user.last_name && user.last_name.toLowerCase().includes(term))
    );
  });

  // Handlers (Παραμένουν ίδιοι με τη σωστή διαχείριση λαθών)
  const handleActivate = async (username) => {
    if (!window.confirm(`Activate user ${username}?`)) return;
    try {
      await api.users.activate(username);
      fetchUsers();
    } catch (err) {
      alert(`Failed to activate: ${getErrorMessage(err)}`);
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
    try {
      await api.users.updateRole(username, newRole);
      fetchUsers();
    } catch (err) {
      alert(`Error: ${getErrorMessage(err)}`);
      fetchUsers();
    }
  };

  if (loading) return <div className="p-6">Loading users...</div>;
  if (error) return <div className="p-6 text-red-500 font-bold">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
      </div>

      {/* --- SEARCH BAR --- */}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Χρησιμοποιούμε το filteredUsers αντί για το users */}
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
    <Link to={`/admin/users/${user.username}`} className="text-blue-600 hover:text-blue-900 hover:underline">
        {user.username}
    </Link>
</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">{user.first_name} {user.last_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select 
                      value={user.role} 
                      onChange={(e) => handleRoleChange(user.username, e.target.value)}
                      className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer py-1"
                    >
                      <option value="member">Member</option>
                      <option value="team_leader">Team Leader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {!user.active && (
                      <button 
                        onClick={() => handleActivate(user.username)}
                        className="text-green-600 hover:text-green-900 font-bold bg-green-50 px-2 py-1 rounded"
                      >
                        Activate
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(user.username)}
                      className="text-red-600 hover:text-red-900 ml-2 bg-red-50 px-2 py-1 rounded"
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