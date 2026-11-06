import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { action, board, cards, createGame, normalizeGame } from './engine';
import { ensureMatchId, recordResult } from '../data/localResults';
import { readPlayers } from '../data/localPlayers';
import ConfirmDialog from './ConfirmDialog';
import './LocalGame.css';

const KEY = 'monopoly-local-game-v1';
const tokenColors = ['#1765d1', '#da3030', '#e5b615', '#238346', '#9a4bbb', '#e17e24'];
const shortBoardNames = {1:'Med. Avenue',3:'Baltic Ave.',5:'Reading R.R.',6:'Oriental Ave.',8:'Vermont Ave.',9:'Conn. Avenue',11:'St. Charles Pl.',13:'States Ave.',14:'Virginia Ave.',15:'Penn. R.R.',16:'St. James Pl.',18:'Tennessee Ave.',19:'New York Ave.',21:'Kentucky Ave.',23:'Indiana Ave.',24:'Illinois Ave.',25:'B&O Railroad',26:'Atlantic Ave.',27:'Ventnor Ave.',29:'Marvin Gardens',31:'Pacific Ave.',32:'N. Carolina Ave.',34:'Penn. Avenue',35:'Short Line R.R.',37:'Park Place'};
const pipLayouts = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function Die({value, rolling}) {
  return <div className="die-scene" aria-hidden="true"><div className={`die-cube die-show-${value} ${rolling ? 'die-rolling' : ''}`}>
    {[1,2,3,4,5,6].map(face => <div key={face} className={`die-side die-side-${face}`}>
      {Array.from({length:9},(_,i)=><span className={pipLayouts[face].includes(i) ? 'pip' : 'pip pip-empty'} key={i}/>) }
    </div>)}
  </div></div>;
}
function playDiceSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    const context = new AudioContextClass();
    if (context.state === 'suspended') context.resume().catch(() => {});
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .055), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    // Each impact combines a brief filtered click with a quiet, low table thud.
    [[0,.30],[.065,.225],[.14,.255],[.23,.186],[.34,.165],[.47,.135],[.59,.105],[.72,.075]].forEach(([offset, strength], i) => {
      const start = context.currentTime + offset;
      const click = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const clickVolume = context.createGain();
      click.buffer = noise;
      filter.type = 'bandpass';
      filter.frequency.value = 1500 + (i % 3) * 350;
      filter.Q.value = .7;
      clickVolume.gain.setValueAtTime(strength, start);
      clickVolume.gain.exponentialRampToValueAtTime(.0001, start + .035);
      click.connect(filter);
      filter.connect(clickVolume);
      clickVolume.connect(context.destination);
      click.start(start);
      click.stop(start + .04);

      const thud = context.createOscillator();
      const thudVolume = context.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(190 + (i % 2) * 35, start);
      thud.frequency.exponentialRampToValueAtTime(75, start + .045);
      thudVolume.gain.setValueAtTime(strength * .24, start);
      thudVolume.gain.exponentialRampToValueAtTime(.0001, start + .05);
      thud.connect(thudVolume);
      thudVolume.connect(context.destination);
      thud.start(start);
      thud.stop(start + .055);
    });
    return context;
  } catch { return null; }
}
function playPawnStep(audioRef) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioRef.current || new AudioContextClass();
    audioRef.current = context;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const start = context.currentTime;
    const tone = context.createOscillator(), volume = context.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(420, start);
    tone.frequency.exponentialRampToValueAtTime(220, start + .055);
    volume.gain.setValueAtTime(.16, start);
    volume.gain.exponentialRampToValueAtTime(.0001, start + .07);
    tone.connect(volume); volume.connect(context.destination);
    tone.start(start); tone.stop(start + .075);
  } catch { /* Sound is optional when audio is unavailable. */ }
}
function squarePosition(i) {
  if (i <= 10) return {row:11, col:11-i};
  if (i <= 20) return {row:21-i, col:1};
  if (i <= 30) return {row:1, col:i-19};
  return {row:i-29, col:11};
}
function Board({game, positions, dice, rolling, moving, onRoll, onEnd, onProperty}) {
  return <div className="board-scroll"><div className="visual-board" aria-label="Monopoly board">
    {board.map((space, i) => { const {row,col}=squarePosition(i); const owner=game.owners[i]; return <div key={i} className={`board-space ${i%10===0?'board-corner':''}`} style={{gridRow:row,gridColumn:col}} role="button" tabIndex={0} aria-label={`View ${space.name} details`} onClick={()=>onProperty(i)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onProperty(i);}}}>
      {space.group && <span className={`board-strip group-${space.group}`}/>}
      <span className="board-space-name">{shortBoardNames[i] ? <><span className="board-name-full">{space.name}</span><span className="board-name-short">{shortBoardNames[i]}</span></> : space.name}</span>{space.price && <span className="board-space-price">${space.price}</span>}
      {!!game.buildings?.[i] && <span className="board-building" title={game.buildings[i]===5?'Hotel':`${game.buildings[i]} house${game.buildings[i]===1?'':'s'}`}>{game.buildings[i]===5?'H':`⌂${game.buildings[i]}`}</span>}
      {owner !== undefined && <span className="board-owner" style={{background:tokenColors[owner]}} title={`Owned by ${game.players[owner].name}`}>{owner+1}</span>}
    </div>; })}
    <div className="board-center"><div className="board-brand">MONOPOLY</div><div className="board-dice" role="img" aria-label={rolling ? 'Rolling dice' : `Dice: ${dice.join(' and ')}`}>{dice.map((die,i)=><Die value={die} rolling={rolling} key={i}/>)}</div><div className="board-turn-buttons"><button className="board-roll" type="button" disabled={moving || game.phase !== 'roll'} onClick={onRoll}>Roll dice</button><button className="board-end" type="button" disabled={moving || game.phase !== 'end'} onClick={onEnd}>End turn</button></div></div>
    {game.players.map((player,i)=>{const position=positions?.[i] ?? player.position;const {row,col}=squarePosition(position);return !player.bankrupt && <span key={i} className="board-token" title={`${player.name}: ${board[position].name}`} aria-label={`${player.name}: ${board[position].name}`} style={{left:`${(col-0.5)/11*100}%`,top:`${(row-0.5)/11*100}%`,background:tokenColors[i],marginLeft:`${(i%3-1)*14}px`,marginTop:`${(Math.floor(i/3)-0.5)*14}px`}}>{i+1}</span>;})}
  </div></div>;
}
function OwnershipPanel({game, buildings, onProperty, seat}) {
  return <aside className="game-panel ownership-panel" aria-label="Player properties"><h2>Players &amp; properties</h2>
    {game.players.map((player,i)=>({player,i})).sort((a,b)=>Number(b.i===seat)-Number(a.i===seat)).map(({player,i})=>{const properties=Object.keys(game.owners).filter(index=>game.owners[index]===i);return <article className={`player-card ${i===game.current?'is-current':''}`} key={i}>
      <div className="player-card-heading"><span><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> <strong>{player.name}</strong></span>{i===game.current && game.winner===null && <span className="current-badge">Playing</span>}</div>
      <div className="player-location">{board[player.position].name}{player.jail?' · in jail':''}{player.resigned?' · resigned':player.bankrupt?' · bankrupt':''}</div>
      {(game.heldCards||[]).filter(card=>card.owner===i).length>0 && <div className="player-location">Jail cards: {(game.heldCards||[]).filter(card=>card.owner===i).length}</div>}
      {properties.length ? <ul className="player-properties">{properties.map(index=>{const level=buildings[index]||0;return <li key={index}><span><button type="button" className="property-link" onClick={()=>onProperty(Number(index))} aria-label={`View ${board[index].name} details`}>{board[index].name}</button>{level>0 ? ` - ${level===5?'Hotel':`${level} house${level===1?'':'s'}`}` : ''}</span></li>;})}</ul> : <p className="no-properties">No properties</p>}
    </article>;})}
  </aside>;
}
function PropertyCard({index, game, canManage, landingPrompt, onAction, error, onClose}) {
  const space=board[index];
  const ownerIndex=game.owners[index], owner=ownerIndex===undefined?'Bank':game.players[ownerIndex].name;
  const level=game.buildings?.[index]||0;
  const reason=type=>{try{action(game,type,{property:index});return '';}catch(err){return err.message;}};
  const buildReason=canManage && space.buildingCost ? reason('build') : '';
  const saleReason=canManage && space.price ? reason('sellProperty') : '';
  const buildingSaleReason=canManage && level ? reason('sellBuilding') : '';
  if(!space.price) return <div className="trade-backdrop"><section className="property-dialog" role="dialog" aria-modal="true" aria-labelledby="property-card-title"><div className="property-card-heading"><span>BOARD SPACE</span><h2 id="property-card-title">{space.name}</h2></div><div className="property-card-body"><p>This space cannot be purchased or developed.</p><button type="button" onClick={onClose}>Close</button></div></section></div>;
  return <div className="trade-backdrop"><section className="property-dialog" role="dialog" aria-modal="true" aria-labelledby="property-card-title">
    <div className={`property-card-heading group-${space.group}`}><span>PROPERTY DETAILS</span><h2 id="property-card-title">{space.name}</h2></div>
    <div className="property-card-body"><p>Owned by <strong>{owner}</strong></p>
      {landingPrompt && <p className="build-landing-notice" role="status">{level===5 ? 'You own this color set and this property already has a hotel.' : buildReason ? `You own this color set. ${buildReason}` : `You own this color set. You can build ${level===4?'a hotel':'a house'} here for $${space.buildingCost}.`}</p>}
      <div className="property-card-details"><div><h3>Prices</h3><dl className="property-values"><div><dt>Purchase price</dt><dd>${space.price}</dd></div><div><dt>Sale price to bank</dt><dd>${space.price/2}</dd></div>
      {space.buildingCost ? <><div><dt>House price (each)</dt><dd>${space.buildingCost}</dd></div><div><dt>Hotel upgrade</dt><dd>${space.buildingCost} + 4 houses</dd></div></> : <div><dt>Houses and hotels</dt><dd>Not available</dd></div>}</dl></div>
      <div><h3>Rent</h3>{space.buildingCost ? <dl className="property-values"><div><dt>Unimproved</dt><dd>${space.rent}</dd></div><div><dt>Complete color set, no buildings</dt><dd>${space.rent*2}</dd></div>{space.buildingRents.map((rent,i)=><div key={i}><dt>{i===4?'Hotel':`${i+1} house${i===0?'':'s'}`}</dt><dd>${rent}</dd></div>)}</dl> : space.group==='railroad' ? <dl className="property-values">{[25,50,100,200].map((rent,i)=><div key={i}><dt>{i+1} railroad{i===0?'':'s'} owned</dt><dd>${rent}</dd></div>)}</dl> : <dl className="property-values"><div><dt>1 utility owned</dt><dd>4 × dice</dd></div><div><dt>2 utilities owned</dt><dd>10 × dice</dd></div></dl>}</div></div>
      <p className="property-note">{space.group==='railroad'?'A Chance card may double railroad rent.':space.group==='utility'?'A Chance card may require a new roll at 10 × dice.':'Sell all buildings in this color group before selling a property.'}</p>
      {canManage && <div className="card-management"><h3>Manage this property</h3><p>{level===5?'Hotel':level?`${level} house${level===1?'':'s'}`:'No buildings'}</p><div className="game-actions">{space.buildingCost && level<5 && <button type="button" disabled={!!buildReason} onClick={()=>onAction('build',index)}>{level===4?'Build hotel':'Build house'} - ${space.buildingCost}</button>}{level>0 && <button type="button" disabled={!!buildingSaleReason} onClick={()=>onAction('sellBuilding',index)}>Sell {level===5?'hotel':'house'} - ${space.buildingCost/2}</button>}{level===5 && buildingSaleReason && !reason('sellBuildingGroup') && <button type="button" onClick={()=>onAction('sellBuildingGroup',index)}>Sell group buildings</button>}<button type="button" disabled={!!saleReason} onClick={()=>onAction('sellProperty',index)}>Sell property - ${space.price/2}</button></div>{buildReason && level<5 && <p className="property-note">{buildReason}</p>}{buildingSaleReason && level>0 && <p className="property-note">{buildingSaleReason}</p>}{saleReason && <p className="property-note">{saleReason}</p>}</div>}
      {error && <p className="card-error" role="alert">{error}</p>}<button type="button" onClick={onClose}>Close</button></div>
  </section></div>;
}
function DeckReveal({game, highlight, selecting}) {
  const {deck,id}=game.pendingCard, title=deck==='chance'?'Chance':'Community Chest';
  const eligible=new Set([...(game.decks?.[deck]||[]),id]);
  return <div className="trade-backdrop deck-backdrop"><section className={`deck-dialog deck-${deck}`} role="dialog" aria-modal="true" aria-labelledby="deck-title">
    <div className="deck-header"><div><span className="deck-eyebrow">DRAW A CARD</span><h2 id="deck-title">{title}</h2></div><p>{selecting?'Selecting from the available cards…':'Your card is highlighted below.'}</p></div>
    <p className="deck-explanation">The game randomly selects from the available cards. Dimmed cards have already been drawn or are held by a player.</p>
    <div className="deck-grid">{cards[deck].map((card,index)=>{const active=selecting?highlight===index:index===id;return <div key={index} className={`deck-card ${!eligible.has(index)?'is-unavailable':''} ${active?'is-highlighted':''}`}><span className="deck-card-number">{String(index+1).padStart(2,'0')}</span><span>{card.text}</span></div>;})}</div>
    <div className="deck-result" role="status" aria-live="polite">{selecting?'Drawing…':`Selected: ${cards[deck][id].text}`}</div>
    {!selecting && <p className="deck-close-hint">The card will be applied in 3 seconds.</p>}
  </section></div>;
}
function TradeForm({game, error, onCancel, onOffer}) {
  const [partner,setPartner]=useState(() => game.players.findIndex((player,i)=>i!==game.current&&!player.bankrupt));
  const [giveCash,setGiveCash]=useState('0');
  const [receiveCash,setReceiveCash]=useState('0');
  const [giveProperties,setGiveProperties]=useState([]);
  const [receiveProperties,setReceiveProperties]=useState([]);
  const [giveCards,setGiveCards]=useState([]);
  const [receiveCards,setReceiveCards]=useState([]);
  const choices=(owner,selected,setSelected)=>Object.keys(game.owners).filter(index=>game.owners[index]===owner).map(index=>{
    const number=Number(index),space=board[number];
    const blocked=board.some((other,j)=>other.group===space.group && !!game.buildings?.[j]);
    return <label key={index}><input type="checkbox" checked={selected.includes(number)} disabled={blocked} onChange={event=>setSelected(event.target.checked?[...selected,number]:selected.filter(i=>i!==number))}/>{space.name}{blocked?' (sell buildings first)':''}</label>;
  });
  const cardChoices=(owner,selected,setSelected)=>(game.heldCards||[]).filter(card=>card.owner===owner).map(card=>{const key=`${card.deck}:${card.id}`;return <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={event=>setSelected(event.target.checked?[...selected,key]:selected.filter(item=>item!==key))}/>{card.deck==='chance'?'Chance':'Community Chest'} get-out-of-jail card</label>;});
  return <div className="trade-backdrop"><section className="trade-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-title">
    <h2 id="trade-title">Propose a trade</h2><p>Sell buildings before trading a property in that color group.</p>{error && <p role="alert" className="game-error">{error}</p>}
    <form onSubmit={event=>{event.preventDefault();onOffer({partner,giveCash:Number(giveCash),receiveCash:Number(receiveCash),giveProperties,receiveProperties,giveCards,receiveCards});}}>
      <label>Trade with <select value={partner} onChange={event=>{setPartner(Number(event.target.value));setReceiveProperties([]);setReceiveCards([]);}}>{game.players.map((player,i)=>i!==game.current&&!player.bankrupt?<option key={i} value={i}>{player.name}</option>:null)}</select></label>
      <div className="trade-columns"><fieldset><legend>{game.players[game.current].name} gives</legend><label>Cash <input aria-label="Cash offered" type="number" min="0" step="1" required value={giveCash} onChange={event=>setGiveCash(event.target.value)}/></label>{choices(game.current,giveProperties,setGiveProperties)}{cardChoices(game.current,giveCards,setGiveCards)}</fieldset>
      <fieldset><legend>{game.players[partner].name} gives</legend><label>Cash <input aria-label="Cash requested" type="number" min="0" step="1" required value={receiveCash} onChange={event=>setReceiveCash(event.target.value)}/></label>{choices(partner,receiveProperties,setReceiveProperties)}{cardChoices(partner,receiveCards,setReceiveCards)}</fieldset></div>
      <div className="game-actions"><button type="submit">Offer trade</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  </section></div>;
}
function LoanForm({game, error, onCancel, onRequest}) {
  const [lender,setLender]=useState('bank');
  const [amount,setAmount]=useState('100');
  const principal=Number(amount);
  return <div className="trade-backdrop"><section className="trade-dialog loan-dialog" role="dialog" aria-modal="true" aria-labelledby="loan-title">
    <h2 id="loan-title">Request a loan</h2><p>House rule: repay the principal plus 10% interest, rounded up. Repayment is voluntary, in full or in part; there is no automatic deadline. Bank loans are limited to one outstanding loan of up to $500; players can make multiple loans. If a borrower goes bankrupt, their bank loan is written off and the bank pays player lenders the remaining amount.</p>
    {error && <p role="alert" className="game-error">{error}</p>}
    <form onSubmit={event=>{event.preventDefault();onRequest({lender:lender==='bank'?null:Number(lender),principal});}}>
      <label>Lender <select value={lender} onChange={event=>setLender(event.target.value)}><option value="bank">Bank</option>{game.players.map((player,i)=>i!==game.current&&!player.bankrupt?<option key={i} value={i}>{player.name} (${player.money})</option>:null)}</select></label>
      <label>Amount <input type="number" aria-label="Loan amount" min="1" max={lender==='bank'?500:1000000} step="1" required value={amount} onChange={event=>setAmount(event.target.value)}/></label>
      {Number.isSafeInteger(principal)&&principal>0 && <p>Total to repay: <strong>${principal+Math.ceil(principal/10)}</strong></p>}
      <div className="game-actions"><button type="submit">Request loan</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  </section></div>;
}
function RepaymentForm({loan, game, error, onCancel, onRepay}) {
  const [amount,setAmount]=useState(String(Math.min(loan.due,game.players[loan.borrower].money)));
  return <div className="trade-backdrop"><section className="trade-dialog loan-dialog" role="dialog" aria-modal="true" aria-labelledby="repay-title"><h2 id="repay-title">Repay loan</h2><p>Remaining balance: <strong>${loan.due}</strong> to {loan.lender===null?'the bank':game.players[loan.lender].name}. Available cash: ${game.players[loan.borrower].money}.</p><form onSubmit={event=>{event.preventDefault();onRepay(Number(amount));}}><label>Amount <input type="number" aria-label="Repayment amount" min="1" max={Math.min(loan.due,game.players[loan.borrower].money)} step="1" required value={amount} onChange={event=>setAmount(event.target.value)}/></label>{error && <p className="game-error" role="alert">{error}</p>}<div className="game-actions"><button type="submit" disabled={game.players[loan.borrower].money<1}>Make payment</button><button type="button" onClick={onCancel}>Cancel</button></div></form></section></div>;
}
function completedSetLanding(next, previous, seat) {
  const movement = next.movement || [], player = previous.current;
  if (!movement.length || next.current !== player || (seat !== undefined && seat !== player) || next.winner !== null) return null;
  const index = next.players[player].position, space = board[index];
  if (movement[movement.length - 1] !== index || !space.buildingCost || next.owners[index] !== player || !['roll','end'].includes(next.phase)) return null;
  return board.every((square,i) => square.group !== space.group || next.owners[i] === player) ? index : null;
}
export default function LocalGame({online}) {
  const [game, setGame] = useState(() => { if (online) return online.room.game; try { const saved = JSON.parse(localStorage.getItem(KEY)); return saved && saved.version === 1 ? ensureMatchId(normalizeGame(saved)) : null; } catch { return null; } });
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6']);
  const [bid, setBid] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState(() => game ? game.players.map(player => player.position) : null);
  const [sequence, setSequence] = useState('idle');
  const [dice, setDice] = useState(() => game?.dice || [1,1]);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const [activityOpen, setActivityOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [repayId, setRepayId] = useState(null);
  const [managedProperty, setManagedProperty] = useState('');
  const [propertyCard, setPropertyCard] = useState(null);
  const [landingCard, setLandingCard] = useState(null);
  const [purchaseHidden, setPurchaseHidden] = useState(false);
  const [confirmExit, setConfirmExit] = useState(null);
  const [seatLinked, setSeatLinked] = useState(false);
  const [deckHighlight, setDeckHighlight] = useState(null);
  const [deckVisible, setDeckVisible] = useState(true);
  const moving = sequence !== 'idle';
  const animation = useRef(null);
  const cardResolveTimer = useRef(null);
  const audio = useRef(null);
  const dispatchRef = useRef(null);
  const remoteRevision = useRef(online?.room.revision);
  const remoteGame = useRef(online?.room.game);
  const remoteRoom = online?.room;
  const purchasePhase = game?.phase, purchasePlayer = game?.current, purchasePosition = game?.players?.[game.current]?.position;
  useEffect(() => { setPurchaseHidden(false); }, [purchasePhase, purchasePlayer, purchasePosition]);
  useEffect(() => { if (online) return; try { if (game) { localStorage.setItem(KEY, JSON.stringify(game));recordResult(game); } else localStorage.removeItem(KEY); } catch {} }, [game, online]);
  useEffect(() => {
    if (!remoteRoom || remoteRevision.current === remoteRoom.revision) return;
    const next = remoteRoom.game, previous = remoteGame.current;
    const consecutive = remoteRoom.revision === remoteRevision.current + 1;
    remoteRevision.current = remoteRoom.revision; remoteGame.current = next;
    clearTimeout(animation.current);
    const finish = () => {
      setGame(next); setPositions(next.players.map(player => player.position)); if (next.dice) setDice(next.dice); setDeckVisible(true);
      const landing = consecutive && previous ? completedSetLanding(next, previous, remoteRoom.seat) : null;
      if (landing !== null) { setLandingCard(landing); setPropertyCard(landing); }
      if (next.phase === 'card' && previous?.phase !== 'card') {
        const { deck, id } = next.pendingCard;
        const eligible = [...(next.decks?.[deck] || []), id].sort((a, b) => a - b);
        const last = eligible.length * 3 + eligible.indexOf(id); let cardStep = 0;
        setSequence('selecting');
        const highlight = () => { setDeckHighlight(eligible[cardStep % eligible.length]); if (cardStep++ < last) animation.current = setTimeout(highlight, 100); else { animation.current = null; setSequence('idle'); } };
        highlight();
      } else { animation.current = null; setSequence('idle'); }
    };
    if (!consecutive || !previous) { finish(); return; }
    const movement = next.movement || []; let step = 0;
    const advance = () => { if (step >= movement.length) { finish(); return; } setSequence('moving'); if (soundOnRef.current) playPawnStep(audio); const position = movement[step++]; setPositions(old => { const updated = [...old]; updated[previous.current] = position; return updated; }); animation.current = setTimeout(advance, 220); };
    if (previous.phase === 'card' && remoteRoom.lastAction === 'resolveCard') {
      setDeckVisible(false);
      setSequence('moving');
      animation.current = setTimeout(advance, 150);
    } else if (remoteRoom.lastAction === 'roll' || remoteRoom.lastAction === 'rollUtility') {
      if (previous.current !== remoteRoom.seat && soundOnRef.current) {
        if (audio.current) audio.current.close().catch(() => {});
        audio.current = playDiceSound();
      }
      setSequence('rolling');
      animation.current = setTimeout(() => { setDice(next.dice); setSequence('revealed'); animation.current = setTimeout(advance, 800); }, 900);
    } else if (movement.length) advance();
    else finish();
  }, [remoteRoom]);
  useEffect(() => () => { clearTimeout(animation.current); clearTimeout(cardResolveTimer.current); if (audio.current) audio.current.close().catch(() => {}); }, []);
  useEffect(() => { if (!activityOpen) return; const closeOnEscape = event => { if (event.key === 'Escape') setActivityOpen(false); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [activityOpen]);
  useEffect(() => {
    if(online || game?.phase!=='card' || sequence!=='idle' || !deckVisible) return undefined;
    const timer=setTimeout(()=>{setDeckVisible(false);setSequence('resolving');cardResolveTimer.current=setTimeout(()=>dispatchRef.current('resolveCard'),150);},3000);
    return () => clearTimeout(timer);
  },[game?.phase,game?.pendingCard?.deck,game?.pendingCard?.id,sequence,deckVisible,online]);
  function dispatch(type, payload) {
    if (online) {
      if ((type==='roll' || type==='rollUtility') && soundOn) {
        if (audio.current) audio.current.close().catch(() => {});
        audio.current = playDiceSound();
      }
      online.send(type, payload).catch(e => setError(e.message)); return true;
    }
    if (animation.current) return false;
    try {
      const result=action(game,type,{...payload,cardRandom:Math.floor(Math.random()*1000000)});
      // Commit the resolved state before animating so a refresh cannot replay the action.
      try { localStorage.setItem(KEY,JSON.stringify(result)); } catch {}
      recordResult(result);
      setError('');
      const path=result.movement || [], player=game.current;
      const finishAction=()=>{
        setGame(result);
        const landing=completedSetLanding(result,game);
        if(landing!==null){setLandingCard(landing);setPropertyCard(landing);}
        if(result.phase==='card' && (game.phase!=='card' || result.pendingCard.deck!==game.pendingCard?.deck || result.pendingCard.id!==game.pendingCard?.id)){
          const {deck,id}=result.pendingCard;
          const eligible=[...(result.decks?.[deck]||[]),id].sort((a,b)=>a-b);
          const last=eligible.length*3+eligible.indexOf(id);
          let step=0;
          setDeckVisible(true);
          setSequence('selecting');
          const highlightNext=()=>{
            setDeckHighlight(eligible[step % eligible.length]);
            if(step++<last)animation.current=setTimeout(highlightNext,100);
            else {animation.current=null;setSequence('idle');}
          };
          highlightNext();
        }else{animation.current=null;setSequence('idle');}
      };
      let step=0;
      const advance=()=>{
        if(step<path.length){
          setSequence('moving');
          if (soundOnRef.current) playPawnStep(audio);
          const position=path[step++];
          setPositions(previous=>{const next=[...previous];next[player]=position;return next;});
          animation.current=setTimeout(advance,220);
        } else finishAction();
      };
      if(type==='roll'||type==='rollUtility'){
        if (soundOn) {
          if (audio.current) audio.current.close().catch(() => {});
          audio.current = playDiceSound();
        }
        setSequence('rolling');
        animation.current=setTimeout(()=>{
          setDice(payload.dice);
          setSequence('revealed');
          animation.current=setTimeout(advance,800);
        },900);
      } else if(path.length){setSequence('moving');advance();}
      else finishAction();
      return true;
    } catch (e) { setError(e.message); return false; }
  }
  dispatchRef.current=dispatch;
  function start(e) { e.preventDefault(); try { const next=ensureMatchId(createGame(names.slice(0, count)));setPositions(next.players.map(player=>player.position));setDice([1,1]);setGame(next);setError(''); } catch (e) { setError(e.message); } }
  const p = game && game.players[game.current];
  const decisionPlayer = game?.phase === 'auction' ? game.auction.turn : game?.phase === 'trade' ? game.pendingTrade.partner : game?.phase === 'loanOffer' ? game.pendingLoan.lender : game?.current;
  const waiting = online && online.room.seat !== decisionPlayer;
  const buildings = game && (game.buildings || {});
  const housesAvailable = game ? 32-Object.values(buildings).reduce((sum,n)=>sum+(n<5?n:0),0) : 32;
  const ownedProperties = game ? Object.keys(game.owners).filter(index=>game.owners[index]===game.current) : [];
  const selectedProperty = ownedProperties.includes(managedProperty) ? managedProperty : ownedProperties[0];
  const selectedSpace = selectedProperty !== undefined ? board[selectedProperty] : null;
  const selectedLevel = selectedProperty !== undefined ? buildings[selectedProperty]||0 : 0;
  const hasSet = selectedSpace?.buildingCost && board.every((space,index)=>space.group!==selectedSpace.group || game.owners[index]===game.current);
  const selectedGroup = selectedSpace ? board.map((space,index)=>space.group===selectedSpace.group?index:null).filter(index=>index!==null) : [];
  const groupHasBuildings = selectedGroup.some(index=>(buildings[index]||0)>0);
  const hotelsAvailable = game ? 12-Object.values(buildings).filter(n=>n===5).length : 12;
  const buildReason = !hasSet ? '' : selectedLevel>=5 ? 'This property already has a hotel.' : selectedGroup.some(index=>(buildings[index]||0)<selectedLevel) ? 'Build evenly across the color group.' : p.money<selectedSpace.buildingCost ? 'Not enough cash to build.' : selectedLevel===4 && hotelsAvailable<1 ? 'The bank has no hotels available.' : selectedLevel<4 && housesAvailable<1 ? 'The bank has no houses available.' : '';
  const turnHighlights = (game?.turnLog || []).filter(entry=>!entry.endsWith("'s turn begins.") && !entry.endsWith(' passes.')).slice(0,3);
  const canResign = online && !game.players[online.room.seat].bankrupt && game.winner===null && ['roll','buy','end'].includes(game.phase);
  const resign = () => setConfirmExit('resign');
  const abandon = () => setConfirmExit('abandon');
  return <main className="local-game">
    <header><div className="game-heading"><Link className="home-link" to="/home">← Home</Link><div><span className="game-eyebrow">GAME NIGHT</span><h1>Monopoly <span>· {online ? online.room.code : 'Local game'}</span></h1></div></div>{game && <section className="board-balances" aria-label="Player balances"><div className="board-balance-grid">{game.players.map((player,i)=><div className={`board-balance ${i===game.current?'is-current':''}`} key={i}><span><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> <span className="board-balance-name">{player.name}</span></span><strong>${player.money}</strong></div>)}</div></section>}<div className="header-actions"><button type="button" aria-pressed={soundOn} onClick={() => { if (soundOn && audio.current) { audio.current.close().catch(() => {}); audio.current = null; } setSoundOn(!soundOn); }}>{soundOn ? 'Sound on' : 'Sound off'}</button>{online && game?.winner !== null && <button onClick={online.newRoom}>New online game</button>}{game && !online && <button disabled={moving} onClick={() => { if (window.confirm('Start a new game? The saved game will be removed.')) setGame(null); }}>New game</button>}</div></header>
    {!game ? <form onSubmit={start} className="game-panel setup-panel"><span className="setup-eyebrow">READY TO PLAY?</span><h2>Set up players</h2><p>Choose 2–6 players and pass the device around on each turn.</p><label>Number of players <select value={count} onChange={e => setCount(Number(e.target.value))}>{[2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label><div className="setup-players">{names.slice(0, count).map((name, i) => <label key={i}><span className="setup-player-label"><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> Player {i+1}</span><input list="saved-player-names" required maxLength="30" value={name} onChange={e => setNames(names.map((n,j) => i === j ? e.target.value : n))}/></label>)}</div><datalist id="saved-player-names">{readPlayers().map(name=><option value={name} key={name}/>)}</datalist><button type="submit">Start game</button></form> : <>
      <section className="game-layout"><OwnershipPanel game={game} buildings={buildings} onProperty={index=>{setLandingCard(null);setPropertyCard(index);}} seat={online?.room.seat}/><Board game={game} positions={positions} dice={dice} rolling={sequence==='rolling'} moving={moving || waiting} onProperty={index=>{setError('');setLandingCard(null);setPropertyCard(index);}} onRoll={() => dispatch('roll', {dice:[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)]})} onEnd={()=>dispatch('end')}/><div className="game-panel game-sidebar">
        <div className="turn-heading"><span className="turn-eyebrow">{game.winner !== null ? 'GAME COMPLETE' : game.bankruptcyAuction ? 'AUCTION' : 'CURRENT TURN'}</span><h2>{game.winner !== null ? `${game.players[game.winner].name} wins!` : game.bankruptcyAuction ? 'Bankruptcy auctions' : `${p.name}'s turn`}</h2><p className="turn-meta">{sequence === 'revealed' || sequence === 'moving' ? `Roll: ${dice.join(' + ')}` : game.dice ? `Last roll: ${game.dice.join(' + ')}` : 'Ready to roll'}</p></div>
        {moving && <p role="status">{sequence === 'rolling' ? 'Rolling dice…' : sequence === 'revealed' ? `Rolled ${dice.join(' and ')}.` : sequence === 'selecting' ? 'Drawing a card…' : `Moving ${p.name}'s token…`}</p>}
        <fieldset disabled={moving || waiting} className="game-decision">
        {game.phase === 'buy' && purchaseHidden && !waiting && <button type="button" onClick={()=>setPurchaseHidden(false)}>Return to purchase decision</button>}
        {game.phase === 'debt' && <p>Owes ${game.pending.amount}. Sell buildings or properties to raise cash, or declare bankruptcy.</p>}
        {game.phase === 'roll' && p.jail>0 && <p>In jail: roll doubles, pay $50, or use a get-out-of-jail card before rolling.</p>}
        {game.phase === 'utilityRoll' && <p>Roll again to calculate utility rent at ten times the dice total.</p>}
        {game.phase === 'auction' && <div><h3>Auction: {board[game.auction.property].name}</h3><p>{game.players[game.auction.turn].name} to bid or pass. Current bid: ${game.auction.bid} {game.auction.highBidder !== null && `by ${game.players[game.auction.highBidder].name}`}</p><label>Bid amount <input type="number" min={game.auction.bid + 1} value={bid} onChange={e => setBid(e.target.value)}/></label><div className="game-actions"><button onClick={() => dispatch('bid', {amount: Number(bid)})}>Bid</button><button onClick={() => dispatch('pass')}>Pass</button></div></div>}
        {game.phase === 'trade' && <div className="trade-offer"><h3>Trade offer for {game.players[game.pendingTrade.partner].name}</h3><p>{p.name} offers ${game.pendingTrade.giveCash}{game.pendingTrade.giveProperties.map(index=>`, ${board[index].name}`)}{(game.pendingTrade.giveCards||[]).map(key=>`, ${key.split(':')[0]} jail card`)}.</p><p>{game.players[game.pendingTrade.partner].name} gives ${game.pendingTrade.receiveCash}{game.pendingTrade.receiveProperties.map(index=>`, ${board[index].name}`)}{(game.pendingTrade.receiveCards||[]).map(key=>`, ${key.split(':')[0]} jail card`)}.</p><div className="game-actions"><button onClick={()=>dispatch('acceptTrade')}>Accept trade</button><button onClick={()=>dispatch('rejectTrade')}>Decline trade</button></div></div>}
        {game.phase === 'loanOffer' && <div className="trade-offer"><h3>Loan request for {game.players[game.pendingLoan.lender].name}</h3><p>{p.name} requests ${game.pendingLoan.principal} and will owe ${game.pendingLoan.principal+Math.ceil(game.pendingLoan.principal/10)}. Repayment has no automatic deadline.</p><div className="game-actions"><button onClick={()=>dispatch('acceptLoan')}>Approve loan</button><button onClick={()=>dispatch('rejectLoan')}>Decline loan</button></div></div>}
        <div className="game-actions">
          {game.phase === 'roll' && p.jail>0 && <button onClick={()=>dispatch('payJail')}>Pay $50 to leave jail</button>}
          {game.phase === 'roll' && p.jail>0 && (game.heldCards || []).some(card=>card.owner===game.current) && <button onClick={()=>dispatch('useJailCard')}>Use jail card</button>}
          {game.phase === 'utilityRoll' && <button onClick={()=>dispatch('rollUtility',{dice:[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)]})}>Roll utility dice</button>}
          {game.phase === 'debt' && <button onClick={() => dispatch('bankrupt')}>Declare bankruptcy</button>}
          {['roll','end','debt'].includes(game.phase) && <button onClick={()=>{setError('');setTradeOpen(true);}}>Propose trade</button>}
          {['roll','end','debt'].includes(game.phase) && <button onClick={()=>{setError('');setLoanOpen(true);}}>Request loan</button>}
        </div>
        </fieldset>
        {selectedSpace && ['roll','buy','end','debt'].includes(game.phase) && <fieldset disabled={moving || waiting} className="game-decision property-manager"><h3>Manage properties</h3><p className="property-intro">Choose a property to build or sell.</p><label>Choose property <select value={selectedProperty} onChange={event=>setManagedProperty(event.target.value)}>{ownedProperties.map(index=><option key={index} value={index}>{board[index].name}</option>)}</select></label><p className="building-supply">Bank: {housesAvailable} houses / {12-Object.values(buildings).filter(n=>n===5).length} hotels</p><div className="game-actions"><button disabled={groupHasBuildings} onClick={()=>dispatch('sellProperty',{property:Number(selectedProperty)})}>Sell to bank ? ${selectedSpace.price/2}</button>{hasSet && game.phase!=='debt' && selectedLevel<5 && <button disabled={!!buildReason} onClick={()=>dispatch('build',{property:Number(selectedProperty)})}>Build ? ${selectedSpace.buildingCost}</button>}{selectedLevel>0 && <button onClick={()=>dispatch('sellBuilding',{property:Number(selectedProperty)})}>Sell building ? ${selectedSpace.buildingCost/2}</button>}{selectedLevel===5 && housesAvailable<4 && <button onClick={()=>dispatch('sellBuildingGroup',{property:Number(selectedProperty)})}>Sell group buildings</button>}</div>{groupHasBuildings && <p className="property-help">Sell all buildings in this color group before selling a property.</p>}{buildReason && game.phase!=='debt' && <p className="property-help">{buildReason}</p>}</fieldset>}
        <section className="turn-activity" aria-label="This turn's activity"><div className="turn-activity-heading"><h3>This turn</h3><span>HIGHLIGHTS</span></div>{turnHighlights.length ? <ol aria-live="polite">{turnHighlights.map((entry,i)=><li key={i}>{sequence==='selecting' && entry.includes(' draws ') ? `${p.name} is drawing a card…` : entry}</li>)}</ol> : <p>Key actions will appear here.</p>}</section>
        <button type="button" className="activity-toggle" aria-expanded={activityOpen} aria-controls="activity-drawer" onClick={() => setActivityOpen(true)}>Activity log</button>
        {(game.loans||[]).length>0 && <section className="outstanding-loans" aria-label="Outstanding loans"><h3>Outstanding loans</h3>{game.loans.map(loan=><div className="loan-line" key={loan.id}><span>{game.players[loan.borrower].name} owes ${loan.due} to {loan.lender===null?'bank':game.players[loan.lender].name}</span>{loan.borrower===game.current && ['roll','buy','end'].includes(game.phase) && <button type="button" disabled={moving || waiting} onClick={()=>{setError('');setRepayId(loan.id);}}>Repay</button>}</div>)}</section>}
        {online && game.winner===null && <section className="room-controls" aria-label="Game controls"><h3>Game controls</h3>{!game.players[online.room.seat].bankrupt ? <><button type="button" disabled={!canResign || moving} onClick={resign}>Resign</button>{!canResign && <p>Resignation is available after the current card, debt, auction or offer is resolved.</p>}</> : <button type="button" onClick={online.newRoom}>Leave game</button>}{online.room.seat===0 && <button type="button" disabled={moving} onClick={abandon}>End game for everyone</button>}{online.user && online.linkSeat && <button type="button" disabled={seatLinked} onClick={()=>online.linkSeat().then(()=>setSeatLinked(true)).catch(err=>setError(err.message))}>{seatLinked?'Seat linked':'Link seat to account'}</button>}</section>}

      </div></section>
      <aside id="activity-drawer" className={`activity-drawer ${activityOpen ? 'is-open' : ''}`} aria-hidden={!activityOpen} aria-label="Activity log"><div className="activity-heading"><h2>Activity log</h2><button type="button" tabIndex={activityOpen ? undefined : -1} onClick={() => setActivityOpen(false)} aria-label="Close activity log">×</button></div><ol className="activity-entries">{game.log.map((entry,i) => <li key={i}>{entry}</li>)}</ol></aside>
      {game.phase==='buy' && !moving && !waiting && !purchaseHidden && !tradeOpen && !loanOpen && propertyCard===null && <div className="trade-backdrop"><section className="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-title"><span className="purchase-eyebrow">AVAILABLE PROPERTY</span><h2 id="purchase-title">{board[p.position].name}</h2><p>{p.name}, purchase this property for <strong>${board[p.position].price}</strong>, send it to auction, or pass.</p><button type="button" className="details-link" onClick={()=>setPropertyCard(p.position)}>View property details</button>{p.money<board[p.position].price && <p className="purchase-warning">Not enough cash to buy. You can raise cash, auction it, or pass.</p>}{error && <p className="game-error" role="alert">{error}</p>}<div className="purchase-actions"><button disabled={p.money<board[p.position].price} onClick={()=>dispatch('buy')}>Buy property</button><button onClick={()=>dispatch('skip')}>Decline and auction</button><button onClick={()=>dispatch('passPurchase')}>Pass and move on</button><button onClick={()=>{setError('');setTradeOpen(true);}}>Propose trade</button><button onClick={()=>{setError('');setLoanOpen(true);}}>Request loan</button>{ownedProperties.length>0 && <button className="purchase-manage" onClick={()=>setPurchaseHidden(true)}>Manage my properties</button>}</div>{online && <div className="purchase-exit-actions"><button type="button" onClick={resign}>Resign</button>{online.room.seat===0 && <button type="button" onClick={abandon}>End game for everyone</button>}</div>}</section></div>}
      {propertyCard!==null && <PropertyCard index={propertyCard} game={game} landingPrompt={landingCard===propertyCard} canManage={!moving && !waiting && game.winner===null && game.owners[propertyCard]===game.current && ['roll','buy','end','debt'].includes(game.phase)} error={error} onAction={(type,index)=>{setError('');dispatch(type,{property:index});}} onClose={()=>{setPropertyCard(null);setLandingCard(null);setError('');}}/>}
      {game.phase==='card' && deckVisible && <DeckReveal game={game} highlight={deckHighlight} selecting={sequence==='selecting'}/>}
      {tradeOpen && <TradeForm game={game} error={error} onCancel={()=>{setError('');setTradeOpen(false);}} onOffer={offer=>{if(dispatch('proposeTrade',offer))setTradeOpen(false);}}/>}
      {loanOpen && <LoanForm game={game} error={error} onCancel={()=>{setError('');setLoanOpen(false);}} onRequest={request=>{if(dispatch('requestLoan',request))setLoanOpen(false);}}/>}
      {repayId!==null && (game.loans||[]).some(loan=>loan.id===repayId) && <RepaymentForm loan={game.loans.find(loan=>loan.id===repayId)} game={game} error={error} onCancel={()=>{setRepayId(null);setError('');}} onRepay={amount=>{if(dispatch('repayLoan',{id:repayId,amount}))setRepayId(null);}}/>}
      {confirmExit && <ConfirmDialog title={confirmExit==='resign'?'Resign from game?':'End game for everyone?'} message={confirmExit==='resign'?'Your properties return to the bank, and you cannot rejoin this game.':'The game will end for everyone and there will be no winner.'} confirmLabel={confirmExit==='resign'?'Resign':'End game'} onCancel={()=>setConfirmExit(null)} onConfirm={()=>{const type=confirmExit;setConfirmExit(null);dispatch(type);}}/>}
    </>}{error && !tradeOpen && !loanOpen && <p role="alert" className="game-error">{error}</p>}
  </main>;
}
