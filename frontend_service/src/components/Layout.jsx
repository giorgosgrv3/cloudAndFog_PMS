import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Palette } from 'lucide-react';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    // Simple toggle: If default -> go office, otherwise -> go default
    setTheme(theme === 'default' ? 'office' : 'default');
  };

  return (
    <div 
      className="min-h-screen bg-bg-main transition-colors duration-300 font-sans text-text-main bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'var(--bg-image)' }}
    >
      
      {/* Navbar using semantic colors */}
      <nav className="bg-primary text-text-on-primary shadow-lg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            
            {/* Left Side */}
            <div className="flex items-center space-x-8">
              {/* APP NAME UPDATE */}
              <div className="text-xl font-bold text-brand tracking-wide">
                TUCner Mifflin
              </div>
              
              <div className="hidden md:flex space-x-4">
                <Link to="/" className="hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Dashboard
                </Link>

                {!isAdmin && (
                  <>
                    <Link to="/teams" className="hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      My Teams
                    </Link>
                    <Link to="/my-tasks" className="hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      My Tasks
                    </Link>
                  </>
                )}

                {isAdmin && (
                  <>
                    <Link to="/admin/users" className="hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      Manage Users
                    </Link>
                    <Link to="/admin/teams" className="hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors">
                      Manage Teams
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              
              {/* Theme Toggle Button */}
              <button 
                onClick={cycleTheme}
                className="p-2 rounded-full hover:bg-primary-hover transition text-brand"
                title={`Current theme: ${theme}`}
              >
                <Palette className="w-5 h-5" />
              </button>

              <Link to="/profile" className="flex items-center space-x-2 hover:bg-primary-hover px-3 py-2 rounded-md transition">
                <div className="text-sm font-medium">
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