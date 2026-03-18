import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPanel from '@/components/AdminPanel';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has valid admin token
    const tokenData = localStorage.getItem('admin_token');
    
    if (!tokenData) {
      // No token, redirect to login
      navigate('/admin-login');
      setLoading(false);
      return;
    }

    try {
      const token = JSON.parse(tokenData);
      
      // Check if token has expired
      if (token.expires && token.expires < Date.now()) {
        // Token expired, clear it
        localStorage.removeItem('admin_token');
        navigate('/admin-login');
        setLoading(false);
        return;
      }

      // Token is valid
      setIsAuthenticated(true);
      setLoading(false);
    } catch (err) {
      // Invalid token format
      localStorage.removeItem('admin_token');
      navigate('/admin-login');
      setLoading(false);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-meta animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      
      <main className="flex-1">
        <div className="p-4 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
          <h1 className="text-lg font-bold text-blue-900">Admin Panel</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Logout
          </button>
        </div>
        
        <AdminPanel />
      </main>

      <SiteFooter />
    </div>
  );
};

export default AdminPage;