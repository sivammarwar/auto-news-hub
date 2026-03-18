import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPanel from '@/components/AdminPanel';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

// Simple admin check - replace with your auth method
const checkAdmin = () => {
  const adminToken = localStorage.getItem('admin_token');
  return !!adminToken;
};

const AdminPage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check admin status on mount
    const admin = checkAdmin();
    setIsAdmin(admin);
    setLoading(false);

    if (!admin) {
      // Redirect to home after 2 seconds if not admin
      const timer = setTimeout(() => navigate('/'), 2000);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-meta animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
            <p className="text-sm text-gray-500 mb-6">
              For testing, set admin token in browser console:
            </p>
            <code className="block bg-gray-100 p-4 rounded mb-4 text-left text-sm overflow-x-auto">
              localStorage.setItem('admin_token', 'test-token');
            </code>
            <p className="text-xs text-gray-500">Redirecting to home...</p>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <AdminPanel />
      </main>
      <SiteFooter />
    </div>
  );
};

export default AdminPage;