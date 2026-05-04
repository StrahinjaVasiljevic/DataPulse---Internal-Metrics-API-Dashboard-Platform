/**
 * /api/auth — Magic link auth
 * 
 * Endpoints:
 *   POST /api/auth/magic-link   — pošalji link na email
 *   GET  /api/auth/verify/:token — verifikuj token, vrati JWT
 *   POST /api/auth/logout
 */

'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const emailProvider = require('../services/emailProvider');
const AuditLog = require('../models/AuditLog');

const JWT_SECRET = process.env.JWT_SECRET || 'datapulse-dev-secret-change-in-prod';
const JWT_TTL = '7d';

// Zahtevaj magic link
router.post('/magic-link', async (req, res) => {
  const { email, workspace_id } = req.body;
  if (!email || !workspace_id) {
    return res.status(400).json({ error: 'email and workspace_id are required' });
  }

  const user = UserModel.findOrCreate(email, workspace_id);
  const token = UserModel.createMagicLink(email);

  const link = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify/${token}`;

  // U dev modu, logovati link umesto slanja emaila
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Magic link for ${email}: ${link}`);
    return res.json({
      message: 'Magic link generated (dev mode — check server logs)',
      dev_link: link,
    });
  }

  await emailProvider.send({
    to: email,
    subject: 'Your DataPulse login link',
    body: `Click to login: ${link}\n\nThis link expires in 15 minutes.`,
  });

  res.json({ message: 'Magic link sent to your email.' });
});

// Verifikuj token
router.get('/verify/:token', (req, res) => {
  const user = UserModel.verifyMagicLink(req.params.token);
  if (!user) {
    return res.status(401).json({
      error: 'Invalid or expired magic link',
      hint: 'Request a new login link.',
    });
  }

  const jwtPayload = {
    user_id: user.id,
    email: user.email,
    workspace_id: user.workspace_id,
    role: user.role,
  };

  const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_TTL });

  AuditLog.record({
    workspace_id: user.workspace_id,
    actor: user.email,
    action: 'auth.login',
    target: user.email,
  });

  // Redirect na dashboard sa tokenom (ili vrati JSON za API klijente)
  if (req.headers.accept?.includes('text/html')) {
    return res.redirect(`/dashboard.html?token=${token}`);
  }

  res.json({ token, user: jwtPayload, expires_in: JWT_TTL });
});

router.post('/logout', (req, res) => {
  // JWT je stateless — klijent samo obriše token
  res.json({ message: 'Logged out. Please clear your token client-side.' });
});

module.exports = router;
