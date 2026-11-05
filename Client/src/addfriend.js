import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Page from './Page';
import { readPlayers, savePlayers } from './data/localPlayers';

export default function AddFriend() {
  const [players,setPlayers]=useState(readPlayers),[name,setName]=useState(''),[error,setError]=useState('');
  function update(next){try{savePlayers(next);setPlayers(next);setError('');return true;}catch{setError('Could not save the player list in this browser.');return false;}}
  function add(event){event.preventDefault();const clean=name.trim();if(!clean){setError('Enter a player name.');return;}if(players.some(player=>player.toLocaleLowerCase()===clean.toLocaleLowerCase())){setError('That player is already saved.');return;}if(update([...players,clean]))setName('');}
  return <Page eyebrow="ON THIS DEVICE" title="Saved players" subtitle="Keep player names handy for local games. This list is private to this browser and does not send friend requests.">
    <form className="roster-form" onSubmit={add}><label htmlFor="player-name">Player name</label><div><input id="player-name" value={name} maxLength="30" onChange={event=>setName(event.target.value)} required/><button className="site-button" type="submit">Add player</button></div></form>{error && <p className="site-error" role="alert">{error}</p>}
    <h2 className="site-section-title">Your list</h2>{players.length ? <ul className="site-list roster-list">{players.map(player=><li key={player.toLocaleLowerCase()}><span>{player}</span><button className="site-button secondary" onClick={()=>update(players.filter(item=>item!==player))} aria-label={`Remove ${player}`}>Remove</button></li>)}</ul> : <div className="site-empty">No saved players yet.</div>}
    <p className="site-muted">Removing a name does not delete completed-game results. Online friend requests are not available yet.</p><div className="site-actions"><Link className="site-button" to="/game">Play a game</Link><Link className="site-button secondary" to="/leaderboard">Local leaderboard</Link></div>
  </Page>;
}
