import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailsPage from './pages/AdminUserDetailsPage'; // <--- Import
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

const AdminTeamsPlaceholder = () => <div>Admin Teams Page (Coming Soon)</div>;
const DashboardPlaceholder = () => <div>Main Dashboard (Coming Soon)</div>;

function App() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/signup" element={!isAuthenticated ? <SignupPage /> : <Navigate to="/" />} />

      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/" element={<DashboardPlaceholder />} />

        {isAdmin && (
          <>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            {/* ΝΕΟ ROUTE ΓΙΑ DETAILS: Το :username είναι μεταβλητή */}
            <Route path="/admin/users/:username" element={<AdminUserDetailsPage />} />
            <Route path="/admin/teams" element={<AdminTeamsPlaceholder />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;