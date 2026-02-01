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

module.exports = { isCloudinaryConfigured, uploadToCloudinary };
