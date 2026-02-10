import React, { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = worker;



const PDFViewer = ({ url }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [scale, setScale] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const minScale = 0.5;
  const maxScale = 3.0;
  const scaleStep = 0.2;

  useEffect(() => {
    if (!url) return;
    const renderPDF = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";
      const loadingTask = getDocument(url);
      const pdf = await loadingTask.promise;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        // Add border and margin for each page
        canvas.style.marginBottom = '24px';
        canvas.style.border = '1.5px solid #d1d5db'; // Tailwind gray-300
        canvas.style.borderRadius = '8px';
        canvas.style.background = '#fff';
        canvas.style.boxShadow = '0 2px 8px 0 rgba(0,0,0,0.04)';
        containerRef.current.appendChild(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
      }
    };
    renderPDF();
  }, [url, scale]);

  // Fullscreen logic
  const handleFullscreen = () => {
    if (viewerRef.current) {
      if (!document.fullscreenElement) {
        viewerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen change to update state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(maxScale, s + scaleStep));
  const handleZoomOut = () => setScale((s) => Math.max(minScale, s - scaleStep));
  const handleReset = () => setScale(1.5);

  return (
    <div
      ref={viewerRef}
      style={{
        width: '100%',
        textAlign: 'center',
        background: isFullscreen ? '#f9fafb' : 'transparent',
        minHeight: isFullscreen ? '100vh' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isFullscreen ? 'center' : undefined,
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 9999 : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={handleZoomOut} disabled={scale <= minScale} style={{ fontSize: 20, padding: '2px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>−</button>
        <span style={{ minWidth: 60, display: 'inline-block' }}>{(scale * 100).toFixed(0)}%</span>
        <button onClick={handleZoomIn} disabled={scale >= maxScale} style={{ fontSize: 20, padding: '2px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>+</button>
        <button onClick={handleReset} style={{ marginLeft: 12, fontSize: 14, padding: '2px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Reset</button>
        <button onClick={handleFullscreen} style={{ marginLeft: 12, fontSize: 16, padding: '2px 12px', borderRadius: 4, border: '1px solid #d1d5db', background: '#e5e7eb', cursor: 'pointer' }}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
      </div>
      <div
        ref={containerRef}
        style={{
          width: isFullscreen ? '100vw' : '100%',
          maxHeight: isFullscreen ? 'calc(100vh - 60px)' : '70vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isFullscreen ? 'center' : 'flex-start',
          textAlign: 'center',
          margin: '0 auto',
          padding: isFullscreen ? '32px 0' : '0',
        }}
      />
    </div>
  );
};

export default PDFViewer;
