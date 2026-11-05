import React from 'react';
import { Link } from 'react-router-dom';
import Page from './Page';
import { readResults, standings } from './data/localResults';

export default function Leaderboard() {
  const results=readResults(), players=standings(results);
  return <Page eyebrow="LOCAL RESULTS" title="Leaderboard" subtitle="Wins and games played on this browser, grouped by player name.">
    {players.length ? <div className="site-table-wrap"><table className="site-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Played</th><th scope="col">Wins</th></tr></thead><tbody>{players.map((player,i)=><tr key={player.name.toLocaleLowerCase()}><td>{i+1}</td><td>{player.name}</td><td>{player.played}</td><td>{player.wins}</td></tr>)}</tbody></table></div> : <div className="site-empty"><p>No completed games yet.</p><p>Finish a local game to see its players and winner here.</p></div>}
    <p className="site-muted">Results are recorded from this update onward and are not synced across devices.</p>
    <div className="site-actions"><Link className="site-button" to="/game">Play a game</Link><Link className="site-button secondary" to="/profile">Local profile</Link></div>
  </Page>;
}
