import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Page from './Page';
import { readCurrentGame, readResults, standings } from './data/localResults';

export default function Profile({user,onSignOut,localOnly}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const results=readResults(), game=readCurrentGame(), players=standings(results);
  return <Page eyebrow="ON THIS DEVICE" title="Local profile" subtitle="Your local game and completed results, stored in this browser.">
    <div className="site-stats"><div className="site-stat"><strong>{results.length}</strong><span>Games finished</span></div><div className="site-stat"><strong>{players.length}</strong><span>Players recorded</span></div><div className="site-stat"><strong>{game && game.winner===null?'In progress':'—'}</strong><span>Current game</span></div></div>
    <h2 className="site-section-title">Current game</h2>{game ? <div className="site-empty"><p>{game.winner!==null ? `Finished: ${game.players[game.winner]?.name || 'Player'} won.` : `${game.players.length} players · ${game.players[game.current]?.name || 'Player'}'s turn`}</p><p>{game.players.map(player=>player.name).join(' · ')}</p></div> : <div className="site-empty">No local game has been started yet.</div>}
    <p className="site-muted">Completed games are recorded from this update onward. Players are grouped by name; data stays in this browser.</p>
    {!localOnly && <><h2 className="site-section-title">Account</h2>{user ? <div className="site-empty"><p>Signed in as <strong>{user.name}</strong> ({user.email}).</p><p>Your account does not sync local games or results yet.</p><button className="site-button secondary" disabled={busy} onClick={async()=>{setError('');setBusy(true);try{await onSignOut();}catch(err){setError(err.message);}finally{setBusy(false);}}}>{busy?'Signing out…':'Sign out'}</button>{error && <p role="alert" className="site-error">{error}</p>}</div> : <div className="site-empty"><p>You’re playing as a guest. An account is optional for local play.</p><Link to="/login">Sign in</Link> or <Link to="/register">create an account</Link>.</div>}</>}
    <div className="site-actions"><Link className="site-button" to="/game">{game && game.winner===null?'Continue game':'Play'}</Link><Link className="site-button secondary" to="/leaderboard">View leaderboard</Link></div>
  </Page>;
}
