import { useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import { Mail, Shield, Activity, Camera, Eye, X } from 'lucide-react';
import AvatarUploadModal from '../components/AvatarUploadModal';

export default function UserProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI States for Avatar
  const [menuOpen, setMenuOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now()); // Forces img refresh

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

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (blob) => {
    try {
        const formData = new FormData();
        // Filename doesn't matter much, backend renames it, but we need an extension
        formData.append('file', blob, 'avatar.jpg');
        
        await api.users.uploadAvatar(formData);
        
        // Refresh user data and force image reload
        await fetchProfile(); 
        setAvatarTimestamp(Date.now()); 
        setIsUploadOpen(false);
    } catch (err) {
        alert("Failed to upload avatar.");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!user) return null;

  const avatarUrl = user.avatar_filename 
    ? `${api.users.getAvatarUrl(user.username)}?t=${avatarTimestamp}` 
    : null;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Account</h1>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 relative">
        {/* Header / Banner */}
        <div className="bg-gray-800 h-32 relative">
            <div className="absolute -bottom-12 left-8 relative group">
                
                {/* --- AVATAR CIRCLE --- */}
                <div 
                    className="h-24 w-24 bg-white rounded-full border-4 border-white shadow-md overflow-hidden cursor-pointer relative"
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    {avatarUrl ? (
                        <img 
                            src={avatarUrl} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-700 uppercase bg-gray-200">
                            {user.username.substring(0, 2)}
                        </div>
                    )}
                    
                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                        <Camera className="text-white opacity-0 group-hover:opacity-100 w-6 h-6 drop-shadow-md" />
                    </div>
                </div>

                {/* --- POPUP MENU --- */}
                {menuOpen && (
                    <>
                        {/* Invisible backdrop to close menu when clicking outside */}
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                        
                        <div className="absolute top-24 left-0 z-20 bg-white rounded-lg shadow-xl border border-gray-200 w-48 overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
                            {avatarUrl && (
                                <button 
                                    onClick={() => { setIsInspectOpen(true); setMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                >
                                    <Eye className="w-4 h-4 mr-2" /> Inspect Picture
                                </button>
                            )}
                            <button 
                                onClick={() => { setIsUploadOpen(true); setMenuOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                            >
                                <Camera className="w-4 h-4 mr-2" /> Change Picture
                            </button>
                        </div>
                    </>
                )}
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

      {/* --- INSPECT MODAL --- */}
      {isInspectOpen && avatarUrl && (
        <div 
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center cursor-pointer"
            onClick={() => setIsInspectOpen(false)}
        >
            <div className="relative max-w-3xl max-h-[90vh]">
                <img src={avatarUrl} alt="Profile Full" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                <p className="text-white text-center mt-4 text-sm opacity-75">Click anywhere to close</p>
            </div>
        </div>
      )}

      {/* --- UPLOAD/CROP MODAL --- */}
      <AvatarUploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onUpload={handleAvatarUpload} 
      />

    </div>
  );
}