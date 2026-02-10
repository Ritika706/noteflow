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
        canvas.style.marginBottom = '20px';
        containerRef.current.appendChild(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
      }
    };
    renderPDF();
  }, [url]);

  return (
    <div ref={containerRef} style={{ width: '100%', textAlign: 'center' }} />
  );
};

export default PDFViewer;
