import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, Plus, CalendarDays, Users, Clock, Check, Pause, Play, Copy, X, Paperclip, Search, ArrowUpRight, MessageCircle, Settings, LogOut } from 'lucide-react';
import { DateTime } from 'luxon';
import { db, configured } from './client';
import { validate } from './schedule';
import './styles.css';
import { useLanguage } from './i18n';
import { ConnectionPanel } from './connection';
const initial = () => ({
  phone: '',
  contact_name: '',
  consent: false,
  body: '',
  mode: 'text',
  transport: 'web',
  template_name: '',
  language: 'en_US',
  parameters: [],
  local_time: DateTime.now().setZone('Asia/Jerusalem').plus({
    days: 1
  }).set({
    hour: 9,
    minute: 0
  }).toFormat("yyyy-MM-dd'T'HH:mm"),
  timezone: 'Asia/Jerusalem',
  repeat: 'once',
  weekdays: [1],
  interval_minutes: 60,
  end_date: '',
  attachment_path: null
});
const fmt = (v, z) => DateTime.fromISO(v).setZone(z || 'Asia/Jerusalem').setLocale(document.documentElement.lang || 'en').toFormat('ccc, dd LLL · HH:mm');
function App() {
  const {
    language,
    setLanguage,
    t
  } = useLanguage();
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(!configured),
    [tab, setTab] = useState('Overview'),
    [schedules, setSchedules] = useState([]),
    [jobs, setJobs] = useState([]),
    [contacts, setContacts] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState(initial),
    [review, setReview] = useState(false),
    [file, setFile] = useState(null),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(''),
    [notice, setNotice] = useState(''),
    [contact, setContact] = useState({
      name: '',
      phone: '',
      consent: false
    });
  const change = (key, value) => setForm(f => ({
    ...f,
    [key]: value
  }));
  const run = async fn => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  async function load() {
    if (!db || !session) return;
    const r = await Promise.all([db.from('aw_schedules').select('*').order('next_at'), db.from('aw_jobs').select('*,aw_parts(*)').order('created_at', {
      ascending: false
    }).limit(200), db.from('aw_contacts').select('*').order('name')]);
    for (const x of r) if (x.error) throw x.error;
    setSchedules(r[0].data);
    setJobs(r[1].data);
    setContacts(r[2].data);
  }
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({
      data
    }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data
    } = db.auth.onAuthStateChange((_, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    run(load);
    const id = setInterval(() => load().catch(e => setError(e.message)), 15000);
    return () => clearInterval(id);
  }, [session]);
  const requireAccount = () => {
    if (!session) throw Error(configured ? 'Sign in to save schedules.' : 'Connect Supabase to save schedules. See Setup for instructions.');
  };
  async function save() {
    requireAccount();
    const row = {
      ...form
    };
    delete row.id;
    delete row.created_at;
    delete row.owner_id;
    if (file) {
      const path = `${session.user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const r = await db.storage.from('autowhatsapp').upload(path, file);
      if (r.error) throw r.error;
      row.attachment_path = path;
      row.attachment_name = file.name;
      row.attachment_type = file.type;
    }
    row.next_at = validate(row);
    row.end_date = row.end_date || null;
    row.state = 'active';
    const r = form.id ? await db.from('aw_schedules').update(row).eq('id', form.id) : await db.from('aw_schedules').insert(row);
    if (r.error) throw r.error;
    setModal(false);
    setNotice('Schedule saved. Sending requires the configured background worker and WhatsApp account.');
    await load();
  }
  async function action(s, state) {
    requireAccount();
    const r = await db.from('aw_schedules').update({
      state
    }).eq('id', s.id);
    if (r.error) throw r.error;
    await load();
  }
  function compose(s) {
    setForm(s ? {
      ...s,
      id: undefined,
      local_time: initial().local_time,
      state: 'active'
    } : initial());
    setReview(false);
    setFile(null);
    setModal(true);
  }
  const active = schedules.filter(s => s.state === 'active');
  const shown = schedules.filter(s => (filter === 'all' || s.state === filter) && `${s.contact_name} ${s.phone} ${s.body}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="shell"><aside><a className="brand" href="#"><span className="brandmark"><MessageCircle size={23} /></span>AutoWhatsApp<span className="brand-dot">•</span></a><div className="workspace">{t("YOUR WORKSPACE ")}<span>{t("PERSONAL")}</span></div><nav>{[['Overview', CalendarDays], ['Messages', MessageCircle], ['Contacts', Users], ['Setup', Settings]].map(([name, Icon]) => <button className={tab === name ? 'selected' : ''} key={t(name)} onClick={() => setTab(name)}><Icon size={19} />{t(name)}{name === 'Messages' && <small>{active.length}</small>}</button>)}</nav><div className="sidebar-note"><Clock size={22} /><strong>{t("A little ahead.")}<br />{t("A lot less to remember.")}</strong><p>{t("Make time for what matters. Let your messages take care of themselves.")}</p></div><div className="account"><div className="avatar">{session ? t("ME") : t("A")}</div><div><b>{session?.user?.email || t("Your personal workspace")}</b><span>{session ? t("Supabase account") : t("Setup pending")}</span></div>{session && <button aria-label={t("Sign out")} onClick={() => db.auth.signOut()}><LogOut size={15} /></button>}</div></aside>
 <main><header><span>{t("Workspace ")}<span className="slash">/</span> {t(tab)}</span><div className="header-tools"><select aria-label={t("Interface language")} value={language} onChange={e => setLanguage(e.target.value)}><option value="en">{t("English")}</option><option value="he">עברית</option></select><span className="timezone"><Clock size={14} />{t(" Asia/Jerusalem")}</span></div></header>
 <div className="content">{error && <div className="alert" role="alert">{t(error)}<button onClick={() => setError('')}>{t("Dismiss")}</button></div>}{notice && <div className="notice" role="status">{t(notice)}<button onClick={() => setNotice('')}>×</button></div>}
 {(!configured || !session) && <div className="connection"><span className="connection-dot" /><span>{!configured ? t("Preview workspace · Connect Supabase and WhatsApp to enable scheduling.") : t("Sign in to access your private messages.")}</span><button onClick={() => setTab('Setup')}>{t("Set up account ")}<ArrowUpRight size={15} /></button></div>}
 <div className="page-title"><div><div className="eyebrow">{t("A LITTLE PLANNING GOES A LONG WAY")}</div><h1>{tab === 'Overview' ? t("Goodbye, “I forgot.”") : tab === 'Messages' ? t("Your messages, on time.") : tab === 'Contacts' ? t("People you keep close.") : t("Let’s get connected.")}</h1><p>{tab === 'Overview' ? t("The right message. The right moment. Already taken care of.") : tab === 'Contacts' ? t("Keep your recipients and their permission in one place.") : tab === 'Setup' ? t("One secure account. Messages that run while you’re away.") : t("Plan once, and leave the remembering to us.")}</p></div>{tab !== 'Setup' && <button className="primary" onClick={() => compose()}><Plus size={18} />{t(" Schedule a message")}</button>}</div>
 {(tab === 'Overview' || tab === 'Messages') && <><div className="stats">{[[CalendarDays, 'Upcoming messages', active.length, 'Ready when the moment comes'], [Clock, 'Recurring schedules', active.filter(s => s.repeat !== 'once').length, 'One less thing on your list'], [Check, 'Sent messages', jobs.filter(j => j.status === 'sent').length, 'Thoughtfully delivered']].map(([Icon, label, n, sub]) => <div className="stat" key={t(label)}><div><span>{t(label)}</span><Icon size={19} /></div><b>{n.toString().padStart(2, '0')}</b><p>{t(sub)}</p></div>)}</div>
 {tab === 'Overview' && <section className="hero"><div className="hero-copy"><span className="pill"><span />{t(" PLANNED WITH CARE")}</span><h2>{t("Stay in touch.")}<br />{t("Even when life gets busy.")}</h2><p>{t("A weekly check-in. Tomorrow’s reminder.")}<br />{t("A message that arrives just when it should.")}</p><button onClick={() => compose()}>{t("Plan your next message ")}<ArrowUpRight size={17} /></button></div><div className="illustration" aria-hidden="true"><div className="orbit o1" /><div className="orbit o2" /><div className="floating-clock"><Clock size={36} /></div><div className="message-card"><span className="mini-label"><span className="mini-icon"><MessageCircle size={17} /></span>{t(" A THOUGHT, SCHEDULED ")}<Check size={16} /></span><p>{t("Hey! Just a little reminder")}<br />{t("for tomorrow ☀")}</p><div><CalendarDays size={14} />{t(" Tomorrow, 9:00 AM ")}<span>✓✓</span></div></div><span className="spark s1">✦</span><span className="spark s2">✧</span></div></section>}
 <section className="list-section"><div className="section-heading"><div><h2>{tab === 'Overview' ? t("On the horizon") : t("Scheduled messages")}</h2><p>{t("Your plans, all in one place.")}</p></div><div className="tools"><label className="search"><Search size={16} /><input aria-label={t("Search messages")} placeholder={t("Search messages…")} value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label={t("Filter messages")} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{t("All schedules")}</option>{['active', 'paused', 'cancelled', 'completed'].map(x => <option key={x} value={x}>{t(x)}</option>)}</select></div></div>
 <div className="table-wrap"><table><thead><tr><th>{t("RECIPIENT / MESSAGE")}</th><th>{t("NEXT SEND")}</th><th>{t("REPEAT")}</th><th>{t("STATUS")}</th><th>{t("ACTIONS")}</th></tr></thead><tbody>{shown.map(s => <tr key={s.id}><td><b>{s.contact_name || s.phone}</b><span>{s.body || s.template_name || s.attachment_name}</span></td><td>{fmt(s.next_at, s.timezone)}<span>{s.timezone}</span></td><td>{s.repeat === 'interval' ? `${t("Every")} ${s.interval_minutes} ${t("minutes")}` : t(s.repeat)}</td><td><span className={'status ' + s.state}>{t(s.state)}</span></td><td><div className="actions"><button title={t("Edit")} onClick={() => {
                          setForm(s);
                          setReview(false);
                          setFile(null);
                          setModal(true);
                        }}>{t("Edit")}</button><button title={t("Duplicate")} onClick={() => compose(s)}><Copy size={15} /></button>{['active', 'paused'].includes(s.state) && <><button title={s.state === 'active' ? t("Pause") : t("Resume")} onClick={() => run(() => action(s, s.state === 'active' ? 'paused' : 'active'))}>{s.state === 'active' ? <Pause size={15} /> : <Play size={15} />}</button><button title={t("Cancel schedule")} onClick={() => run(() => action(s, 'cancelled'))}><X size={15} /></button></>}</div></td></tr>)}</tbody></table>{!shown.length && <div className="empty"><div><Send size={25} /></div><h3>{t("A clear calendar, for now.")}</h3><p>{t("Give your next message a time and place.")}<br />{t("We’ll keep it here, ready for its moment.")}</p><button onClick={() => compose()}><Plus size={15} />{t(" Create your first schedule")}</button></div>}</div></section>
 <section className="history"><h2>{t("Sending activity")}</h2>{!jobs.length ? <p>{t("Delivery updates will appear here after your first scheduled send.")}</p> : jobs.map(j => <article key={j.id}><div><b>{j.payload.contact_name || j.payload.phone}</b><span>{fmt(j.scheduled_at)} · {t(j.status)}</span><p>{j.error}</p>{j.aw_parts.map(p => <small key={p.id}>{t(p.delivery || p.status)}{p.error ? ` · ${p.error}` : ''} </small>)}</div>{j.status === 'failed' && <button onClick={() => run(async () => {
                const r = await db.rpc('aw_retry', {
                  jid: j.id
                });
                if (r.error) throw r.error;
                await load();
              })}>{t("Retry failed parts")}</button>}{j.status === 'uncertain' && <span>{t("Check WhatsApp before creating a replacement.")}</span>}</article>)}</section></>}
 {tab === 'Contacts' && <section className="panel"><h2>{t("Add a contact")}</h2><form className="contact-form" onSubmit={e => {
            e.preventDefault();
            run(async () => {
              requireAccount();
              const r = await db.from('aw_contacts').upsert(contact, {
                onConflict: 'owner_id,phone'
              });
              if (r.error) throw r.error;
              setContact({
                name: '',
                phone: '',
                consent: false
              });
              await load();
            });
          }}><label>{t("Name")}<input required value={contact.name} onChange={e => setContact({
                ...contact,
                name: e.target.value
              })} /></label><label>{t("WhatsApp number")}<input dir="ltr" required placeholder="+972501234567" pattern="\+[1-9][0-9]{7,14}" value={contact.phone} onChange={e => setContact({
                ...contact,
                phone: e.target.value
              })} /></label><label className="check"><input type="checkbox" required checked={contact.consent} onChange={e => setContact({
                ...contact,
                consent: e.target.checked
              })} />{t("I have permission to message this person.")}</label><button className="primary" disabled={busy}>{t("Save contact")}</button></form><div className="contact-grid">{contacts.map(c => <article key={c.id}><div className="avatar">{c.name.slice(0, 1)}</div><div><b>{c.name}</b><p>{c.phone}</p></div><button onClick={() => {
                compose();
                setForm({
                  ...initial(),
                  phone: c.phone,
                  contact_name: c.name,
                  consent: c.consent
                });
              }}>{t("Message")}</button><button aria-label={t("Delete contact")} onClick={() => run(async () => {
                const r = await db.from('aw_contacts').delete().eq('id', c.id);
                if (r.error) throw r.error;
                await load();
              })}><X size={16} /></button></article>)}</div></section>}
 {tab === 'Setup' && <><ConnectionPanel session={session} t={t} /><div className="setup-grid"><section className="panel"><span className="step">{t("01 / YOUR ACCOUNT")}</span><h2>{session ? t("You’re signed in") : t("Private by default")}</h2><p>{t("Use your independent AutoWhatsApp account. Its Supabase project and data are separate from BottleTrack.")}</p>{configured ? session ? <p>{session.user.email}</p> : <form onSubmit={e => {
                e.preventDefault();
                run(async () => {
                  const {
                    error
                  } = await db.auth.signInWithOtp({
                    email,
                    options: {
                      emailRedirectTo: location.origin + location.pathname
                    }
                  });
                  if (error) throw error;
                  setNotice('Check your email for a secure sign-in link.');
                });
              }}><label>{t("Email address")}<input dir="ltr" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="primary" disabled={busy || !ready}>{t("Email me a sign-in link")}</button></form> : <p className="setup-required">{t("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild. See the project README.")}</p>}</section><section className="panel"><span className="step">{t("02 / CONNECT WHATSAPP")}</span><h2>{t("Official. Reliable. Yours.")}</h2><p>{t("Configure a Meta business phone number, access token, signed webhook, and server cron in Supabase. Live sending is disabled by default.")}</p><p>{t("Messages outside a recipient’s 24-hour reply window require an approved template. Recurring schedules are usually best sent as templates.")}</p><a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/overview" target="_blank" rel="noreferrer">{t("WhatsApp platform guide ↗")}</a></section><section className="panel"><span className="step">{t("03 / ALWAYS ON")}</span><h2>{t("No open tabs required.")}</h2><p>{t("A database-backed queue is checked every minute by the server. Restarted sends with an unknown outcome are held for review to prevent accidental duplicates.")}</p><p>{t("Overdue recurring messages send once, then skip past missed occurrences. Read the deployment guide before enabling the worker.")}</p></section></div></>}
 <footer><span><MessageCircle size={14} />{t(" A little ahead. Always thoughtful.")}</span><span>{t("Built for peace of mind.")}</span></footer></div></main>
 {modal && <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><div className="modal-head"><div><div className="eyebrow">{t("MAKE ROOM FOR LATER")}</div><h2 id="compose-title">{review ? t("A final look.") : form.id ? t("Edit your message") : t("Schedule a little thought.")}</h2></div><button aria-label={t("Close")} onClick={() => setModal(false)}><X /></button></div>{error && <div className="alert" role="alert">{t(error)}</div>}
 {review ? <div className="review"><label>{t("TO")}</label><h3>{form.contact_name || form.phone}</h3><p>{form.phone}</p><blockquote>{form.body || form.template_name || t("Attachment message")}</blockquote>{(file || form.attachment_name) && <p><Paperclip size={16} /> {file?.name || form.attachment_name}</p>}<p>{fmt(DateTime.fromISO(form.local_time, {
              zone: form.timezone
            }).toUTC().toISO(), form.timezone)} · {form.timezone}</p><p>{t("Repeats: ")}{t(form.repeat)}{form.end_date ? ` · ${t("Until")} ${form.end_date}` : ''}</p><p className="muted">{form.transport === 'web' ? t("Your WhatsApp bridge must be connected and live sending enabled at the scheduled time.") : t("Free-form messages are checked against the recipient’s reply window at sending time. Scheduling does not guarantee WhatsApp acceptance.")}</p><div className="modal-foot"><button onClick={() => setReview(false)}>{t("Back to editing")}</button><button className="primary" disabled={busy} onClick={() => run(save)}>{busy ? t("Saving…") : t("Confirm schedule")}<Check size={16} /></button></div></div> : <form onSubmit={e => {
          e.preventDefault();
          run(async () => {
            validate({
              ...form,
              attachment_path: file ? 'pending' : form.attachment_path
            });
            setReview(true);
          });
        }}>
 <div className="form-grid"><label>{t("Contact")}<select value="" onChange={e => {
                const c = contacts.find(c => c.id === e.target.value);
                if (c) setForm({
                  ...form,
                  phone: c.phone,
                  contact_name: c.name,
                  consent: c.consent
                });
              }}><option value="">{t("Choose a saved contact")}</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label><label>{t("Or enter a number")}<input dir="ltr" required placeholder="+972501234567" value={form.phone} onChange={e => change('phone', e.target.value)} /></label></div>
 <label className="check"><input type="checkbox" checked={form.consent} onChange={e => change('consent', e.target.checked)} />{t("I have this recipient’s permission to send WhatsApp messages.")}</label><label>{t("Sending connection")}<select value={form.transport || 'cloud'} onChange={e => setForm({
              ...form,
              transport: e.target.value,
              mode: 'text'
            })}><option value="web">{t("Personal WhatsApp · QR connection")}</option><option value="cloud">{t("WhatsApp Business · Cloud API")}</option></select></label><label>{t("Message type")}<select value={form.mode} onChange={e => change('mode', e.target.value)}><option value="text">{form.transport === 'web' ? t("Text / files") : t("Text / files · requires a 24-hour reply window")}</option>{form.transport !== 'web' && <option value="template">{t("Approved WhatsApp template")}</option>}</select></label>
 {form.mode === 'template' ? <><div className="form-grid"><label>{t("Approved template name")}<input required value={form.template_name} onChange={e => change('template_name', e.target.value)} /></label><label>{t("Template language")}<input required value={form.language} onChange={e => change('language', e.target.value)} /></label></div><label>{t("Body variables (one per line, in order)")}<textarea dir="auto" value={form.parameters.join('\n')} onChange={e => change('parameters', e.target.value.split('\n'))} /></label><p className="hint">{t("An attached file becomes the template media header. It must match the approved template. Button variables are not supported.")}</p></> : <label>{t("Your message")}<textarea dir="auto" placeholder={t("What would you like to say?")} maxLength={4096} rows={4} value={form.body} onChange={e => change('body', e.target.value)} /></label>}
 <label className="upload"><Paperclip size={18} /><span>{file?.name || form.attachment_name || t("Add a file (optional)")}<small>{t("JPG, PNG, PDF, MP4, MP3 · up to 16 MB")}</small></span><input type="file" accept="image/jpeg,image/png,application/pdf,video/mp4,audio/mpeg" onChange={e => {
              const f = e.target.files[0];
              if (f && f.size > 16 * 1024 * 1024) {
                setError('Choose a file smaller than 16 MB.');
                return;
              }
              if (f && f.type.startsWith('image/') && f.size > 5 * 1024 * 1024) {
                setError('Images must be smaller than 5 MB.');
                return;
              }
              setFile(f);
              setError('');
            }} /></label>{(file || form.attachment_path) && <div className="file-preview">{file?.type.startsWith('image/') && <Preview file={file} t={t} />}<button type="button" onClick={() => {
              setFile(null);
              change('attachment_path', null);
              change('attachment_name', null);
            }}>{t("Remove attachment")}</button>{form.attachment_path && <button type="button" onClick={() => run(async () => {
              const r = await db.storage.from('autowhatsapp').createSignedUrl(form.attachment_path, 60);
              if (r.error) throw r.error;
              window.open(r.data.signedUrl, '_blank', 'noopener');
            })}>{t("Preview saved file")}</button>}</div>}
 <div className="form-grid"><label>{t("Date & time")}<input required type="datetime-local" value={form.local_time} onChange={e => change('local_time', e.target.value)} /></label><label>{t("Timezone")}<select value={form.timezone} onChange={e => change('timezone', e.target.value)}>{[...new Set(['Asia/Jerusalem', Intl.DateTimeFormat().resolvedOptions().timeZone, ...Intl.supportedValuesOf('timeZone')])].map(z => <option key={z}>{z}</option>)}</select></label><label>{t("Repeat")}<select value={form.repeat} onChange={e => change('repeat', e.target.value)}><option value="once">{t("One time")}</option><option value="daily">{t("Every day")}</option><option value="weekly">{t("Every week")}</option><option value="weekdays">{t("Selected weekdays")}</option><option value="interval">{t("Custom interval")}</option></select></label>{form.repeat === 'interval' ? <label>{t("Every (minutes)")}<input type="number" min="15" required value={form.interval_minutes} onChange={e => change('interval_minutes', Number(e.target.value))} /></label> : <label>{t("End date (optional)")}<input type="date" value={form.end_date || ''} onChange={e => change('end_date', e.target.value)} /></label>}</div>
 {form.repeat === 'interval' && <label>{t("End date (optional)")}<input type="date" value={form.end_date || ''} onChange={e => change('end_date', e.target.value)} /></label>}
 {form.repeat === 'weekdays' && <div className="weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => <label key={d}><input type="checkbox" checked={form.weekdays.includes(i + 1)} onChange={e => change('weekdays', e.target.checked ? [...form.weekdays, i + 1] : form.weekdays.filter(n => n !== i + 1))} />{t(d)}</label>)}</div>}<div className="modal-foot"><span><Clock size={14} />{t(" Sent by the server, even when you’re away.")}</span><button className="primary" disabled={busy}>{t("Review schedule ")}<ArrowUpRight size={16} /></button></div></form>}</section></div>}
 </div>;
}
function Preview({file,t}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return <img src={url} alt={t("Attachment preview")} />;
}
createRoot(document.getElementById('root')).render(<App />);
