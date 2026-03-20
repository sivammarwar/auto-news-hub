import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPanel from '@/components/AdminPanel';

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const tokenData = localStorage.getItem('admin_token');

    if (!tokenData) {
      navigate('/admin-login');
      setLoading(false);
      return;
    }

    try {
      const token = JSON.parse(tokenData);
      if (token.expires && token.expires < Date.now()) {
        localStorage.removeItem('admin_token');
        navigate('/admin-login');
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);
      setLoading(false);
    } catch {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="font-mono text-sm text-gray-400 animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Slim admin top bar */}
      <div className="sticky top-0 z-50 bg-gray-900 text-white px-4 sm:px-6 h-11 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">📰 Signal Admin</span>
          <span className="text-xs text-gray-400 hidden sm:inline">· Internal panel</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded transition"
        >
          Logout
        </button>
      </div>

      <AdminPanel />
    </div>
  );
};

export default AdminPage;