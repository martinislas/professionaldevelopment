import { useEffect, useState } from 'react';

const COLORS = ['#fff3a3', '#ffd6e0', '#c9f0d8', '#cfe5ff', '#ffe0b8'];
const TYPES = ['Video', 'Webinar', 'Article', 'Podcast', 'PDF', 'Other'];

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

function Card({ r, notes, onData, pin }) {
  const del = async () => {
    if (confirm('Delete this item and its notes?')) onData(await api('/resources/' + r.id, 'DELETE', null, pin));
  };
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

  useEffect(() => { api('/data').then(setData); }, []);

  const askPin = () => { const p = prompt('Admin PIN'); if (p) setPin(p); };

  const months = {};
  [...data.resources].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
    const label = new Date(r.date + 'T00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (months[label] ||= []).push(r);
  });

  return (
    <main>
      <header>
        <h1>Professional Development Calendar</h1>
        {!pin && <button className="link" onClick={askPin}>Admin</button>}
      </header>
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
  );
}
