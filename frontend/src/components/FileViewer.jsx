const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'flac'];

function getFileExtension(url) {
  try {
    const parts = url.split('?')[0].split('.');
    return parts[parts.length - 1].toLowerCase();
  } catch {
    return '';
  }
}

function getViewerUrl(url) {
  return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
}

const FileViewer = ({ url, fullscreen = false }) => {
  if (!url) return null;
  const ext = getFileExtension(url);

  const iframeHeight = fullscreen ? '100%' : '700px';

  // Images: native preview
  if (IMAGE_EXTS.includes(ext)) {
    return (
      <div className={fullscreen ? 'flex items-center justify-center h-full bg-black' : 'mt-4 text-center'}>
        <img
          src={url}
          alt="Preview"
          className={fullscreen ? 'max-h-full max-w-full object-contain' : 'mx-auto max-w-full rounded-lg shadow-sm'}
        />
      </div>
    );
  }

  // Videos: native preview
  if (VIDEO_EXTS.includes(ext)) {
    return (
      <div className={fullscreen ? 'flex items-center justify-center h-full bg-black' : 'mt-4 text-center'}>
        <video
          src={url}
          controls
          className={fullscreen ? 'max-h-full max-w-full' : 'mx-auto max-w-full rounded-lg shadow-sm'}
        />
      </div>
    );
  }

  // Audio: native preview
  if (AUDIO_EXTS.includes(ext)) {
    return (
      <div className={fullscreen ? 'flex items-center justify-center h-full bg-white' : 'mt-4 text-center'}>
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  // All other files (PDF, DOCX, PPTX, TXT, etc.): Google Docs Viewer
  return (
    <iframe
      src={getViewerUrl(url)}
      title="Document Viewer"
      width="100%"
      height={iframeHeight}
      className="rounded-lg border"
      style={{ border: 'none' }}
      allowFullScreen
    />
  );
};

export default FileViewer;
