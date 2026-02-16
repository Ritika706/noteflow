import React from 'react';

const MS_VIEWER_EXTS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
const GOOGLE_VIEWER_EXTS = ['pdf', 'txt', 'rtf', 'csv', 'odt', 'ods', 'odp'];

function getFileExtension(url) {
  try {
    const parts = url.split('?')[0].split('.');
    return parts[parts.length - 1].toLowerCase();
  } catch {
    return '';
  }
}

function getMimeType(url) {
  const ext = getFileExtension(url);
  if (["jpg","jpeg","png","gif","webp","bmp","svg"].includes(ext)) return "image";
  if (["mp4","webm","ogg","mov","avi","mkv"].includes(ext)) return "video";
  if (["mp3","wav","ogg","aac","flac"].includes(ext)) return "audio";
  return "other";
}

const PDFViewer = ({ url }) => {
  if (!url) return null;
  const ext = getFileExtension(url);
  const mimeType = getMimeType(url);

  // Images, videos, audio: native preview
  if (mimeType === "image") {
    return (
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <img src={url} alt="Preview" style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)' }} />
      </div>
    );
  }
  if (mimeType === "video") {
    return (
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <video src={url} controls style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)' }} />
      </div>
    );
  }
  if (mimeType === "audio") {
    return (
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <audio src={url} controls style={{ width: '100%' }} />
      </div>
    );
  }

  // PDF: direct iframe
  if (ext === 'pdf') {
    return (
      <iframe
        src={url}
        title="PDF Viewer"
        width="100%"
        height="700px"
        style={{ border: 'none', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)' }}
        allowFullScreen
      />
    );
  }

  // Microsoft Office Viewer for docx, pptx, xlsx, etc.
  if (MS_VIEWER_EXTS.includes(ext)) {
    const msViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return (
      <iframe
        src={msViewerUrl}
        title="Microsoft Office Viewer"
        width="100%"
        height="700px"
        style={{ border: 'none', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)' }}
        allowFullScreen
      />
    );
  }

  // Google Docs Viewer for other supported types
  if (GOOGLE_VIEWER_EXTS.includes(ext)) {
    const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    return (
      <iframe
        src={googleUrl}
        title="Google Docs Viewer"
        width="100%"
        height="700px"
        style={{ border: 'none', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)' }}
        allowFullScreen
      />
    );
  }

  // Fallback: download link for unsupported types
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <div style={{ background: '#1e293b', borderRadius: 12, boxShadow: '0 2px 8px rgba(30,41,59,0.08)', padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: 20, color: '#cbd5e1', fontSize: 18, fontWeight: 500 }}>
          <span style={{ display: 'block', marginBottom: 8 }}>This file type can’t be previewed.</span>
          <span style={{ fontSize: 15, color: '#64748b' }}>Please download to view.</span>
        </div>
        <a
          href={url}
          download
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: 16,
            boxShadow: '0 1px 4px rgba(37,99,235,0.12)',
            transition: 'background 0.2s',
          }}
        >
          Download File
        </a>
      </div>
    </div>
  );
};

export default PDFViewer;
