const cloudinary = require('cloudinary').v2;

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

// Generate a signed URL for accessing private/raw files
function getSignedUrl(publicId, resourceType = 'raw', format = null) {
  if (!isCloudinaryConfigured()) return null;
  initCloudinary();

  const options = {
    resource_type: resourceType,
    type: 'upload',
    sign_url: true,
    secure: true,
  };

  // For raw files, we need to include the format/extension
  if (format) {
    options.format = format;
  }

  return cloudinary.url(publicId, options);
}

// Extract public ID from a Cloudinary URL (without extension for raw files)
function extractPublicId(url) {
  if (!url) return null;
  // URL format: https://res.cloudinary.com/{cloud}/raw/upload/v{version}/{folder}/{filename.ext}
  const match = url.match(/\/(?:raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  
  let publicId = match[1];
  
  // For raw files, the public ID includes the extension, but for signed URLs we may need it without
  // Actually for raw files, keep the full path including extension
  return publicId;
}

// Extract file extension from URL
function extractFormat(url) {
  if (!url) return null;
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : null;
}

// Get resource type from URL
function extractResourceType(url) {
  if (!url) return 'raw';
  if (url.includes('/image/upload/')) return 'image';
  if (url.includes('/video/upload/')) return 'video';
  return 'raw';
}

module.exports = { 
  isCloudinaryConfigured, 
  uploadToCloudinary, 
  getSignedUrl, 
  extractPublicId,
  extractResourceType,
  extractFormat
};
