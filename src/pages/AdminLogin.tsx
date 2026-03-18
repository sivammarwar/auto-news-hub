import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // CHANGE THIS TO YOUR PASSWORD!
  const ADMIN_PASSWORD = '@3088shivA+her'; // ← Change this to a strong password

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check password
      if (password === ADMIN_PASSWORD) {
        // Set token in localStorage (valid for 24 hours)
        const token = {
          value: 'admin-token-' + Date.now(),
          expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        };
        localStorage.setItem('admin_token', JSON.stringify(token));
        
        // Redirect to admin panel
        navigate('/admin-panel');
      } else {
        setError('❌ Incorrect password. Try again.');
        setPassword('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
            <p className="text-gray-600">Enter your password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading || !password}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            For security: session expires after 24 hours
          </p>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
};

export default AdminLogin;