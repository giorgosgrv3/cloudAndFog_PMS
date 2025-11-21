import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            
            {/* Left Side */}
            <div className="flex items-center space-x-8">
              <div className="text-xl font-bold text-blue-400">PMS App</div>
              
              <div className="hidden md:flex space-x-4">
                {/* Dashboard: Κοινό για όλους (ή μπορείτε να το κρύψετε κι αυτό αν θέλετε) */}
                <Link to="/" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </Link>

                {/* --- LINKS ΜΟΝΟ ΓΙΑ NON-ADMINS (Members & Leaders) --- */}
                {!isAdmin && (
                  <>
                    <Link to="/teams" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                      My Teams
                    </Link>
                    <Link to="/my-tasks" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                      My Tasks
                    </Link>
                  </>
                )}

                {/* --- LINKS ΜΟΝΟ ΓΙΑ ADMIN --- */}
                {isAdmin && (
                  <>
                    <Link to="/admin/users" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                      Manage Users
                    </Link>
                    <Link to="/admin/teams" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                      Manage Teams
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right Side: User Info & Logout */}
            <div className="flex items-center space-x-4">
              
              <Link to="/profile" className="flex items-center space-x-2 hover:bg-gray-700 px-3 py-2 rounded-md transition">
                <div className="text-sm font-medium text-gray-200">
                   {user?.username}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded capitalize border 
                    ${isAdmin ? 'bg-red-900 text-red-200 border-red-700' : 'bg-blue-900 text-blue-200 border-blue-700'}`}>
                    {user?.role?.replace('_', ' ')}
                </span>
              </Link>

              <button 
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}