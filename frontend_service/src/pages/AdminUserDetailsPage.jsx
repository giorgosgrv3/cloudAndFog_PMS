import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';

export default function AdminUserDetailsPage() {
  const { username } = useParams(); // Παίρνουμε το username από το URL
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.users.getOne(username);
        setUser(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch user details');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchUser();
    }
  }, [username]);

  if (loading) return <div className="p-8 text-center">Loading user profile...</div>;
  
  if (error) return (
    <div className="p-8 text-center">
        <div className="text-red-500 font-bold mb-4">{error}</div>
        <button onClick={() => navigate('/admin/users')} className="text-blue-500 underline">Back to Users</button>
    </div>
  );

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header με Back Button */}
      <div className="mb-6 flex items-center">
        <button 
            onClick={() => navigate('/admin/users')} 
            className="mr-4 text-gray-500 hover:text-gray-800"
        >
            ← Back to List
        </button>
        <h1 className="text-2xl font-bold text-gray-800">User Profile</h1>
      </div>

      {/* User Card */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        {/* Πάνω μέρος: Background & Avatar Placeholder */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-32 relative">
            <div className="absolute -bottom-12 left-8">
                <div className="h-24 w-24 bg-white rounded-full border-4 border-white flex items-center justify-center text-3xl font-bold text-blue-500 shadow-md uppercase">
                    {user.username.substring(0, 2)}
                </div>
            </div>
        </div>
        
        <div className="pt-16 pb-8 px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{user.first_name} {user.last_name}</h2>
            <p className="text-gray-500 text-lg mb-6">@{user.username}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Email</div>
                    <div className="text-gray-800 font-medium">{user.email}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Role</div>
                    <div className="text-gray-800 font-medium capitalize flex items-center">
                        {user.role === 'admin' && '🛡️ '}
                        {user.role === 'team_leader' && '👨‍✈️ '}
                        {user.role.replace('_', ' ')}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Account Status</div>
                    <div className="mt-1">
                        {user.active ? (
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Active
                            </span>
                        ) : (
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Inactive
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase font-semibold">User ID</div>
                    <div className="text-gray-500 font-mono text-sm truncate" title={user.id}>{user.id}</div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}