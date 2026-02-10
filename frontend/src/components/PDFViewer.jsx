import React, { useEffect, useRef } from 'react';
import { pdfjs } from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const PDFViewer = ({ url }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const renderPDF = async () => {
      const loadingTask = pdfjs.getDocument(url);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
    };
    renderPDF();
  }, [url]);

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
    </div>
  );
};

export default PDFViewer;
