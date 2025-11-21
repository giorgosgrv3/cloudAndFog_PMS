import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { api } from '../api/endpoints';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Όταν φορτώνει η σελίδα, τσέκαρε αν έχουμε ήδη token
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          // 1. Αποκωδικοποίησε το token για να βρεις τον Ρόλο και το Username
          const decoded = jwtDecode(token);
          
          // Ελέγχουμε αν έληξε (exp is in seconds, Date.now is in ms)
          if (decoded.exp * 1000 < Date.now()) {
            logout();
          } else {
            // 2. (Προαιρετικά) Φέρε τα φρέσκα δεδομένα του χρήστη από το User Service
            // Αυτό είναι χρήσιμο για να δούμε αν είναι active
            try {
               const { data } = await api.auth.getMe();
               // Συνδυάζουμε τα data από τη βάση με τον ρόλο από το token
               setUser({ ...data, role: decoded.role }); 
            } catch (err) {
               // Αν το token είναι έγκυρο αλλά το user service πετάξει error (π.χ. 404), κάνε logout
               console.error("User validation failed", err);
               logout();
            }
          }
        } catch (error) {
          console.error("Invalid token", error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isLeader: user?.role === 'team_leader'
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);