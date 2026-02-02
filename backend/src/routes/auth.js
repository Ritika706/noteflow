const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, password are required' });
  }

  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ name: String(name), email: normalizedEmail, passwordHash });

  return res.status(201).json({ id: user._id, name: user.name, email: user.email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { email: user.email },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: '7d' }
  );

  return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

function generateOtp() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

// Create reusable transporter (cached)
let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    console.log('[SMTP] Missing config - host:', !!host, 'user:', !!user, 'pass:', !!pass);
    return null;
  }

  const nodemailer = require('nodemailer');
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });

  return cachedTransporter;
}

async function sendResetOtpEmail({ to, name, otp }) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM;

  if (!transporter || !from) {
    console.log('[SMTP] Transporter or FROM missing - transporter:', !!transporter, 'from:', !!from);
    return false;
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject: 'NoteFlow password reset OTP',
      text: `Hi ${name || 'there'},\n\nYour NoteFlow password reset OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    });
    console.log('[SMTP] Email sent successfully to:', to);
    return true;
  } catch (e) {
    console.error('[SMTP] Email send failed:', e.message);
    return false;
  }
}

// Forgot password - request OTP
router.post('/forgot-password/request', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'email is required' });

  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  // Always return success to avoid account enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, an OTP has been sent.' });
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.resetOtpHash = otpHash;
  user.resetOtpExpiresAt = expiresAt;
  user.resetOtpRequestedAt = new Date();
  user.resetOtpAttempts = 0;
  await user.save();

  // Always log OTP for debugging (can be removed later)
  console.log(`🔐 OTP for ${user.email}: ${otp}`);

  // Send email in background (don't wait)
  sendResetOtpEmail({ to: user.email, name: user.name, otp })
    .then((sent) => {
      if (sent) console.log(`✅ Email sent to ${user.email}`);
      else console.log(`❌ Email failed for ${user.email}`);
    })
    .catch((e) => {
      console.log(`❌ Email error for ${user.email}:`, e.message);
    });

  return res.json({ message: 'If an account exists, an OTP has been sent.' });
});

// Forgot password - verify OTP + set new password
router.post('/forgot-password/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'email, otp, newPassword are required' });
  }

  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    return res.status(400).json({ message: 'Invalid OTP or expired OTP' });
  }

  if (user.resetOtpExpiresAt.getTime() < Date.now()) {
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    user.resetOtpRequestedAt = null;
    user.resetOtpAttempts = 0;
    await user.save();
    return res.status(400).json({ message: 'Invalid OTP or expired OTP' });
  }

  if ((user.resetOtpAttempts || 0) >= 5) {
    return res.status(429).json({ message: 'Too many attempts. Please request a new OTP.' });
  }

  const ok = await bcrypt.compare(String(otp), user.resetOtpHash);
  if (!ok) {
    user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
    await user.save();
    return res.status(400).json({ message: 'Invalid OTP or expired OTP' });
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.resetOtpHash = null;
  user.resetOtpExpiresAt = null;
  user.resetOtpRequestedAt = null;
  user.resetOtpAttempts = 0;
  await user.save();

  return res.json({ message: 'Password updated successfully. Please login.' });
});

module.exports = { authRouter: router };
