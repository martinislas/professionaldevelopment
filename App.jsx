import { useEffect, useState } from 'react';

const COLORS = ['#fff3a3', '#ffd6e0', '#c9f0d8', '#cfe5ff', '#ffe0b8'];
const TYPES = ['Video', 'Webinar', 'Article', 'Podcast', 'PDF', 'Other'];

// Files live in public/policies/
const POLICIES = [
  ['Curriculum Policy (V4) 2025-2026', 'Curriculum Policy (V4) AY_ 2025-2026 .pdf'],
  ['Curriculum Policy 2026-2027 (Draft)', 'BIS Curriculum Policy 2026 2027 [DRAFT].pdf'],
  ['Graduation Policy (V2) 2026-2027', 'BIS Graduation Policy V2 AY 2026-2027.docx.pdf'],
  ['Teacher Code of Conduct 2024-2025', 'Teacher Code of Conduct - AY 2024 2025.pdf'],
  ['School Rules and Expectations 2023-2024', 'School Rules and Expections _ AY 2023-2024.pdf'],
  ['School Uniform Guidelines 2023-2024', 'School Uniform Guidelines _ AY 2023-2024.pdf'],
  ['Homework Guidelines 2024-2025', 'Homework guide lines _ AY 2024-2025.pdf'],
  ['First Aid Procedures 2024-2025', 'First Aid Procedures AY 2024-2025.pdf'],
  ['No Cellphone Policy 2023-2024', 'No Cellphone Policy 2023-2024.pdf'],
  ['BYOD 2023-2024', 'BYOD 2023-2024.pdf'],
  ['Plagiarism (Cambridge 0457)', '0457_Plagiarism_a.pdf'],
];

async function api(path, method = 'GET', body, pin) {
  const isFormData = body instanceof FormData;
  const res = await fetch('/api' + path, {
    method,
    headers: { ...(!isFormData ? { 'Content-Type': 'application/json' } : {}), ...(pin ? { 'x-admin-pin': pin } : {}) },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}

function NoteForm({ resourceId, onSaved }) {
  const [name, setName] = useState(localStorage.getItem('pd-name') || '');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    try {
      localStorage.setItem('pd-name', name);
      onSaved(await api('/notes', 'POST', { resourceId, name, text }));
      setText('');
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="note-form">
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea placeholder="My key takeaway…" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={submit}>Post sticky note</button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function EditForm({ r, pin, onData, onDone }) {
  const [f, setF] = useState({ title: r.title, instructions: r.instructions || '', type: r.type, url: r.url, date: r.date });
  const [pdf, setPdf] = useState(null);
  const [err, setErr] = useState('');
  const hasPdf = f.url.startsWith('/uploads/');
  const save = async () => {
    try {
      const form = new FormData();
      Object.entries(f).forEach(([key, value]) => form.append(key, value));
      if (pdf) form.append('file', pdf);
      onData(await api('/resources/' + r.id, 'PUT', form, pin));
      onDone();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="admin">
      <h3>Edit item</h3>
      <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea className="instructions-field" placeholder="Instructions (optional)" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
        {TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      {hasPdf ? (
        <p>
          Current PDF attached.{' '}
          <button className="link danger" onClick={() => setF({ ...f, url: '' })}>Remove PDF</button>
        </p>
      ) : (
        <input placeholder="Link (optional)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      )}
      <label className="file-field">{hasPdf ? 'Replace PDF' : 'PDF file'}
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} />
      </label>
      <label className="date-field">Due date
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </label>
      <button onClick={save}>Save</button>
      <button className="link" onClick={onDone}>Cancel</button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function Card({ r, notes, onData, pin }) {
  const [editing, setEditing] = useState(false);
  const del = async () => {
    if (confirm('Delete this item and its notes?')) onData(await api('/resources/' + r.id, 'DELETE', null, pin));
  };
  if (editing && pin) return <EditForm r={r} pin={pin} onData={onData} onDone={() => setEditing(false)} />;
  return (
    <section className="card">
      <div className="card-head">
        <span className="badge">{r.type}</span>
        <h3>{r.title}</h3>
        {r.url && (
          <a href={r.url} target="_blank" rel="noreferrer">
            Open resource ↗
          </a>
        )}
        {pin && <button className="link" onClick={() => setEditing(true)}>Edit</button>}
        {pin && <button className="link danger" onClick={del}>Delete</button>}
      </div>
      {r.instructions && <p className="resource-instructions">{r.instructions}</p>}
      <div className="notes">
        {notes.map((n, i) => (
          <div key={n.id} className="sticky" style={{ background: COLORS[i % COLORS.length], transform: `rotate(${(i % 3) - 1}deg)` }}>
            <p>{n.text}</p>
            <small>— {n.name}</small>
          </div>
        ))}
      </div>
      <NoteForm resourceId={r.id} onSaved={onData} />
    </section>
  );
}

function AdminPanel({ pin, setPin, onData }) {
  const [f, setF] = useState({ title: '', instructions: '', type: 'Video', url: '', date: '' });
  const [pdf, setPdf] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [err, setErr] = useState('');
  const add = async () => {
    try {
      const form = new FormData();
      Object.entries(f).forEach(([key, value]) => form.append(key, value));
      if (pdf) form.append('file', pdf);
      onData(await api('/resources', 'POST', form, pin));
      setF({ title: '', instructions: '', type: 'Video', url: '', date: '' });
      setPdf(null);
      setFileInputKey((key) => key + 1);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="admin">
      <h3>Add to the calendar</h3>
      <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea className="instructions-field" placeholder="Instructions (optional)" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
        {TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input placeholder="Link (optional)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <label className="file-field">PDF file
        <input key={fileInputKey} type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} />
      </label>
      <label className="date-field">Due date
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </label>
      <button onClick={add}>Add</button>
      <button className="link" onClick={() => setPin('')}>Exit admin</button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState({ resources: [], notes: [] });
  const [pin, setPin] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => { api('/data').then(setData); }, []);

  const askPin = async () => {
    const p = prompt('Admin PIN');
    if (!p) return;
    try {
      await api('/admin/check', 'POST', null, p);
      setPin(p);
    } catch {
      alert('Wrong admin PIN');
    }
  };

  const months = {};
  [...data.resources].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
    const label = new Date(r.date + 'T00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (months[label] ||= []).push(r);
  });

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-topbar">
            <span className="school">Berkeley International School</span>
            {!pin && <button className="admin-btn" onClick={askPin}>Admin</button>}
          </div>
          <h1>Professional Development Hub</h1>
          <p className="tagline">Empowering Educators. Inspiring Excellence. Transforming Learning.</p>
          <p className="hover-hint">Hover to read more about this hub</p>
          <div className="reveal">
            <p className="intro">
            Welcome to the Berkeley International School Professional Development Hub, a dedicated space for continuous learning,
            collaboration, and professional growth. Here you will find Cambridge resources, webinars, training opportunities, teaching
            strategies, and professional learning pathways designed to support excellence in teaching and learning.
          </p>
          </div>
          <div className="managed">
            <span>Managed by</span>
            <strong>Martin Alejandro Islas</strong>
            <em>Curriculum Coordinator &amp; Cambridge Examinations Officer</em>
          </div>
          <ul className="pills">
            <li>📚 Cambridge Resources</li>
            <li>🎓 Professional Learning</li>
            <li><a href="#calendar">📅 PD Calendar</a></li>
            <li>💡 Teaching &amp; Learning</li>
            <li>
              <button className="pill-btn" aria-expanded={showWelcome} onClick={() => setShowWelcome((v) => !v)}>
                👋 Welcome message
              </button>
            </li>
          </ul>
        </div>
      </header>

      <main>
        {showWelcome && (
        <blockquote className="welcome">
          <p>Welcome colleagues,</p>
          <p>
            This Professional Development Hub has been created to support our shared commitment to excellence in education. As
            educators, we are lifelong learners, and this space will provide access to Cambridge webinars, training resources,
            professional reading, and opportunities for reflection and collaboration.
          </p>
          <p>
            I encourage you to explore the available resources and engage in professional learning that will enhance your practice
            and positively impact student outcomes.
          </p>
          <footer>
            <strong>Martin Alejandro Islas</strong>
            <em>Curriculum Coordinator &amp; Cambridge Examinations Officer</em>
          </footer>
        </blockquote>
        )}

        <h2 id="calendar" className="section-title">PD Calendar</h2>
        {pin && <AdminPanel pin={pin} setPin={setPin} onData={setData} />}
        {Object.keys(months).length === 0 && <p>Nothing scheduled yet.</p>}
        {Object.entries(months).map(([month, items]) => (
          <div key={month}>
            <h2>{month}</h2>
            {items.map((r) => (
              <Card key={r.id} r={r} pin={pin} onData={setData} notes={data.notes.filter((n) => n.resourceId === r.id)} />
            ))}
          </div>
        ))}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <h3>Berkeley International School</h3>
            <p className="footer-sub">Professional Development Hub</p>
            <p className="quote">“Exceptional schools are built by educators who never stop learning.”</p>
            <p className="footer-person">
              <strong>Professional Development Coordinator</strong><br />
              Martin Alejandro Islas<br />
              Curriculum Coordinator &amp; Cambridge Examinations Officer<br />
              📍 Phnom Penh, Cambodia
            </p>
          </div>
          <div>
            <h4>Our Vision</h4>
            <p>
              At Berkeley International School, we believe that professional growth is essential to student success. Through
              continuous learning, collaboration, reflection, and innovation, we empower educators to provide outstanding learning
              experiences for every student.
            </p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <p className="footer-sub">School Policies</p>
            <ul className="policy-list">
              {POLICIES.map(([label, file]) => (
                <li key={file}>
                  <a href={`/policies/${encodeURIComponent(file)}`} target="_blank" rel="noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>Learning • Reflection • Collaboration • Excellence</span>
          <span>© {new Date().getFullYear()} Berkeley International School</span>
        </div>
      </footer>
    </div>
  );
}
