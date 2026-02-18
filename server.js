const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { containsSlur } = require('./moderation');

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory ban system
const bannedIPs = new Map();
const ATTEMPTS_LIMIT = 3;
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;   // 24h
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;      // 1h reset

function checkAndBanIP(ip) {
  const now = Date.now();
  let record = bannedIPs.get(ip) || { attempts: 0, lastAttempt: 0, banUntil: 0 };

  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    record.attempts = 0;
  }

  record.lastAttempt = now;

  if (record.banUntil > now) {
    return { banned: true, until: new Date(record.banUntil).toISOString() };
  }

  record.attempts++;
  bannedIPs.set(ip, record);

  if (record.attempts >= ATTEMPTS_LIMIT) {
    record.banUntil = now + BAN_DURATION_MS;
    console.log(`BANNED ${ip} until ${new Date(record.banUntil).toISOString()}`);
    return { banned: true, until: new Date(record.banUntil).toISOString() };
  }

  return { banned: false, attemptsLeft: ATTEMPTS_LIMIT - record.attempts };
}

// Ban middleware
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path.startsWith('/api/') &&
      (req.path.includes('/thread') || req.path.includes('/reply'))) {
    const ip = req.ip || req.connection.remoteAddress;
    const status = checkAndBanIP(ip);
    if (status.banned) {
      return res.status(429).json({
        error: `Your IP is banned until ${status.until} due to repeated violations.`
      });
    }
  }
  next();
});

let boards = { general: [], hunts: [], dox: [] };

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    boards = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(boards, null, 2));
}

loadData();

// Lista wątków
app.get('/api/:board', (req, res) => {
  const board = req.params.board;
  if (!boards[board]) return res.status(404).json({ error: 'Board not found' });
  res.json(boards[board]);
});

// Konkretny wątek
app.get('/api/:board/:threadId', (req, res) => {
  const { board, threadId } = req.params;
  if (!boards[board]) return res.status(404).json({ error: 'Board not found' });
  const thread = boards[board].find(t => t.id === parseInt(threadId));
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
});

// Nowy wątek
app.post('/api/:board/thread', upload.single('image'), (req, res) => {
  const { board } = req.params;
  const { title, comment } = req.body;

  if (!boards[board]) return res.status(400).json({ error: 'Invalid board' });
  if (!title || !comment) return res.status(400).json({ error: 'Title and comment required' });

  if (containsSlur(title) || containsSlur(comment)) {
    const ip = req.ip || req.connection.remoteAddress;
    const banStatus = checkAndBanIP(ip);
    if (banStatus.banned) {
      return res.status(429).json({ error: `Banned until ${banStatus.until}` });
    }
    return res.status(403).json({
      error: 'Content contains prohibited slurs or hate speech.',
      attemptsLeft: banStatus.attemptsLeft
    });
  }

  const threadId = boards[board].length ? Math.max(...boards[board].map(t => t.id)) + 1 : 1;

  const newThread = {
    id: threadId,
    title: title.trim(),
    created: new Date().toISOString(),
    posts: [{
      id: 1,
      time: new Date().toISOString(),
      comment: comment.trim(),
      image: req.file ? `/uploads/${req.file.filename}` : null,
      reactions: {}
    }]
  };

  boards[board].unshift(newThread);
  saveData();
  res.json({ success: true, threadId });
});

// Odpowiedź
app.post('/api/:board/:threadId/reply', upload.single('image'), (req, res) => {
  const { board, threadId } = req.params;
  const { comment } = req.body;

  if (!boards[board]) return res.status(400).json({ error: 'Invalid board' });
  if (!comment) return res.status(400).json({ error: 'Comment required' });

  if (containsSlur(comment)) {
    const ip = req.ip || req.connection.remoteAddress;
    const banStatus = checkAndBanIP(ip);
    if (banStatus.banned) {
      return res.status(429).json({ error: `Banned until ${banStatus.until}` });
    }
    return res.status(403).json({
      error: 'Reply contains prohibited slurs or hate speech.',
      attemptsLeft: banStatus.attemptsLeft
    });
  }

  const thread = boards[board].find(t => t.id === parseInt(threadId));
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const postId = thread.posts.length + 1;
  thread.posts.push({
    id: postId,
    time: new Date().toISOString(),
    comment: comment.trim(),
    image: req.file ? `/uploads/${req.file.filename}` : null,
    reactions: {}
  });

  saveData();
  res.json({ success: true });
});

// Reakcje
const allowedEmojis = ['👍', '😂', '😢', '🔥', '💀', '🤔', '❤️'];

app.post('/api/:board/:threadId/:postId/react', (req, res) => {
  const { board, threadId, postId } = req.params;
  const { emoji } = req.body;

  if (!allowedEmojis.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  if (!boards[board]) return res.status(404).json({ error: 'Board not found' });
  const thread = boards[board].find(t => t.id === parseInt(threadId));
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const post = thread.posts.find(p => p.id === parseInt(postId));
  if (!post) return res.status(404).json({ error: 'Post not found' });

  if (!post.reactions) post.reactions = {};

  post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;

  saveData();
  res.json({ success: true, reactions: post.reactions });
});

app.listen(PORT, () => {
  console.log(`IPHPG running → http://localhost:${PORT}`);
});
