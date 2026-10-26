import express from 'express';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import mongoose from 'mongoose';
import Note from './models/Note.js';
import Resource from './models/Resource.js';

try { process.loadEnvFile(); } catch {} // .env is optional

const app = express();
app.use(express.json());

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

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
  dbName: process.env.MONGODB_DB || 'pd_calendar',
});

// PDFs are stored in MongoDB GridFS, served at /uploads/<uuid>.pdf
const pdfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'pdfs' });

const getData = async () => ({
  resources: await Resource.find({}, { _id: 0 }).sort({ date: 1 }).lean(),
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
      const filename = `${crypto.randomUUID()}.pdf`;
      await new Promise((resolve, reject) =>
        pdfs.openUploadStream(filename, { contentType: 'application/pdf' }).on('error', reject).on('finish', resolve).end(req.file.buffer)
      );
      resourceUrl = `/uploads/${filename}`;
    }

    await Resource.create({
      id: crypto.randomUUID(),
      title,
      instructions: typeof instructions === 'string' ? instructions.trim().slice(0, 2000) : '',
      type: type || 'Video',
      url: resourceUrl,
      date,
    });
    res.json(await getData());
  });
});

app.delete('/api/resources/:id', admin, async (req, res) => {
  const resource = await Resource.findOneAndDelete({ id: String(req.params.id) });
  await Note.deleteMany({ resourceId: String(req.params.id) });
  if (resource?.url?.startsWith('/uploads/')) {
    const files = await pdfs.find({ filename: path.basename(resource.url) }).toArray();
    await Promise.all(files.map((f) => pdfs.delete(f._id)));
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
app.get('/uploads/:file', async (req, res) => {
  const name = req.params.file;
  if (!/^[0-9a-f-]{36}\.pdf$/.test(name) || !(await pdfs.find({ filename: name }).hasNext()))
    return res.status(404).end();
  res.type('application/pdf');
  pdfs.openDownloadStreamByName(name).on('error', () => res.end()).pipe(res);
});
app.use(express.static('dist'));
app.get('*', (req, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
