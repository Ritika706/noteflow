const cloudinary = require('cloudinary').v2;
const path = require('path');

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function initCloudinary() {
  if (!isCloudinaryConfigured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return true;
}

async function uploadToCloudinary(
  localFilePath,
  { folder = 'noteflow', resourceType = 'auto' } = {}
) {
  if (!isCloudinaryConfigured()) return null;
  initCloudinary();

  const options = {
    folder,
    resource_type: resourceType,
    type: 'upload',
    access_mode: 'public',
    use_filename: true,
    unique_filename: true,
  };

  const res = await cloudinary.uploader.upload(localFilePath, options);

  return {
    url: res.secure_url,
    publicId: res.public_id,
    resourceType: res.resource_type,
  };
}

async function uploadBufferToCloudinary(
  buffer,
  { folder = 'noteflow', resourceType = 'auto', originalName = '' } = {}
) {
  if (!isCloudinaryConfigured()) return null;
  if (!buffer || !buffer.length) return null;
  initCloudinary();

  const baseName = String(originalName || '').trim();
  const nameNoExt = baseName ? path.parse(baseName).name : '';

  const options = {
    folder,
    resource_type: resourceType,
    type: 'upload',
    access_mode: 'public',
    use_filename: true,
    unique_filename: true,
    ...(nameNoExt ? { filename_override: nameNoExt } : {}),
  };

  const res = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
    stream.end(buffer);
  });

  return {
    url: res.secure_url,
    publicId: res.public_id,
    resourceType: res.resource_type,
  };
}

async function deleteFromCloudinary(publicId, { resourceType = 'raw' } = {}) {
  if (!isCloudinaryConfigured()) return null;
  if (!publicId) return null;
  initCloudinary();

  // Returns: { result: 'ok' } or { result: 'not found' }
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType || 'raw',
    type: 'upload',
  });
}

module.exports = { isCloudinaryConfigured, uploadToCloudinary, uploadBufferToCloudinary, deleteFromCloudinary };
