import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
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

  // Allow all file types
  function isAllowedFile(f) {
    return true;
  }

  function pickFile(f) {
    if (!f) return;

    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB for PDFs
    const isPdf = String(f.type || '').toLowerCase() === 'application/pdf';

    // PDFs can be up to 50MB
    if (isPdf && f.size > MAX_PDF_BYTES) {
      toastError('PDF is too large. Max 50MB allowed.');
      return;
    }

    // Non-PDFs must be under 10MB
    if (!isPdf && f.size >= MAX_FILE_BYTES) {
      toastError('File size too large. Please upload a file smaller than 10MB.');
      return;
    }

    // No file type restriction
    setFile(f);
  }

  function validateFields() {
    if (!title.trim() || title.length < 2 || title.length > 120) {
      toastError('Title is required (2-120 chars)');
      return false;
    }
    if (!subject.trim() || subject.length < 2 || subject.length > 60) {
      toastError('Subject is required (2-60 chars)');
      return false;
    }
    if (!semester || !/^[1-8]$/.test(semester)) {
      toastError('Semester is required (1-8)');
      return false;
    }
    if (description && description.length > 500) {
      toastError('Description must be under 500 characters');
      return false;
    }
    if (!file) {
      toastError('Please select a file to upload');
      return false;
    }
    if (!file.name || file.name.length > 255) {
      toastError('File name is too long');
      return false;
    }
    if (!file.type || file.type.length < 3 || file.type.length > 100) {
      toastError('Invalid file type');
      return false;
    }
    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validateFields()) return;
    setLoading(true);
    setUploadStatus('Uploading to storage...');
    try {
      // Upload file directly to Supabase Storage
      const bucket = 'noteflow-files';
      const ext = file.name.split('.').pop();
      const supabasePath = `files/${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`;
      const { data, error } = await supabase.storage.from(bucket).upload(supabasePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error || !data?.path) {
        toastError('Upload failed — file not saved properly');
        setLoading(false);
        setUploadStatus('');
        return;
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(supabasePath);
      const fileUrl = publicUrlData.publicUrl;
      setUploadStatus('Saving note metadata...');
      // Send metadata to backend
      const res = await api.post('/api/notes', {
        title: title.trim(),
        subject: subject.trim(),
        semester: semester.trim(),
        description: description.trim(),
        fileUrl,
        originalName: file.name,
        mimeType: file.type,
      });
      setUploadStatus('');
      toastSuccess('Note uploaded successfully!');
      navigate(`/note/${res.data.note?._id || ''}`);
    } catch (err) {
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
