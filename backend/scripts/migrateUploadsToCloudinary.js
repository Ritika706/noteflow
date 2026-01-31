/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { connectDb } = require('../src/db');
const { Note } = require('../src/models/Note');
const { isCloudinaryConfigured, uploadToCloudinary } = require('../src/lib/cloudinary');
const { compressPdfBestEffort, getMaxBytes } = require('../src/lib/pdfCompress');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: args.includes('--dry-run'),
    limit: 0,
  };

  const limitIdx = args.findIndex((a) => a === '--limit');
  if (limitIdx >= 0 && args[limitIdx + 1]) {
    opts.limit = Number(args[limitIdx + 1]) || 0;
  }

  return opts;
}

async function main() {
  const { dryRun, limit } = parseArgs();

  if (!isCloudinaryConfigured()) {
    console.error('Missing Cloudinary env vars. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
    process.exit(1);
  }

  await connectDb();

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.error(`uploads folder not found: ${uploadsDir}`);
    process.exit(1);
  }

  const query = { $or: [{ fileUrl: { $exists: false } }, { fileUrl: '' }] };
  const cursor = Note.find(query).select('_id title filePath fileUrl mimeType originalName').cursor();

  let scanned = 0;
  let migrated = 0;
  let skippedMissing = 0;
  let skippedNoFilePath = 0;
  let skippedTooLarge = 0;
  let skippedCompressFailed = 0;

  for await (const note of cursor) {
    scanned += 1;
    if (limit && migrated >= limit) break;

    if (!note.filePath) {
      skippedNoFilePath += 1;
      continue;
    }

    const localPath = path.join(uploadsDir, note.filePath);
    if (!fs.existsSync(localPath)) {
      skippedMissing += 1;
      continue;
    }

    console.log(`Uploading ${note._id} (${note.title}) -> ${note.filePath}`);
    if (dryRun) {
      migrated += 1;
      continue;
    }

    let uploadPath = localPath;
    let compressedTempPath = null;
    try {
      const maxBytes = getMaxBytes();
      const shouldTryCompress = String(process.env.PDF_COMPRESS || 'true').toLowerCase() !== 'false';
      const isPdf = String(note.mimeType || '').includes('pdf') || String(localPath).toLowerCase().endsWith('.pdf');

      if (shouldTryCompress && isPdf) {
        const stat = await fs.promises.stat(localPath);
        if (stat.size > maxBytes) {
          const compressed = await compressPdfBestEffort(localPath);
          if (compressed.path !== localPath) {
            uploadPath = compressed.path;
            compressedTempPath = compressed.path;
          }

          if (compressed.size > maxBytes) {
            skippedTooLarge += 1;
            console.log('  ⚠️ still > 10MB after compression, skipping');
            continue;
          }
        }
      }
    } catch (e) {
      skippedCompressFailed += 1;
      console.log(`  ⚠️ compression failed, skipping: ${e.message}`);
      continue;
    }

    const uploaded = await uploadToCloudinary(uploadPath, {
      folder: process.env.CLOUDINARY_FOLDER || 'noteflow',
      resourceType: 'auto',
    });

    if (compressedTempPath) {
      try {
        await fs.promises.unlink(compressedTempPath);
      } catch (e) {
        // ignore
      }
    }

    if (uploaded?.url) {
      note.fileUrl = uploaded.url;
      await note.save();
      migrated += 1;
      console.log(`  ✅ saved fileUrl`);
    } else {
      console.log(`  ⚠️ upload returned no url`);
    }
  }

  console.log('---');
  console.log(`Scanned: ${scanned}`);
  console.log(`Migrated: ${migrated}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Skipped (missing local file): ${skippedMissing}`);
  console.log(`Skipped (no filePath): ${skippedNoFilePath}`);
  console.log(`Skipped (too large after compression): ${skippedTooLarge}`);
  console.log(`Skipped (compression failed): ${skippedCompressFailed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
