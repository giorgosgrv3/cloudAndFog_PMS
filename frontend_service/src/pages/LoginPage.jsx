import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // <--- ΜΙΑ ΦΟΡΑ, ΟΛΑ ΜΑΖΙ
import { useAuth } from '../context/AuthContext';
import { api } from '../api/endpoints';


export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Παίρνουμε τη συνάρτηση login από το Context που φτιάξαμε πριν
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Καθαρισμός παλιών σφαλμάτων

    try {
      // 1. Στέλνουμε τα στοιχεία στο User Service
      // ΣΗΜΕΙΩΣΗ: Το FastAPI περιμένει τα πεδία ως form-data συνήθως, 
      // αλλά εδώ το axios.js στέλνει JSON. Αν το backend σου χρησιμοποιεί
      // OAuth2PasswordRequestForm, ίσως χρειαστεί αλλαγή. 
      // Για τώρα δοκιμάζουμε με JSON που είναι το πιο συνηθισμένο στα REST APIs.
      const { data } = await api.auth.login({ username, password });
      
      // 2. Το FastAPI επιστρέφει συνήθως { access_token: "...", token_type: "bearer" }
      if (data.access_token) {
          login(data.access_token);
          navigate('/'); // Πηγαίνουμε στην αρχική σελίδα μετά την επιτυχία
      } else {
          setError('Login failed: No token received');
      }

    } catch (err) {
      console.error(err);
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign In</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Log In
          </button>
        </form>
        
        <div className="mt-4 text-center text-sm text-gray-600">
    Don't have an account? <Link to="/signup" className="text-blue-500 hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  );
}