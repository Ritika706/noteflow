import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';
import { toastError, toastSuccess } from '../lib/toast';
import { Card } from '../components/Card';
import { Tabs } from '../components/Tabs';
import { Input } from '../components/Input';
import Button from '../components/Button';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function AuthPage() {
  const navigate = useNavigate();
  const query = useQuery();
  const initialMode = query.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await api.post('/api/auth/register', { name, email, password });
        toastSuccess('Account created! Welcome to NoteFlow');
        navigate('/auth?mode=login', { replace: true });
        setPassword('');
        return;
      }

      const res = await api.post('/api/auth/login', { email, password });
      setToken(res.data.token);
      toastSuccess('Welcome back!');
      navigate('/', { replace: true });
    } catch (err) {
      toastError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <Card className="glass p-6">
        <div className="mb-4">
          <div className="font-display text-2xl font-bold">{mode === 'signup' ? 'Create account' : 'Welcome back'}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {mode === 'signup' ? 'Join NoteFlow and start sharing notes.' : 'Login to access uploads, downloads and profile.'}
          </div>
        </div>

        <Tabs
          value={mode}
          onChange={(v) => {
            setMode(v);
            navigate(`/auth?mode=${v}`, { replace: true });
          }}
          tabs={[
            { value: 'login', label: 'Login' },
            { value: 'signup', label: 'Signup' },
          ]}
        />

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {mode === 'signup' ? (
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
            />
          </div>

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Login'}
          </Button>

          {mode === 'login' ? (
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Forgot password?
            </Link>
          ) : null}

          <Link to="/" className="inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary/10">
            Back to home
          </Link>
        </form>
      </Card>
    </div>
  );
}
