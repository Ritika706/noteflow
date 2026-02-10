import React, { useEffect, useRef } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = worker;



const PDFViewer = ({ url }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const renderPDF = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";
      const loadingTask = getDocument(url);
      const pdf = await loadingTask.promise;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
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
  }, [url]);

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div ref={containerRef} style={{ width: '100%', textAlign: 'center' }} />
    </div>
  );
};

export default PDFViewer;
