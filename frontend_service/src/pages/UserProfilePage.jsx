import { useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import { Mail, Shield, Activity } from 'lucide-react';

export default function UserProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.auth.getMe();
        setUser(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Account</h1>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        {/* Header / Banner */}
        <div className="bg-gray-800 h-32 relative">
            <div className="absolute -bottom-12 left-8">
                <div className="h-24 w-24 bg-white rounded-full border-4 border-white flex items-center justify-center text-3xl font-bold text-gray-700 shadow-md uppercase">
                    {user.username.substring(0, 2)}
                </div>
            </div>
        </div>
        
        <div className="pt-16 pb-8 px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">
                {user.first_name} {user.last_name}
            </h2>
            <p className="text-gray-500 text-lg mb-6">@{user.username}</p>

            <div className="grid grid-cols-1 gap-6">
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className="p-3 bg-blue-100 rounded-full mr-4"><Mail className="w-6 h-6 text-blue-600" /></div>
                    <div><div className="text-xs text-gray-500 uppercase font-semibold">Email Address</div><div className="text-gray-800 font-medium">{user.email}</div></div>
                </div>
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className="p-3 bg-purple-100 rounded-full mr-4"><Shield className="w-6 h-6 text-purple-600" /></div>
                    <div><div className="text-xs text-gray-500 uppercase font-semibold">Role</div><div className="text-gray-800 font-medium capitalize">{user.role.replace('_', ' ')}</div></div>
                </div>
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <div className={`p-3 rounded-full mr-4 ${user.active ? 'bg-green-100' : 'bg-red-100'}`}><Activity className={`w-6 h-6 ${user.active ? 'text-green-600' : 'text-red-600'}`} /></div>
                    <div><div className="text-xs text-gray-500 uppercase font-semibold">Account Status</div><div className="font-medium">{user.active ? <span className="text-green-700">Active</span> : <span className="text-red-700">Inactive</span>}</div></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}