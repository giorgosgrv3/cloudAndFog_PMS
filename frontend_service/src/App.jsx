import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailsPage from './pages/AdminUserDetailsPage';
import AdminTeamsPage from './pages/AdminTeamsPage';
import UserProfilePage from './pages/UserProfilePage'; // <--- 1. NEW IMPORT
import AdminTeamDetailsPage from './pages/AdminTeamDetailsPage'; // <--- Import
import AdminTaskDetailsPage from './pages/AdminTaskDetailsPage'; // <--- 1. IMPORT
import DashboardPage from './pages/DashboardPage'; // <--- IMPORT
import UserTeamsPage from './pages/UserTeamsPage'; // <--- IMPORT
import UserTeamDetailsPage from './pages/UserTeamDetailsPage';
import UserTaskDetailsPage from './pages/UserTaskDetailsPage'; // <--- IMPORT
import UserMyTasksPage from './pages/UserMyTasksPage'; // <--- Import
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/signup" element={!isAuthenticated ? <SignupPage /> : <Navigate to="/" />} />

      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/" element={<DashboardPage />} />
        
        {/* 2. NEW ROUTE - Available to ALL logged in users */}
        <Route path="/profile" element={<UserProfilePage />} />
        <Route path="/teams" element={<UserTeamsPage />} />
        <Route path="/teams/:teamId" element={<UserTeamDetailsPage />} /> {/* <--- ΝΕΟ ROUTE */}
        <Route path="/teams/:teamId/tasks/:taskId" element={<UserTaskDetailsPage />} /> {/* <--- ΝΕΟ ROUTE */}
        <Route path="/my-tasks" element={<UserMyTasksPage />} />

        
        {isAdmin && (
  <>
    <Route path="/admin/users" element={<AdminUsersPage />} />
    <Route path="/admin/users/:username" element={<AdminUserDetailsPage />} />
    <Route path="/admin/teams" element={<AdminTeamsPage />} />
    <Route path="/admin/teams/:teamId" element={<AdminTeamDetailsPage />} />
    
    {/* 2. NEW ROUTE */}
    <Route path="/admin/tasks/:taskId" element={<AdminTaskDetailsPage />} />
  </>
)}
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;