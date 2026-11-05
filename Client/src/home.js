import React from 'react';
import { Link } from 'react-router-dom';
import { readCurrentGame } from './data/localResults';
import './site.css';
import './home.css';

function Home({user}) {
  const game=readCurrentGame();
  return <main className="home-shell"><div className="home-brand">MONOPOLY</div><span className="home-eyebrow">GAME NIGHT, SORTED</span><h1>Ready to play?</h1><p>Gather your players, roll the dice, and see who takes the board.</p>
    <Link className="home-play" to="/game">{game && game.winner===null?'Continue game':'Play'} <span aria-hidden="true">→</span></Link>
    <div className="home-links"><Link to="/profile"><strong>Local profile</strong><span>Your game on this device</span></Link><Link to="/leaderboard"><strong>Leaderboard</strong><span>Completed local games</span></Link><Link to="/rulebook"><strong>How to play</strong><span>Rules and house rules</span></Link></div>
    <p className="home-footnote">2–6 players · One device · Saved in this browser</p><p className="home-account">{user ? <>Signed in as {user.name} · <Link to="/profile">Account</Link></> : <><Link to="/login">Sign in</Link> or <Link to="/register">create an account</Link> · optional for local play</>}</p>
  </main>;
}
export default Home;
