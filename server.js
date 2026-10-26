import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import mongoose from 'mongoose';
import Note from './models/Note.js';

try { process.loadEnvFile(); } catch {} // .env is optional

const app = express();
app.use(express.json());

const DATA_DIR = process.env.DATA_DIR || '.';
const FILE = path.join(DATA_DIR, 'data.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
const PIN = process.env.ADMIN_PIN || '1234'; // set a real one: ADMIN_PIN=xxxx npm start
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return callback(new Error('Please select a PDF file'));
    }
    callback(null, true);
  },
});

// --- tiny storage layer: swap these two for SQLite later ---
const load = () =>
  fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { resources: [], notes: [] };
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
  dbName: process.env.MONGODB_DB || 'pd_calendar',
});

// Resources stay in data.json; notes live in MongoDB.
const getData = async () => ({
  resources: load().resources,
  notes: await Note.find({}, { _id: 0 }).sort({ created: 1 }).lean(),
});

const admin = (req, res, next) =>
  req.get('x-admin-pin') === PIN ? next() : res.status(401).json({ error: 'Wrong admin PIN' });

app.get('/api/data', async (req, res) => res.json(await getData()));

app.post('/api/resources', admin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'PDF must be 20 MB or smaller' : err.message });
    const { title, instructions, type, url, date } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Title and date required' });
    if (req.file && req.file.buffer.subarray(0, 5).toString() !== '%PDF-')
      return res.status(400).json({ error: 'The selected file is not a valid PDF' });

    let resourceUrl = url || '';
    if (req.file) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const filename = `${crypto.randomUUID()}.pdf`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
      resourceUrl = `/uploads/${filename}`;
    }

    const d = load();
    d.resources.push({
      id: crypto.randomUUID(),
      title,
      instructions: typeof instructions === 'string' ? instructions.trim().slice(0, 2000) : '',
      type: type || 'Video',
      url: resourceUrl,
      date,
    });
    save(d);
    res.json(await getData());
  });
});

app.delete('/api/resources/:id', admin, async (req, res) => {
  const d = load();
  const resource = d.resources.find((r) => r.id === req.params.id);
  d.resources = d.resources.filter((r) => r.id !== req.params.id);
  await Note.deleteMany({ resourceId: String(req.params.id) });
  save(d);
  if (resource?.url?.startsWith('/uploads/')) {
    const filename = path.basename(resource.url);
    if (filename.endsWith('.pdf')) fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
  }
  res.json(await getData());
});

app.post('/api/notes', async (req, res) => {
  const { resourceId, name, text } = req.body;
  if (!resourceId || !name?.trim() || !text?.trim())
    return res.status(400).json({ error: 'Name and takeaway required' });
  await Note.create({
    id: crypto.randomUUID(),
    resourceId: String(resourceId),
    name: name.trim().slice(0, 60),
    text: text.trim().slice(0, 500),
    created: new Date().toISOString(),
  });
  res.json(await getData());
});

// Serve the built React app in production
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static('dist'));
app.get('*', (req, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
