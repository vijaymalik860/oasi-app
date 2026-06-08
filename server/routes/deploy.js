const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const router = express.Router();

// State to hold current deployment logs
let deployLogs = [];
let isDeploying = false;
let deployHistory = [];

// Middleware for SSE authentication via query params
const authenticateSSE = (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('Access denied.');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'super_admin') {
      return res.status(403).send('Forbidden.');
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send('Invalid token.');
  }
};

// Middleware for regular routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Access denied.' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const addLog = (message, type = 'info') => {
  const log = { timestamp: new Date().toISOString(), message, type };
  deployLogs.push(log);
  // Maintain a reasonable log size in memory
  if (deployLogs.length > 1000) deployLogs.shift();
};

const runCommand = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    addLog(`> ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, shell: true });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(l => addLog(l));
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(l => addLog(l, 'warning'));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        addLog(`Command failed with exit code ${code}`, 'error');
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      addLog(`Failed to start command: ${err.message}`, 'error');
      reject(err);
    });
  });
};

// GET /api/deploy/logs - SSE endpoint for live logs
router.get('/logs', authenticateSSE, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send current logs immediately
  res.write(`data: ${JSON.stringify({ type: 'init', logs: deployLogs })}\n\n`);

  // Send a heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 15000);

  // Poll for new logs (simple polling implementation)
  let lastIndex = deployLogs.length;
  const poll = setInterval(() => {
    if (deployLogs.length > lastIndex) {
      const newLogs = deployLogs.slice(lastIndex);
      res.write(`data: ${JSON.stringify({ type: 'logs', logs: newLogs })}\n\n`);
      lastIndex = deployLogs.length;
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(poll);
  });
});

// GET /api/deploy/history
router.get('/history', authenticateAdmin, (req, res) => {
  res.json(deployHistory);
});

// GET /api/deploy/status
router.get('/status', authenticateAdmin, (req, res) => {
  res.json({ isDeploying });
});

// POST /api/deploy/trigger
router.post('/trigger', authenticateAdmin, async (req, res) => {
  if (isDeploying) {
    return res.status(400).json({ error: 'Deployment is already in progress.' });
  }

  isDeploying = true;
  deployLogs = [];
  addLog('Deployment started by ' + req.user.belt, 'info');
  
  const historyEntry = {
    id: Date.now(),
    startedAt: new Date().toISOString(),
    status: 'running',
    trigger: req.user.belt
  };
  deployHistory.unshift(historyEntry);
  if (deployHistory.length > 50) deployHistory.pop();

  res.json({ message: 'Deployment started' });

  const rootDir = path.resolve(__dirname, '../../');
  
  try {
    addLog('--- Phase 1: Pulling latest code ---');
    await runCommand('git', ['pull', 'origin', 'main'], rootDir);

    addLog('--- Phase 2: Installing dependencies ---');
    await runCommand('npm', ['install'], rootDir);

    addLog('--- Phase 3: Building frontend ---');
    await runCommand('npm', ['run', 'build'], rootDir);

    addLog('--- Phase 4: Restarting application ---');
    // Using pm2 if available, otherwise just log that manual restart is needed
    try {
       await runCommand('pm2', ['restart', 'oasi-app'], rootDir);
       addLog('Application restarted successfully via pm2', 'success');
    } catch(pm2Err) {
       addLog('pm2 restart failed or pm2 not installed. Manual server restart may be required.', 'warning');
    }

    addLog('--- Deployment completed successfully! ---', 'success');
    historyEntry.status = 'success';
    historyEntry.completedAt = new Date().toISOString();
  } catch (error) {
    addLog(`Deployment failed: ${error.message}`, 'error');
    historyEntry.status = 'failed';
    historyEntry.completedAt = new Date().toISOString();
    
    // Attempt rollback mechanism
    addLog('Attempting to rollback to previous state...', 'warning');
    try {
       await runCommand('git', ['reset', '--hard', 'HEAD@{1}'], rootDir);
       addLog('Rollback via git reset completed.', 'info');
    } catch(rbErr) {
       addLog('Rollback failed. Manual intervention required.', 'error');
    }
  } finally {
    isDeploying = false;
  }
});

module.exports = router;
