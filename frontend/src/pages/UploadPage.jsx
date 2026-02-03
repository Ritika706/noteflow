import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { toastError, toastSuccess } from '../lib/toast';
import { getAxiosErrorMessage } from '../lib/axiosError';

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const canSubmit = Boolean(title.trim() && subject.trim() && semester && file && !loading);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return { name: file.name, sizeMb };
  }, [file]);

  function isAllowedFile(f) {
    const allowed = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    return allowed.has(f.type);
  }

  function pickFile(f) {
    if (!f) return;

    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB for PDFs (server compresses)
    const isPdf = String(f.type || '').toLowerCase() === 'application/pdf';

    // PDFs can be up to 50MB (server will compress with Ghostscript)
    if (isPdf && f.size > MAX_PDF_BYTES) {
      toastError('PDF is too large. Max 50MB allowed.');
      return;
    }

    // Non-PDFs must be under 10MB
    if (!isPdf && f.size >= MAX_FILE_BYTES) {
      toastError('File size too large. Please upload a file smaller than 10MB.');
      return;
    }

    if (!isAllowedFile(f)) {
      toastError('Only PDF, images, and Word docs allowed');
      return;
    }
    setFile(f);
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (!file) return;

    const form = new FormData();
    form.append('title', title);
    form.append('subject', subject);
    form.append('semester', semester);
    form.append('description', description);
    form.append('file', file);

    setLoading(true);
    const isPdf = String(file.type || '').toLowerCase() === 'application/pdf';
    const isLargePdf = isPdf && file.size > 5 * 1024 * 1024; // > 5MB
    
    if (isLargePdf) {
      setUploadStatus('Compressing PDF... This may take a moment.');
    } else {
      setUploadStatus('Uploading...');
    }
    
    try {
      const res = await api.post('/api/notes', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('');
      toastSuccess('Note uploaded successfully!');
      navigate(`/note/${res.data.note?._id || ''}`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 413) {
        toastError('File size is too large. Please upload a file smaller than 10MB.');
        return;
      }
      toastError(await getAxiosErrorMessage(err, 'Failed to upload note'));
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold">
          <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">Share Your Notes</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Upload PDF, images, or Word documents.
        </p>
      </div>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Semester</label>
              <Select className="mt-1" value={semester} onChange={(e) => setSemester(e.target.value)} required>
                <option value="" disabled>Select…</option>
                {Array.from({ length: 8 }).map((_, i) => {
                  const v = String(i + 1);
                  return (
                    <option key={v} value={v}>{v}</option>
                  );
                })}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-card/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="text-sm font-medium">File</label>
            <div
              className="mt-1 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-card/50 p-6 text-center transition hover:border-primary/50"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="text-sm text-slate-700 dark:text-slate-200">Drag & drop your file here</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">or click to browse</div>
              <input
                type="file"
                className="mt-4 block w-full text-sm"
                accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
            </div>

            {fileMeta ? (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{fileMeta.name}</div>
                  <div className="text-xs text-slate-500">{fileMeta.sizeMb} MB</div>
                </div>
                <Button variant="ghost" type="button" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </div>
            ) : null}
          </div>

          <Button className="w-full" type="submit" disabled={!canSubmit}>
            {loading ? (uploadStatus || 'Uploading…') : 'Upload Note'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
