import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from './Page';
import { accountRequest } from './data/accountApi';

export default function Login({onAuthenticated}) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const navigate=useNavigate();
  async function submit(event){event.preventDefault();setError('');setBusy(true);try{const result=await accountRequest('/login',{method:'POST',body:JSON.stringify({email,password})});onAuthenticated(result.user);navigate('/home');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Page eyebrow="ACCOUNT" title="Welcome back" subtitle="Sign in to your account."><form className="site-form" onSubmit={submit}><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/>{error && <p className="site-error" role="alert">{error}</p>}<button className="site-button" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><p><Link to="/reset-password">Forgot password?</Link></p><p className="site-muted">New here? <Link to="/register">Create an account</Link> · <Link to="/game">Play locally</Link></p></Page>;
}
