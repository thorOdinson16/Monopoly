import React, {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import Page from './Page';
import {accountRequest} from './data/accountApi';

export default function ResetPassword() {
  const [params]=useSearchParams();
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  const token=params.get('token');
  async function submit(event){event.preventDefault();setBusy(true);setError('');try{await accountRequest('/reset-password',{method:'POST',body:JSON.stringify({token,password})});setDone(true);window.history.replaceState({},'',window.location.pathname);}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Page eyebrow="ACCOUNT" title="Reset password" subtitle="Reset links are issued by the game host and expire after 30 minutes.">{done?<p>Password changed. <Link to="/login">Sign in</Link> with your new password.</p>:!token?<p>Ask the host for a password reset link. The host should confirm your identity before sharing it privately.</p>:<form className="site-form" onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" type="password" minLength="8" maxLength="128" autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/>{error && <p role="alert" className="site-error">{error}</p>}<button className="site-button" disabled={busy}>{busy?'Updating…':'Reset password'}</button></form>}<p><Link to="/login">Back to sign in</Link></p></Page>;
}
