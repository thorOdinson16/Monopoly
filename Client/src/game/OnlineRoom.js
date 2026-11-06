import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Page from '../Page';
import LocalGame from './LocalGame';
import ConfirmDialog from './ConfirmDialog';
import './LocalGame.css';

const stored = () => { try { return JSON.parse(localStorage.getItem('monopoly-room')); } catch { return null; } };
async function request(path, token, body) {
  const response = await fetch(`/api/rooms${path}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Unable to reach the room.');
  return data;
}
export default function OnlineRoom({user}) {
  const [params] = useSearchParams();
  const inviteCode = (params.get('code') || '').trim().toUpperCase();
  const [credentials, setCredentials] = useState(() => { const saved=stored(); return inviteCode && saved?.code !== inviteCode ? null : saved; });
  const [room, setRoom] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(inviteCode);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(()=>{if(user?.name)setName(old=>old||user.name);},[user?.name]);
  useEffect(() => {
    if (!inviteCode) return;
    const saved=stored();
    if (saved?.code !== inviteCode) { setCredentials(null); setRoom(null); setCode(inviteCode); setError(''); setNotice(''); }
  }, [inviteCode]);
  useEffect(() => {
    if (!credentials) return undefined;
    let active = true, first = true;
    const poll = async () => { try { const data = await request(`/${credentials.code}`, credentials.token); if (active) { if (first && data.game?.winner !== null && data.game?.winner !== undefined) { localStorage.removeItem('monopoly-room'); setCredentials(null); setRoom(null); setCode(''); setNotice('Your previous game has finished. Create a new room or join another game.'); return; } first = false; setRoom(old => old && old.code === data.code && old.revision > data.revision ? old : data); setError(''); } } catch (err) { if (active) setError(err.message); } };
    poll(); const timer = setInterval(poll, 1500);
    return () => { active = false; clearInterval(timer); };
  }, [credentials]);
  async function enter(create) {
    try {
      const result = await request(create ? '' : `/${code.trim().toUpperCase()}/join`, null, { name });
      const next = { code: result.code, token: result.token };
      localStorage.setItem('monopoly-room', JSON.stringify(next)); setCredentials(next); setRoom(result); setError('');
    } catch (err) { setError(err.message); }
  }
  async function rejoin(roomCode=code) {
    try {const result=await request(`/${roomCode.trim().toUpperCase()}/rejoin`,null,{});const next={code:result.code,token:result.token};localStorage.setItem('monopoly-room',JSON.stringify(next));setCredentials(next);setRoom(result);setError('');}catch(err){setError(err.message);}
  }
  async function linkSeat() {const result=await request(`/${credentials.code}/link`,credentials.token,{});setRoom(result);setNotice('This seat is linked to your account.');}
  async function send(type, payload) {
    const result = await request(`/${credentials.code}/action`, credentials.token, { type, payload, revision: room.revision });
    setRoom(old => old && old.revision > result.revision ? old : result); return result;
  }
  function newRoom() { localStorage.removeItem('monopoly-room'); setCredentials(null); setRoom(null); setCode(''); setError(''); }
  if (room?.abandoned || room?.game?.abandoned) return <Page eyebrow="GAME ENDED" title="The host ended this game" subtitle="This game has ended for everyone in the room."><button className="site-button" onClick={newRoom}>Create or join another game</button><p><Link to="/home">Back home</Link></p></Page>;
  if (room?.game) return <LocalGame online={{ room, send, newRoom, user, linkSeat }} />;
  return <Page eyebrow="PLAY TOGETHER" title="Online game" subtitle="Create a room or join one using its code. Each player joins from their own device.">
    {error && <p role="alert" className="site-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!credentials ? <div className="site-form"><label htmlFor="online-name">Your name</label><input id="online-name" value={name} maxLength="30" onChange={event => setName(event.target.value)} /><button className="site-button" onClick={() => enter(true)}>Create room</button><label htmlFor="room-code">Room code</label><input id="room-code" value={code} onChange={event => setCode(event.target.value)} /><button className="site-button secondary" onClick={() => enter(false)}>Join room</button>{user && <button className="site-button secondary" onClick={()=>rejoin()}>Rejoin with account</button>}</div> : <>{room && <><p>Room code: <strong>{room.code}</strong></p><p>Share this code or link: <input readOnly aria-label="Room link" value={`${window.location.origin}/online?code=${room.code}`} onFocus={event => event.target.select()} /></p><h2>Players</h2><ul>{room.players.map((player, index) => <li key={index}>{player.name}{index === 0 ? ' (host)' : ''}{index === room.seat ? ' (you)' : ''}{!player.approved && ' — awaiting approval'}{room.seat === 0 && index > 0 && <span> {!player.approved && <button onClick={async () => { try { setRoom(await request(`/${room.code}/decide`, credentials.token, { seat: index, approve: true })); } catch (err) { setError(err.message); } }}>Approve</button>} <button onClick={async () => { try { setRoom(await request(`/${room.code}/decide`, credentials.token, { seat: index, approve: false })); } catch (err) { setError(err.message); } }}>Remove</button></span>}</li>)}</ul>{room.seat === 0 ? <button className="site-button" disabled={room.players.length < 2 || room.players.some(player => !player.approved)} onClick={async () => { try { setRoom(await request(`/${room.code}/start`, credentials.token, {})); } catch (err) { setError(err.message); } }}>Start game</button> : <p>{room.players[room.seat].approved ? 'Waiting for the host to start.' : 'Waiting for the host to approve you.'}</p>}{user && <p><button className="site-button secondary" onClick={()=>linkSeat().catch(err=>setError(err.message))}>Link this seat to my account</button></p>}</>}<button className="site-button secondary" onClick={() => { localStorage.removeItem('monopoly-room'); setCredentials(null); setRoom(null); }}>Forget this room on this device</button></>}
    {credentials && !room && error && user && <p><button className="site-button secondary" onClick={()=>rejoin(credentials.code)}>Rejoin linked seat</button></p>}
    {room && room.seat===0 && <p><button className="site-button secondary" onClick={()=>setConfirmEnd(true)}>End room for everyone</button></p>}
    {confirmEnd && <ConfirmDialog title="End room for everyone?" message="This room will close for everyone, and no game will start." confirmLabel="End room" onCancel={()=>setConfirmEnd(false)} onConfirm={async()=>{setConfirmEnd(false);try{await send('abandon');}catch(err){setError(err.message);}}}/>}
    <p><Link to="/home">Back home</Link></p>
  </Page>;
}
