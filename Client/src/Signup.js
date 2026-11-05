import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from './Page';
import { accountRequest } from './data/accountApi';

export default function Signup({onAuthenticated}) {
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const navigate=useNavigate();
  async function submit(event){event.preventDefault();setError('');setBusy(true);try{const result=await accountRequest('/register',{method:'POST',body:JSON.stringify({name,email,password})});onAuthenticated(result.user);navigate('/home');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Page eyebrow="ACCOUNT" title="Create an account" subtitle="Your local games and results stay in this browser. Online play is not available yet."><form className="site-form" onSubmit={submit}><label htmlFor="signup-name">Name</label><input id="signup-name" required maxLength="80" autoComplete="name" value={name} onChange={event=>setName(event.target.value)}/><label htmlFor="signup-email">Email</label><input id="signup-email" type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/><label htmlFor="signup-password">Password</label><input id="signup-password" type="password" required minLength="8" maxLength="128" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/><span className="site-muted">Use at least 8 characters.</span>{error && <p className="site-error" role="alert">{error}</p>}<button className="site-button" type="submit" disabled={busy}>{busy?'Creating account…':'Create account'}</button></form><p className="site-muted">Already have an account? <Link to="/login">Sign in</Link> · <Link to="/game">Play locally</Link></p></Page>;
}
