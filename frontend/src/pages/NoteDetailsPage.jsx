import FileViewer from '../components/FileViewer';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import { toastError, toastInfo, toastSuccess } from '../lib/toast';
import { getAxiosErrorMessage } from '../lib/axiosError';
import { Badge } from '../components/Badge';
import Button from '../components/Button';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';

export default function NoteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const previewRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/api/notes/${id}`);
        setNote(res.data.note);
        setViewer(res.data.viewer || null);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load note');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Use direct Supabase public URL for preview (Google Docs Viewer needs public access)
  const previewUrl = note?.fileUrl || null;

  async function download() {
    if (!isLoggedIn()) {
      toastInfo('Login required to download.');
      navigate('/auth?mode=login');
      return;
    }

    try {
      const res = await api.get(`/api/notes/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });

      const disposition = res.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      const fileName = decodeURIComponent(match?.[1] || match?.[2] || note?.originalName || 'note');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toastSuccess('Download started!');
    } catch (e) {
      const msg = await getAxiosErrorMessage(e, 'Download failed');
      toastError(msg);
    }
  }

  if (loading) return <div>Loading…</div>;
  if (error) return <div className="rounded-xl border border-destructive/20 bg-white/70 p-3 text-sm text-destructive">{error}</div>;
  if (!note) return null;

  async function toggleBookmark() {
    if (!isLoggedIn()) {
      toastInfo('Login required to bookmark.');
      navigate('/auth?mode=login');
      return;
    }
    try {
      const res = await api.post(`/api/me/bookmarks/${id}`);
      setViewer((v) => ({ ...(v || {}), bookmarked: Boolean(res.data.bookmarked) }));
      toastSuccess(res.data.bookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
    } catch (e) {
      toastError(e?.response?.data?.message || 'Bookmark failed');
    }
  }

  async function toggleLike() {
    if (!isLoggedIn()) {
      toastInfo('Login required to like.');
      navigate('/auth?mode=login');
      return;
    }
    try {
      const res = await api.post(`/api/notes/${id}/like`);
      setViewer((v) => ({ ...(v || {}), liked: Boolean(res.data.liked) }));
      setNote((n) => {
        if (!n) return n;
        const delta = res.data.liked ? 1 : -1;
        return { ...n, likesCount: Math.max(0, Number(n.likesCount || 0) + delta) };
      });
    } catch (e) {
      toastError(e?.response?.data?.message || 'Like failed');
    }
  }

  async function setRating(value) {
    if (!isLoggedIn()) {
      toastInfo('Login required to rate.');
      navigate('/auth?mode=login');
      return;
    }
    try {
      const res = await api.post(`/api/notes/${id}/rate`, { value });
      setViewer((v) => ({ ...(v || {}), rating: Number(res.data.rating || value) }));
      setNote((n) => (n ? { ...n, ratingAvg: res.data.ratingAvg, ratingCount: res.data.ratingCount } : n));
      toastSuccess('Rating saved');
      window.dispatchEvent(new Event('noteflow:topRatedUpdated'));
    } catch (e) {
      toastError(e?.response?.data?.message || 'Rating failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary/10"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-primary">{note.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="primary">{note.subject}</Badge>
              <Badge>{`Semester ${note.semester}`}</Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleLike}
                className="rounded-xl px-3 py-2 text-sm font-medium border border-white/30 dark:border-white/10 bg-white/60 dark:bg-card/60 hover:bg-white/80"
              >
                {viewer?.liked ? '♥ Liked' : '♡ Like'}{typeof note.likesCount === 'number' ? ` (${note.likesCount})` : ''}
              </button>

              <button
                type="button"
                onClick={toggleBookmark}
                className="rounded-xl px-3 py-2 text-sm font-medium border border-white/30 dark:border-white/10 bg-white/60 dark:bg-card/60 hover:bg-white/80"
              >
                {viewer?.bookmarked ? 'Saved' : 'Save'}
              </button>

              <div className="ml-1 flex items-center gap-1 rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-card/60 px-3 py-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Rate:</span>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRating(v)}
                    className={
                      'text-lg leading-none transition ' +
                      ((viewer?.rating || 0) >= v ? 'text-accent' : 'text-slate-400 hover:text-slate-500')
                    }
                    aria-label={`Rate ${v}`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-300">
                  {note.ratingAvg ? `${note.ratingAvg} / 5` : '—'}{note.ratingCount ? ` (${note.ratingCount})` : ''}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Avatar name={note?.uploadedBy?.name || 'User'} />
              <div>
                <div className="font-medium text-slate-800 dark:text-slate-100">Uploaded by {note?.uploadedBy?.name || 'Unknown'}</div>
              </div>
            </div>
            {note.description ? (
              <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{note.description}</p>
            ) : null}
          </div>

          <div className="w-full md:w-72">
            <Button
              className="w-full bg-gradient-to-r from-accent to-accent/80"
              onClick={download}
            >
              Download
            </Button>
            {!isLoggedIn() ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Login required for download tracking.
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-lg font-semibold">Preview</div>
          {previewUrl ? (
            <button
              type="button"
              onClick={() => previewRef.current?.requestFullscreen?.()}
              className="rounded-xl px-3 py-2 text-sm font-medium bg-sky-200 text-black hover:bg-sky-300 dark:bg-sky-300 dark:text-slate-900"
            >
              Fullscreen
            </button>
          ) : null}
        </div>
        {!previewUrl ? (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Preview unavailable because this file is not stored in cloud storage. Please re-upload the note.
          </div>
        ) : (
          <div ref={previewRef} className="mt-4 overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10 bg-white">
            <FileViewer url={previewUrl} />
          </div>
        )}
      </Card>
    </div>
  );
}
