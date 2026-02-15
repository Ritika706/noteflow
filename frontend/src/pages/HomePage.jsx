import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import { toastInfo, toastSuccess, toastError } from '../lib/toast';
import { getAxiosErrorMessage } from '../lib/axiosError';
import Button from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { NoteCard } from '../components/NoteCard';

export default function HomePage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const statsLoading = loading && stats == null;
  const statValue = (v) => (statsLoading ? '…' : v ?? 0);

  async function loadTopRated() {
    if (!isLoggedIn()) return;
    try {
      const topRes = await api.get('/api/notes/top-rated?limit=6').catch(() => ({ data: { notes: [] } }));
      setTopRated(topRes.data.notes || []);
    } catch {
      // ignore
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      // Always fetch stats (public)
      const statsRes = await api.get('/api/stats').catch(() => ({ data: null }));
      setStats(statsRes.data);

      // Only fetch notes if logged in
      if (isLoggedIn()) {
        const notesRes = await api.get('/api/notes');
        setNotes(notesRes.data.notes || []);
        await loadTopRated();
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onTopRatedUpdated() {
      loadTopRated();
    }
    window.addEventListener('noteflow:topRatedUpdated', onTopRatedUpdated);
    return () => window.removeEventListener('noteflow:topRatedUpdated', onTopRatedUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subjects = useMemo(() => {
    const s = new Set(notes.map((n) => n.subject).filter(Boolean));
    return Array.from(s).sort();
  }, [notes]);

  const semesters = useMemo(() => {
    const s = new Set(notes.map((n) => n.semester).filter(Boolean));
    return Array.from(s).sort();
  }, [notes]);

  const hasFilters = Boolean(q || subject || semester);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (notes || []).filter((n) => {
      if (subject && n.subject !== subject) return false;
      if (semester && String(n.semester) !== String(semester)) return false;
      if (!needle) return true;
      return (
        String(n.title || '').toLowerCase().includes(needle) ||
        String(n.subject || '').toLowerCase().includes(needle) ||
        String(n.semester || '').toLowerCase().includes(needle)
      );
    });
  }, [notes, q, subject, semester]);

  async function handleDownload(note) {
    if (!isLoggedIn()) {
      toastInfo('Login required to download.');
      navigate('/auth?mode=login');
      return;
    }

    try {
      const res = await api.get(`/api/notes/${note._id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });

      const disposition = res.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      const fileName = decodeURIComponent(match?.[1] || match?.[2] || note.originalName || 'note');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toastSuccess('Download started!');
      setNotes((prev) => prev.map((n) => (n._id === note._id ? { ...n, downloadCount: (n.downloadCount || 0) + 1 } : n)));
      setStats((s) => (s ? { ...s, totalDownloads: (s.totalDownloads || 0) + 1 } : s));
    } catch (e) {
      const msg = await getAxiosErrorMessage(e, 'Download failed');
      toastError(msg);
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/30 via-sky-400/20 to-accent/20 p-8 shadow-soft border border-white/30 dark:border-white/10">
        <div className="relative z-10 max-w-2xl">
          <h1 className="font-display text-4xl font-bold leading-tight">
            <span className="relative">Ace Exams<span className="absolute -bottom-1 left-0 right-0 h-1 bg-accent/70 rounded" /></span>{' '}
            with NoteFlow
          </h1>
          <p className="mt-3 text-slate-700 dark:text-slate-200">
            Browse, upload, preview and download notes — with secure tracking and a clean workflow.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {!isLoggedIn() ? (
              <Button
                className="bg-gradient-to-r from-accent to-accent/80"
                onClick={() => navigate('/auth?mode=signup')}
              >
                Get Started
              </Button>
            ) : (
              <Button variant="outline" onClick={() => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })}>
                Browse Notes
              </Button>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Card className="glass p-4 text-center">
            <div className="text-3xl mb-1">📚</div>
            <div className="font-display text-2xl font-bold text-primary">{statValue(stats?.totalNotes)}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Notes Shared</div>
          </Card>
          <Card className="glass p-4 text-center">
            <div className="text-3xl mb-1">👥</div>
            <div className="font-display text-2xl font-bold text-primary">{statValue(stats?.contributors)}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Contributors</div>
          </Card>
          <Card className="glass p-4 text-center">
            <div className="text-3xl mb-1">⬇️</div>
            <div className="font-display text-2xl font-bold text-primary">{statValue(stats?.totalDownloads)}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Downloads</div>
          </Card>
        </div>
      </section>

      {isLoggedIn() && topRated?.length ? (
        <section className="space-y-4">
          <div>
            <div className="font-display text-xl font-bold">Top Rated Notes</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Only notes rated by users are shown here.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topRated.map((n) => (
              <NoteCard key={n._id} note={n} onDownload={handleDownload} />
            ))}
          </div>
        </section>
      ) : null}

      {!isLoggedIn() ? (
        <section id="browse" className="space-y-4">
          <Card className="glass p-8 text-center">
            <div className="font-display text-xl font-bold">Login to View Notes</div>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Please login or create an account to browse and download notes.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button onClick={() => navigate('/auth?mode=login')}>Login</Button>
              <Button variant="outline" onClick={() => navigate('/auth?mode=signup')}>Sign Up</Button>
            </div>
          </Card>
        </section>
      ) : (
        <section id="browse" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <Input
                  className="pl-9"
                  placeholder="Search title, subject, semester…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-56">
              <label className="text-sm font-medium">Subject</label>
              <Select className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">All</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="w-full md:w-56">
              <label className="text-sm font-medium">Semester</label>
              <Select className="mt-1" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">All</option>
              {semesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          {hasFilters ? (
            <Button
              variant="ghost"
              onClick={() => {
                setQ('');
                setSubject('');
                setSemester('');
              }}
            >
              <span className="text-lg leading-none">×</span> Clear Filters
            </Button>
          ) : (
            <Button variant="secondary" onClick={load}>Refresh</Button>
          )}
        </div>

        {loading ? <div>Loading…</div> : null}
        {error ? <div className="rounded-xl border border-destructive/20 bg-white/70 p-3 text-sm text-destructive">{error}</div> : null}

        {!loading && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => (
              <NoteCard key={n._id} note={n} onDownload={handleDownload} />
            ))}
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">No notes found.</div>
            ) : null}
          </div>
        ) : null}
        </section>
      )}
    </div>
  );
}
