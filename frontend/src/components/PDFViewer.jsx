import React from 'react';

const PDFViewer = ({ url }) => {
  if (!url) return null;
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
};

export default PDFViewer;
