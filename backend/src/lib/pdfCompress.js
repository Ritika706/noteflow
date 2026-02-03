const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const fs = require('fs');
const path = require('path');
const os = require('os');

function isILovePdfConfigured() {
  return Boolean(
    process.env.ILOVEPDF_PUBLIC_KEY &&
    process.env.ILOVEPDF_SECRET_KEY
  );
}

/**
 * Compress PDF using iLovePDF API
 * Free tier: 250 files/month
 */
async function compressPdfWithILovePDF(inputBuffer, { compressionLevel = 'recommended' } = {}) {
  if (!Buffer.isBuffer(inputBuffer)) {
    throw new Error('Input must be a Buffer');
  }

  if (!isILovePdfConfigured()) {
    throw new Error('iLovePDF API keys not configured');
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `ilovepdf_input_${timestamp}.pdf`);
  const outputPath = path.join(tmpDir, `ilovepdf_output_${timestamp}.pdf`);

  try {
    // Write input buffer to temp file
    await fs.promises.writeFile(inputPath, inputBuffer);

    // Initialize iLovePDF
    const instance = new ILovePDFApi(
      process.env.ILOVEPDF_PUBLIC_KEY,
      process.env.ILOVEPDF_SECRET_KEY
    );

    // Create compress task
    const task = instance.newTask('compress');
    await task.start();

    // Add file to task
    const file = new ILovePDFFile(inputPath);
    await task.addFile(file);

    // Process with compression level: 'low', 'recommended', 'extreme'
    await task.process({ compression_level: compressionLevel });

    // Download compressed file
    const data = await task.download();
    await fs.promises.writeFile(outputPath, data);

    // Read compressed output
    const outputBuffer = await fs.promises.readFile(outputPath);
    
    console.log(`[iLovePDF] Compressed: ${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB → ${(outputBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    
    return outputBuffer;
  } finally {
    // Cleanup temp files
    try { await fs.promises.unlink(inputPath); } catch (e) { /* ignore */ }
    try { await fs.promises.unlink(outputPath); } catch (e) { /* ignore */ }
  }
}

module.exports = { compressPdfWithILovePDF, isILovePdfConfigured };
