import React from 'react';

const GOOGLE_VIEWER_EXTS = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'csv', 'odt', 'ods', 'odp'
];

function getFileExtension(url) {
  try {
    const parts = url.split('?')[0].split('.');
    return parts[parts.length - 1].toLowerCase();
  } catch {
    return '';
  }
}

function getMimeType(url) {
  // Optionally, you can pass mimeType as a prop for more accuracy
  // Here, fallback to extension-based guessing
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
  const isGoogleSupported = GOOGLE_VIEWER_EXTS.includes(ext);

  // Exclude image, video, audio from Google Docs Viewer
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

  if (isGoogleSupported) {
    // Google Docs Viewer embed
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
    <div style={{ textAlign: 'center', marginTop: 32 }}>
      <div style={{ marginBottom: 16, color: '#555' }}>
        This file type can’t be previewed in the browser.<br />
        Please download.
      </div>
      <a
        href={url}
        download
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          background: '#2563eb',
          color: '#fff',
          borderRadius: 6,
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        Download File
      </a>
    </div>
  );
};

export default PDFViewer;
