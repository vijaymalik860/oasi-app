// routes/deploy.js — Manual Deploy System (Govt Server ke liye)
// Sirf super_admin access kar sakta hai
const express      = require('express');
const { spawn }    = require('child_process');
const path         = require('path');
const fs           = require('fs');
const jwt          = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const router       = express.Router();

// EventSource custom headers support nahi karta
// SSE routes ke liye token query param se bhi accept karo
function authenticateSSE(req, res, next) {
  // Normal header auth try karo pehle
  const authHeader = req.headers['authorization'];
  if (authHeader) return authenticate(req, res, next);

  // Fallback: query param token
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token missing.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Token invalid.' });
  }
}

router.use(authenticate);

// Root directory of the project (server/ ke parent)
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Deploy history file (last 10 deploys)
const HISTORY_FILE = path.join(__dirname, '..', 'deploy_history.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry); // Latest pehle
  const trimmed = history.slice(0, 20); // Max 20 entries
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
}

// Track agar deploy chal raha hai (ek waqt mein sirf ek deploy)
let isDeploying = false;

// ─────────────────────────────────────────────────────
// GET /api/deploy/status — Current deploy status
// ─────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Sirf Super Admin deploy kar sakta hai.' });
  }

  const history = loadHistory();
  const lastDeploy = history[0] || null;

  res.json({
    isDeploying,
    lastDeploy,
    history: history.slice(0, 10),
  });
});

// ─────────────────────────────────────────────────────
// GET /api/deploy/stream — SSE: Real-time deploy logs
// ─────────────────────────────────────────────────────
router.get('/stream', authenticateSSE, (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Sirf Super Admin deploy kar sakta hai.' });
  }

  if (isDeploying) {
    return res.status(409).json({ error: 'Ek deploy pehle se chal raha hai. Ruko.' });
  }

  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering band karo
  res.flushHeaders();

  const startTime = new Date();
  isDeploying = true;

  // Helper: SSE message bhejo
  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data, ts: new Date().toISOString() })}\n\n`);
  };

  send('info', { msg: '🚀 Deploy shuru ho raha hai...' });
  send('info', { msg: `📁 Project: ${PROJECT_ROOT}` });

  let deploySuccess = false;
  let gitHash = '';

  // Commands jo sequence mein chalenge
  // Note: govt server pe PM2 use hota hai — agar nahi hai to last step hata sakte ho
  const commands = [
    { cmd: 'git', args: ['fetch', 'origin', 'master'], label: '📡 GitHub se latest code fetch kar raha hai...' },
    { cmd: 'git', args: ['reset', '--hard', 'origin/master'], label: '⬇️  Latest master branch pull kar raha hai...' },
    { cmd: 'git', args: ['log', '--oneline', '-1'], label: '📋 Latest commit info...' },
    { cmd: 'npm',  args: ['install', '--legacy-peer-deps'],  label: '📦 npm packages install kar raha hai...', cwd: PROJECT_ROOT },
    { cmd: 'npm',  args: ['run', 'build'],                   label: '🏗️  Frontend build kar raha hai...', cwd: PROJECT_ROOT },
    { cmd: 'pm2',  args: ['restart', 'oasi-server', '--update-env'], label: '🔄 Server restart kar raha hai (PM2)...', optional: true },
  ];

  let cmdIndex = 0;

  function runNext() {
    if (cmdIndex >= commands.length) {
      // Sab commands successful
      deploySuccess = true;
      const duration = Math.round((new Date() - startTime) / 1000);
      send('success', { msg: `✅ Deploy successfully complete! (${duration}s)`, hash: gitHash });
      saveHistory({
        status: 'success',
        deployedAt: startTime.toISOString(),
        duration,
        commitHash: gitHash,
        deployedBy: req.user.belt,
      });
      isDeploying = false;
      res.end();
      return;
    }

    const step = commands[cmdIndex];
    cmdIndex++;

    send('step', { msg: step.label, step: cmdIndex, total: commands.length });

    const proc = spawn(step.cmd, step.args, {
      cwd: step.cwd || PROJECT_ROOT,
      shell: true, // Windows ke liye zaroori
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // Git commit hash capture karo
        if (step.args[0] === 'log' && line.length > 0) {
          gitHash = line.trim();
        }
        send('log', { msg: line });
      });
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // npm warnings ko error mat treat karo
        const isWarning = line.toLowerCase().includes('warn') || line.toLowerCase().includes('deprecated');
        send(isWarning ? 'warn' : 'log', { msg: line });
      });
    });

    proc.on('close', (code) => {
      if (code !== 0 && !step.optional) {
        // Build fail — rollback
        send('error', { msg: `❌ Step fail hua: ${step.label}` });
        send('error', { msg: `Exit code: ${code}` });
        send('rollback', { msg: '⏪ Build fail hua. Server purani build pe chal raha hai (safe).' });

        saveHistory({
          status: 'failed',
          deployedAt: startTime.toISOString(),
          duration: Math.round((new Date() - startTime) / 1000),
          failedStep: step.label,
          deployedBy: req.user.belt,
        });

        isDeploying = false;
        res.end();
        return;
      }

      if (code !== 0 && step.optional) {
        send('warn', { msg: `⚠️  Optional step skip: ${step.label} (PM2 nahi mila, manually restart karo)` });
      } else {
        send('done', { msg: `✓ ${step.label.replace(/^[^\w]+/, '')} complete.` });
      }

      runNext();
    });

    proc.on('error', (err) => {
      if (step.optional) {
        send('warn', { msg: `⚠️  Optional step error: ${err.message}` });
        runNext();
      } else {
        send('error', { msg: `❌ Command error: ${err.message}` });
        isDeploying = false;
        res.end();
      }
    });
  }

  // Cleanup if client disconnects
  req.on('close', () => {
    if (isDeploying) {
      isDeploying = false;
    }
  });

  runNext();
});

module.exports = router;
