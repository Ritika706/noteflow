const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getMaxBytes() {
  const mb = Number(process.env.PDF_CLOUDINARY_MAX_MB || 10);
  return Math.max(1, mb) * 1024 * 1024;
}

function getGhostscriptCandidates() {
  // Prefer explicit path if provided
  const explicit = process.env.GHOSTSCRIPT_PATH;
  const candidates = [];
  if (explicit) candidates.push(explicit);

  if (process.platform === 'win32') {
    candidates.push('gswin64c');
    candidates.push('gswin32c');
    candidates.push('gs');
  } else {
    candidates.push('gs');
  }

  return candidates;
}

function runGs(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ ok: true });
      return reject(new Error(stderr || `Ghostscript failed with code ${code}`));
    });
  });
}

async function compressPdfBestEffort(inputPath) {
  const maxBytes = getMaxBytes();

  const stat = await fs.promises.stat(inputPath);
  if (stat.size <= maxBytes) {
    return { path: inputPath, size: stat.size, compressed: false };
  }

  const outPath = path.join(os.tmpdir(), `noteflow_compressed_${Date.now()}_${path.basename(inputPath)}`);

  // Quality presets: /screen (small), /ebook (medium), /printer (larger)
  const quality = process.env.PDF_GS_QUALITY || '/screen';

  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${quality}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outPath}`,
    inputPath,
  ];

  const candidates = getGhostscriptCandidates();
  let lastErr = null;
  for (const exe of candidates) {
    try {
      await runGs(exe, args);
      const outStat = await fs.promises.stat(outPath);
      return { path: outPath, size: outStat.size, compressed: true };
    } catch (e) {
      lastErr = e;
      // try next candidate
    }
  }

  // Cleanup if created
  try {
    await fs.promises.unlink(outPath);
  } catch (e) {
    // ignore
  }

  const err = new Error(
    'Unable to compress PDF automatically (Ghostscript not available or failed). ' +
      'Install Ghostscript or set GHOSTSCRIPT_PATH.'
  );
  err.cause = lastErr;
  throw err;
}

module.exports = { compressPdfBestEffort, getMaxBytes };
