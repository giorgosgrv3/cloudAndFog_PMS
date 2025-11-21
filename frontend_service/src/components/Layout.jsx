import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            
            {/* Left Side: Logo & Links */}
            <div className="flex items-center space-x-8">
              <div className="text-xl font-bold text-blue-400">PMS App</div>
              
              <div className="hidden md:flex space-x-4">
                {/* Link για όλους */}
                <Link to="/" className="hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </Link>

                {/* Links ΜΟΝΟ για Admin */}
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
              <div className="text-sm text-gray-300">
                {user?.username} <span className="text-xs bg-gray-700 px-2 py-1 rounded ml-1">{user?.role}</span>
              </div>
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

      {/* Εδώ θα εμφανίζεται το περιεχόμενο της κάθε σελίδας */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}