import React,{useEffect,useState,useRef} from 'react';import ReactMarkdown from 'react-markdown';import remarkGfm from 'remark-gfm';import {MessageSquarePlus,FileUp,LogOut,Send,Trash2,FileText,Menu,Sun,Moon,Sparkles,BookOpen,MessageCircle,Copy} from 'lucide-react';import {api,errorMessage,streamChat} from './api';
export default function App(){const [user,setUser]=useState(null),[token,setToken]=useState(localStorage.getItem('contextai_token')),[authMode,setAuthMode]=useState('login'),[form,setForm]=useState({name:'',email:'',password:''}),[convos,setConvos]=useState([]),[docs,setDocs]=useState([]),[active,setActive]=useState(null),[messages,setMessages]=useState([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState('general'),[selectedDoc,setSelectedDoc]=useState(''),[mobile,setMobile]=useState(false),[dark,setDark]=useState(localStorage.getItem('contextai_dark')!=='false');
const [settingsOpen, setSettingsOpen] = useState(false);
const [settingsTab, setSettingsTab] = useState('profile');


const [profileName, setProfileName] = useState('');
const [profileSaving, setProfileSaving] = useState(false);
const [emailChangeOpen, setEmailChangeOpen] = useState(false);

const [emailChangeLoading, setEmailChangeLoading] = useState(false);
const [emailVerificationToken, setEmailVerificationToken] = useState('');
const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
const [emailVerifying, setEmailVerifying] = useState(false);
const [newEmail, setNewEmail] = useState('');
const [emailChangePassword, setEmailChangePassword] = useState('');
const [emailChangeMessage, setEmailChangeMessage] = useState('');
const [profileMessage, setProfileMessage] = useState('');

// Automatically load the saved user's full name
useEffect(() => {
  if (user?.name) {
    setProfileName(user.name);
  }
}, [user?.name]);


const bottom = useRef(null), fileRef = useRef(null);
useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('contextai_dark',String(dark));},[dark]);useEffect(()=>{if(!token)return;api.get('/auth/me').then(r=>{setUser(r.data.user);refresh();}).catch(()=>logout());},[token]);useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages]);
function logout(){localStorage.removeItem('contextai_token');setToken(null);setUser(null);setActive(null);setMessages([]);}
async function refresh(){try{const [a,b]=await Promise.all([api.get('/conversations'),api.get('/documents')]);setConvos(a.data);setDocs(b.data);}catch(e){setError(errorMessage(e));}}
async function authenticate(e){e.preventDefault();setError('');try{const r=await api.post('/auth/'+authMode,form);localStorage.setItem('contextai_token',r.data.token);setToken(r.data.token);setUser(r.data.user);}catch(e){setError(errorMessage(e));}}
async function choose(c){setError('');setActive(c);setMode(c.mode);setSelectedDoc(c.documentId||'');setMobile(false);try{const r=await api.get(`/conversations/${c._id}/messages`);setMessages(r.data);}catch(e){setError(errorMessage(e));}}
function newChat(){setActive(null);setMessages([]);setMode('general');setSelectedDoc('');setError('');setMobile(false);}
async function deleteChat(id){if(!window.confirm('Delete this conversation?'))return;try{await api.delete('/conversations/'+id);if(active?._id===id)newChat();refresh();}catch(e){setError(errorMessage(e));}}
async function deleteDoc(id){if(!window.confirm('Delete this document and its search index?'))return;try{await api.delete('/documents/'+id);if(selectedDoc===id)setSelectedDoc('');refresh();}catch(e){setError(errorMessage(e));}}
async function upload(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const body=new FormData();body.append('file',file);const r=await api.post('/documents',body);await refresh();setMode('document');setSelectedDoc(r.data._id);setActive(null);setMessages([]);}catch(err){setError(errorMessage(err));}finally{setBusy(false);e.target.value='';}}
async function send(e){e.preventDefault();const text=input.trim();if(!text||busy)return;if(!active&&mode==='document'&&!selectedDoc){setError('Upload or select a document first');return;}setBusy(true);setError('');setInput('');const own={_id:'temp-u-'+Date.now(),role:'user',content:text},ai={_id:'temp-a-'+Date.now(),role:'assistant',content:'',citations:[]};setMessages(old=>[...old,own,ai]);let c=active;try{if(!c){const r=await api.post('/conversations',{mode,documentId:mode==='document'?selectedDoc:undefined});c=r.data;setActive(c);}await streamChat(c._id,text,part=>setMessages(old=>old.map(m=>m._id===ai._id?{...m,content:m.content+part}:m)),citations=>setMessages(old=>old.map(m=>m._id===ai._id?{...m,citations}:m)));await refresh();}catch(err){setError(err.message);setMessages(old=>old.map(m=>m._id===ai._id?{...m,content:m.content||'Unable to generate a response.'}:m));}finally{setBusy(false);}}



const openBillingPortal = async () => {
  try {
    const response = await api.post('/billing/portal');

    if (!response.data?.url) {
      throw new Error('Stripe did not return a billing portal URL');
    }

    window.location.assign(response.data.url);
  } catch (error) {
    alert(errorMessage(error));
  }
};


const startProCheckout = async () => {
  try {
    const response = await api.post('/billing/checkout');

    if (!response.data?.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    window.location.assign(response.data.url);
  } catch (error) {
    alert(errorMessage(error));
  }
};

// Save profile changes to MongoDB
const saveProfile = async () => {
  const name = profileName.trim();

  if (name.length < 2 || name.length > 70) {
    setProfileMessage('Name must be between 2 and 70 characters.');
    return;
  }

  try {
    setProfileSaving(true);
    setProfileMessage('');

    const response = await api.patch('/auth/profile', {
      name
    });

    setUser(response.data.user);
    setProfileName(response.data.user.name);
    setProfileMessage('Profile updated successfully.');
  } catch (error) {
    setProfileMessage(errorMessage(error));
  } finally {
    setProfileSaving(false);
  }
};


const requestEmailChange = async () => {
  if (!newEmail.trim() || !emailChangePassword) {
    setEmailChangeMessage('Enter your new email and current password.');
    return;
  }

  setEmailChangeLoading(true);
  setEmailChangeMessage('');

  try {
    const response = await api.post('/auth/email-change/request', {
      newEmail: newEmail.trim(),
      password: emailChangePassword
    });

    setEmailChangeMessage(response.data.message);
    setEmailChangePassword('');
  } catch (error) {
    setEmailChangeMessage(errorMessage(error));
  } finally {
    setEmailChangeLoading(false);
  }
};

const confirmEmailChange = async () => {
  const token = emailVerificationToken.trim();

  if (!token) {
    setEmailVerificationMessage('Enter your verification token.');
    return;
  }

  setEmailVerifying(true);
  setEmailVerificationMessage('');

  try {
    const response = await api.post('/auth/email-change/confirm', {
      token
    });

    setUser(response.data.user);
    setEmailVerificationMessage(response.data.message);
    setEmailChangeMessage(response.data.message);
    setEmailChangeOpen(false);
    setNewEmail('');
    setEmailVerificationToken('');
  } catch (error) {
    setEmailVerificationMessage(errorMessage(error));
  } finally {
    setEmailVerifying(false);
  }
};


if (user && settingsOpen) {
  const sections = [
    { id: 'profile', title: 'Profile', icon: '👤' },
    { id: 'subscription', title: 'Subscription', icon: '✦' },
    { id: 'payments', title: 'Payments & Billing', icon: '💳' },
    { id: 'personalization', title: 'Personalization', icon: '⚙️' },
    { id: 'models', title: 'AI Models', icon: '✨' },
    { id: 'privacy', title: 'Privacy & Data', icon: '🔒' }
  ];

  const isPro =
    user.plan === 'pro' &&
    ['active', 'trialing'].includes(user.subscriptionStatus);

  return (
    <div className="shell">
      <aside className="sidebar" style={{ padding: 20 }}>
        <div className="brand">
          <span className="logo"><Sparkles size={19}/></span>
          <strong>ContextAI</strong>
        </div>

        <button
          className="newChat"
          onClick={() => setSettingsOpen(false)}
        >
          ← Back to Chat
        </button>

        <div className="sidebarHeading">ACCOUNT SETTINGS</div>

        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setSettingsTab(section.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '12px',
              marginBottom: 6,
              borderRadius: 10,
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              background:
                settingsTab === section.id
                  ? 'rgba(99,102,241,0.18)'
                  : 'transparent',
              color: 'inherit'
            }}
          >
            <span>{section.icon}</span>
            {section.title}
          </button>
        ))}
      </aside>

      <main className="main" style={{ overflowY: 'auto' }}>
        <div style={{ padding: '32px', maxWidth: 850, width: '100%', margin: '0 auto' }}>
          <h1>Account Settings</h1>
          <p style={{ opacity: 0.7, marginBottom: 30 }}>
            Manage your ContextAI account and preferences.
          </p>

          
{settingsTab === 'profile' && (
  <section>
    <h2>Profile</h2>

    <div style={{ marginBottom: 20 }}>
      <label
        htmlFor="profile-name"
        style={{ display: 'block', marginBottom: 8 }}
      >
        Full Name
      </label>

      <input
        id="profile-name"
        type="text"
        value={profileName}
        onChange={(e) => {
          setProfileName(e.target.value);
          setProfileMessage('');
        }}
        placeholder={user.name}
        maxLength={70}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #888',
          background: 'transparent',
          color: 'inherit'
        }}
      />
    </div>

    <div style={{ marginBottom: 20 }}>
      <label
        htmlFor="profile-email"
        style={{ display: 'block', marginBottom: 8 }}
      >
        Email Address
      </label>

      <input
        id="profile-email"
        type="email"
        value={user.email}
        disabled
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #888',
          background: 'transparent',
          color: 'inherit',
          opacity: 0.65
        }}
      />

      
<p style={{ fontSize: 13, opacity: 0.7 }}>
  Your current email address is used for login.
</p>

<button
  type="button"
  onClick={() => setEmailChangeOpen(true)}
  style={{
    marginTop: 8,
    padding: '10px 16px',
    borderRadius: 8,
    cursor: 'pointer'
  }}
>
  Change Email
</button>

  
{emailChangeOpen && (
  <div style={{
    marginTop: 16,
    padding: 16,
    border: '1px solid #888',
    borderRadius: 10
  }}>
    <h3>Change Email Address</h3>

    <label htmlFor="new-email">New Email Address</label>
    <input
      id="new-email"
      type="email"
      value={newEmail}
      onChange={e => setNewEmail(e.target.value)}
      placeholder="Enter your new email"
      autoComplete="email"
      style={{
        display: 'block',
        width: '100%',
        padding: 12,
        marginTop: 8,
        marginBottom: 14,
        borderRadius: 8
      }}
    />

    <label htmlFor="email-change-password">
      Current Password
    </label>
    <input
      id="email-change-password"
      type="password"
      value={emailChangePassword}
      onChange={e => setEmailChangePassword(e.target.value)}
      placeholder="Enter your current password"
      autoComplete="current-password"
      style={{
        display: 'block',
        width: '100%',
        padding: 12,
        marginTop: 8,
        marginBottom: 14,
        borderRadius: 8
      }}
    />

    

<button
  type="button"
  onClick={requestEmailChange}
  disabled={emailChangeLoading}
>
  {emailChangeLoading ? 'Sending...' : 'Send Verification Email'}
</button>

{emailChangeMessage && (
  <p role="status" style={{ marginTop: 12 }}>
    {emailChangeMessage}
  </p>
)}

<div style={{ marginTop: 20 }}>
  <h4>Verify New Email Address</h4>

  <label htmlFor="email-verification-token">
    Verification Code
  </label>

  <input
    id="email-verification-token"
    type="text"
    value={emailVerificationToken}
    onChange={(e) => setEmailVerificationToken(e.target.value)}
    placeholder="Paste verification token"
    style={{
      display: 'block',
      width: '100%',
      padding: 10,
      marginTop: 8,
      marginBottom: 12
    }}
  />

  <button
    type="button"
    onClick={confirmEmailChange}
    disabled={emailVerifying}
  >
    {emailVerifying ? 'Verifying...' : 'Verify and Change Email'}
  </button>

  {emailVerificationMessage && (
    <p role="status" style={{ marginTop: 12 }}>
      {emailVerificationMessage}
    </p>
  )}
</div>
  </div>
)}



    </div>

    <p>
      Account plan: <strong>{isPro ? 'Pro' : 'Free'}</strong>
    </p>

    <button
      type="button"
      onClick={saveProfile}
      disabled={profileSaving}
      style={{
        marginTop: 12,
        padding: '12px 20px',
        borderRadius: 8,
        cursor: profileSaving ? 'wait' : 'pointer'
      }}
    >
      {profileSaving ? 'Saving...' : 'Save Changes'}
    </button>

    {profileMessage && (
      <p role="status" style={{ marginTop: 14 }}>
        {profileMessage}
      </p>
    )}
  </section>
)}


          
{settingsTab === 'subscription' && (
  <section>
    <h2>Subscription</h2>

    <div style={{
      padding: 24,
      border: '1px solid rgba(148,163,184,0.3)',
      borderRadius: 14,
      marginTop: 20
    }}>
      <h3>{isPro ? '✦ ContextAI Pro' : 'ContextAI Free'}</h3>

      <h2>{isPro ? '$9.99/month' : '$0/month'}</h2>

      <p>
        Status: <strong>{user.subscriptionStatus || 'inactive'}</strong>
      </p>

      {user.subscriptionCurrentPeriodEnd && (
        <p>
          {user.subscriptionCancelAtPeriodEnd
            ? 'Subscription access ends: '
            : 'Current billing period ends: '}
          <strong>
            {new Date(
              user.subscriptionCurrentPeriodEnd
            ).toLocaleDateString()}
          </strong>
        </p>
      )}

      {user.subscriptionCancelAtPeriodEnd && (
        <p style={{ color: '#f59e0b' }}>
          Cancellation is scheduled for the end of your billing period.
        </p>
      )}

      {isPro ? (
        <button onClick={openBillingPortal}>
          Manage Subscription
        </button>
      ) : (
        <button onClick={startProCheckout}>
          Upgrade to Pro — $9.99/month
        </button>
      )}
    </div>

    <h3 style={{ marginTop: 30 }}>Compare Plans</h3>

    <table style={{ width: '100%', marginTop: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Feature</th>
          <th>Free</th>
          <th>Pro</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>AI Chat</td>
          <td>Available</td>
          <td>Available</td>
        </tr>
        <tr>
          <td>Document RAG</td>
          <td>Available</td>
          <td>Available</td>
        </tr>
        <tr>
          <td>Message limits</td>
          <td>Not configured</td>
          <td>Not configured</td>
        </tr>
        <tr>
          <td>Document limits</td>
          <td>Not configured</td>
          <td>Not configured</td>
        </tr>
      </tbody>
    </table>

    <p style={{ opacity: 0.7, marginTop: 12 }}>
      Plan-specific usage limits will be added later.
    </p>
  </section>
)}


          
{settingsTab === 'payments' && (
  <section>
    <h2>Payments & Billing</h2>

    <p>
      Manage payment methods, invoices, billing information,
      and subscription settings securely through Stripe.
    </p>

    {isPro ? (
      <button
        onClick={openBillingPortal}
        style={{
          padding: '12px 20px',
          marginTop: 16,
          cursor: 'pointer'
        }}
      >
        Open Stripe Billing Portal
      </button>
    ) : (
      <p>
        No active Pro subscription.
        You can upgrade from the Subscription section.
      </p>
    )}

    <p style={{ opacity: 0.7, marginTop: 16 }}>
      Payment card information is handled securely by Stripe.
    </p>
  </section>
)}


          {settingsTab === 'personalization' && (
            <section>
              <h2>Personalization</h2>
              <p>Appearance</p>
              <button onClick={() => setDark(!dark)}>
                {dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </button>
              <p style={{ opacity: 0.7 }}>
                Language, response style and custom instructions are coming later.
              </p>
            </section>
          )}

          {settingsTab === 'models' && (
            <section>
              <h2>AI Models</h2>
              <p>Current provider: Gemini</p>
              <p style={{ opacity: 0.7 }}>
                Model selection will be available after backend configuration.
              </p>
            </section>
          )}

          {settingsTab === 'privacy' && (
            <section>
              <h2>Privacy & Data</h2>
              <p>Manage your conversations, uploaded documents and account data.</p>
              <p style={{ opacity: 0.7 }}>
                Data export and account deletion controls are coming later.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
if(!user)return <div className="authPage"><div className="authBrand"><div className="logo"><Sparkles size={24}/></div><h1>ContextAI</h1><p>Your intelligent workspace for conversations and documents.</p></div><form className="authCard" onSubmit={authenticate}><h2>{authMode==='login'?'Welcome back':'Create your account'}</h2><p>Start exploring smarter conversations.</p>{authMode==='register'&&<label>Name<input required minLength="2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label>}<label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input required type="password" minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>{error&&<div className="error">{error}</div>}<button className="primary" type="submit">{authMode==='login'?'Sign in':'Create account'}</button><p className="authSwitch">{authMode==='login'?'New here?':'Already registered?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('');}}>{authMode==='login'?'Create an account':'Sign in'}</button></p></form></div>;
return <div className="shell"><aside className={'sidebar '+(mobile?'show':'')}><div className="brand"><span className="logo"><Sparkles size={19}/></span><strong>ContextAI</strong><button className="iconBtn mobileOnly" onClick={()=>setMobile(false)}>✕</button></div><button className="newChat" onClick={newChat}><MessageSquarePlus size={18}/> New conversation</button><div className="sidebarHeading">YOUR CHATS</div><div className="conversations">{convos.map(c=><div className={'conversation '+(active?._id===c._id?'active':'')} key={c._id}><button onClick={()=>choose(c)}><MessageCircle size={16}/><span>{c.title}</span></button><button className="delete" title="Delete chat" onClick={()=>deleteChat(c._id)}><Trash2 size={15}/></button></div>)}</div><div className="sidebarHeading">DOCUMENTS</div><div className="docs">{docs.map(d=><div className="doc" key={d._id}><FileText size={15}/><span title={d.filename}>{d.filename}</span><button title="Delete document" onClick={()=>deleteDoc(d._id)}><Trash2 size={14}/></button></div>)}</div><div className="sidebarBottom"><button onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>} {dark?'Light mode':'Dark mode'}</button><div
  className="profile"
  role="button"
  tabIndex={0}
  title="Account settings"
  style={{ cursor: 'pointer' }}
  onClick={() => setSettingsOpen(true)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSettingsOpen(true);
    }
  }}
><div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
<span>
  {user.name}

  <small>{user.email}</small>

  <small
    style={{
      color:
        user.plan === 'pro' &&
        ['active', 'trialing'].includes(user.subscriptionStatus)
          ? '#22c55e'
          : '#94a3b8',
      fontWeight: 700,
      marginTop: '5px',
      display: 'block'
    }}
  >
    {user.plan === 'pro' &&
    ['active', 'trialing'].includes(user.subscriptionStatus)
      ? '✦ ContextAI Pro — Active'
      : 'ContextAI Free'}
  </small>
</span>
<button title="Sign out" onClick={logout}><LogOut size={18}/></button></div></div></aside><main className="main"><header><button className="iconBtn mobileOnly" onClick={()=>setMobile(true)}><Menu/></button><div><strong>{active?.title||'New conversation'}</strong><small>AI workspace · Powered by Gemini</small></div><button className="themeBtn" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button></header><div className="chatArea">{messages.length===0?<div className="welcome"><div className="heroIcon"><Sparkles size={30}/></div><h1>How can I help you today?</h1><p>Ask anything, or upload a document and explore it with AI.</p><div className="suggestions"><button onClick={()=>setInput('Explain retrieval-augmented generation in simple terms.')}>Explain RAG in simple terms</button><button onClick={()=>setInput('Help me plan a software engineering project.')}>Plan a software project</button><button onClick={()=>fileRef.current?.click()}>Analyze a PDF document</button></div></div>:<div className="messageList">{messages.map(m=><article className={'message '+m.role} key={m._id}><div className="messageAvatar">{m.role==='assistant'?<Sparkles size={17}/>:user.name?.[0]?.toUpperCase()}</div><div className="messageBody"><div className="messageRole">{m.role==='assistant'?'ContextAI':'You'}</div><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content||(busy?'Thinking…':'')}</ReactMarkdown></div>{m.citations?.length>0&&<div className="citations"><strong>Retrieved sources</strong>{m.citations.map((c,i)=><span key={i}>[{c.source||i+1}] {c.filename}{c.page?' · p. '+c.page:''}</span>)}</div>}{m.role==='assistant'&&m.content&&<button className="copyBtn" onClick={()=>navigator.clipboard.writeText(m.content)}><Copy size={13}/> Copy</button>}</div></article>)}<div ref={bottom}/></div>}</div><div className="composerWrap">{error&&<div className="error">{error}<button onClick={()=>setError('')}>✕</button></div>}<div className="options"><div className="modeTabs"><button disabled={!!active} className={mode==='general'?'selected':''} onClick={()=>setMode('general')}><MessageCircle size={15}/> General chat</button><button disabled={!!active} className={mode==='document'?'selected':''} onClick={()=>setMode('document')}><BookOpen size={15}/> Document Q&A</button></div>{mode==='document'&&<select disabled={!!active} value={selectedDoc} onChange={e=>setSelectedDoc(e.target.value)}><option value="">Select a document</option>{docs.map(d=><option value={d._id} key={d._id}>{d.filename}</option>)}</select>}</div><form className="composer" onSubmit={send}><button type="button" title="Upload PDF or TXT" disabled={busy} onClick={()=>fileRef.current?.click()}><FileUp size={21}/></button><input ref={fileRef} hidden type="file" accept=".pdf,.txt" onChange={upload}/><textarea rows="2" placeholder={busy?'Please wait…':'Message ContextAI…'} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e);}}}/><button className="sendBtn" type="submit" disabled={busy||!input.trim()}><Send size={18}/></button></form><div className="disclaimer">AI can make mistakes. Verify important information and document citations.</div></div></main>{mobile&&<div className="backdrop" onClick={()=>setMobile(false)}/>}</div>}
