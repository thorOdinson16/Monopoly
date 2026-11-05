import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { action, board, cards, createGame, normalizeGame } from './engine';
import { ensureMatchId, recordResult } from '../data/localResults';
import { readPlayers } from '../data/localPlayers';
import './LocalGame.css';

const KEY = 'monopoly-local-game-v1';
const tokenColors = ['#1765d1', '#da3030', '#e5b615', '#238346', '#9a4bbb', '#e17e24'];
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
function squarePosition(i) {
  if (i <= 10) return {row:11, col:11-i};
  if (i <= 20) return {row:21-i, col:1};
  if (i <= 30) return {row:1, col:i-19};
  return {row:i-29, col:11};
}
function Board({game, positions, dice, rolling, moving, onRoll, onEnd}) {
  return <div className="board-scroll"><div className="visual-board" aria-label="Monopoly board">
    {board.map((space, i) => { const {row,col}=squarePosition(i); const owner=game.owners[i]; return <div key={i} className={`board-space ${i%10===0?'board-corner':''}`} style={{gridRow:row,gridColumn:col}}>
      {space.group && <span className={`board-strip group-${space.group}`}/>}
      <span className="board-space-name">{space.name}</span>{space.price && <span>${space.price}</span>}
      {!!game.buildings?.[i] && <span className="board-building" title={game.buildings[i]===5?'Hotel':`${game.buildings[i]} house${game.buildings[i]===1?'':'s'}`}>{game.buildings[i]===5?'H':`⌂${game.buildings[i]}`}</span>}
      {owner !== undefined && <span className="board-owner" style={{background:tokenColors[owner]}} title={`Owned by ${game.players[owner].name}`}>{owner+1}</span>}
    </div>; })}
    <div className="board-center"><div className="board-brand">MONOPOLY</div><p>Roll, buy and build your fortune</p><div className="board-dice" role="img" aria-label={rolling ? 'Rolling dice' : `Dice: ${dice.join(' and ')}`}>{dice.map((die,i)=><Die value={die} rolling={rolling} key={i}/>)}</div><div className="board-turn-buttons"><button className="board-roll" type="button" disabled={moving || game.phase !== 'roll'} onClick={onRoll}>Roll dice</button><button className="board-end" type="button" disabled={moving || game.phase !== 'end'} onClick={onEnd}>End turn</button></div></div>
    {game.players.map((player,i)=>{const position=positions?.[i] ?? player.position;const {row,col}=squarePosition(position);return !player.bankrupt && <span key={i} className="board-token" title={`${player.name}: ${board[position].name}`} aria-label={`${player.name}: ${board[position].name}`} style={{left:`${(col-0.5)/11*100}%`,top:`${(row-0.5)/11*100}%`,background:tokenColors[i],marginLeft:`${(i%3-1)*14}px`,marginTop:`${(Math.floor(i/3)-0.5)*14}px`}}>{i+1}</span>;})}
  </div></div>;
}
function OwnershipPanel({game, buildings, onProperty}) {
  return <aside className="game-panel ownership-panel" aria-label="Player properties"><h2>Players &amp; properties</h2>
    {game.players.map((player,i)=>{const properties=Object.keys(game.owners).filter(index=>game.owners[index]===i);return <article className={`player-card ${i===game.current?'is-current':''}`} key={i}>
      <div className="player-card-heading"><span><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> <strong>{player.name}</strong></span></div>
      <div className="player-location">{board[player.position].name}{player.jail?' · in jail':''}{player.bankrupt?' · bankrupt':''}</div>
      {(game.heldCards||[]).filter(card=>card.owner===i).length>0 && <div className="player-location">Jail cards: {(game.heldCards||[]).filter(card=>card.owner===i).length}</div>}
      {properties.length ? <ul className="player-properties">{properties.map(index=>{const level=buildings[index]||0;return <li key={index}><span><button type="button" className="property-link" onClick={()=>onProperty(Number(index))} aria-label={`View ${board[index].name} details`}>{board[index].name}</button>{level>0 ? ` - ${level===5?'Hotel':`${level} house${level===1?'':'s'}`}` : ''}</span></li>;})}</ul> : <p className="no-properties">No properties</p>}
    </article>;})}
  </aside>;
}
function PropertyCard({index, owner, onClose}) {
  const space=board[index];
  return <div className="trade-backdrop"><section className="property-dialog" role="dialog" aria-modal="true" aria-labelledby="property-card-title">
    <div className={`property-card-heading group-${space.group}`}><span>PROPERTY DETAILS</span><h2 id="property-card-title">{space.name}</h2></div>
    <div className="property-card-body"><p>Owned by <strong>{owner}</strong></p>
      <dl className="property-values"><div><dt>Purchase price</dt><dd>${space.price}</dd></div><div><dt>Sale price to bank</dt><dd>${space.price/2}</dd></div>
      {space.buildingCost ? <><div><dt>House price (each)</dt><dd>${space.buildingCost}</dd></div><div><dt>Hotel upgrade</dt><dd>${space.buildingCost} + 4 houses</dd></div></> : <div><dt>Houses and hotels</dt><dd>Not available</dd></div>}</dl>
      <h3>Rent</h3>{space.buildingCost ? <dl className="property-values"><div><dt>Unimproved</dt><dd>${space.rent}</dd></div><div><dt>Complete color set, no buildings</dt><dd>${space.rent*2}</dd></div>{space.buildingRents.map((rent,i)=><div key={i}><dt>{i===4?'Hotel':`${i+1} house${i===0?'':'s'}`}</dt><dd>${rent}</dd></div>)}</dl> : space.group==='railroad' ? <dl className="property-values">{[25,50,100,200].map((rent,i)=><div key={i}><dt>{i+1} railroad{i===0?'':'s'} owned</dt><dd>${rent}</dd></div>)}</dl> : <dl className="property-values"><div><dt>1 utility owned</dt><dd>4 × dice</dd></div><div><dt>2 utilities owned</dt><dd>10 × dice</dd></div></dl>}
      <p className="property-note">{space.group==='railroad'?'A Chance card may double railroad rent.':space.group==='utility'?'A Chance card may require a new roll at 10 × dice.':'Sell all buildings in this color group before selling a property.'}</p>
      <button type="button" onClick={onClose}>Close</button></div>
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
    <h2 id="loan-title">Request a loan</h2><p>House rule: repay the principal plus 10% interest, rounded up. Repayment is voluntary and due in full; there is no automatic deadline. Bank loans are limited to one outstanding loan of up to $500; players can make multiple loans. If a borrower goes bankrupt, their bank loan is written off and the bank pays player lenders the full outstanding amount.</p>
    {error && <p role="alert" className="game-error">{error}</p>}
    <form onSubmit={event=>{event.preventDefault();onRequest({lender:lender==='bank'?null:Number(lender),principal});}}>
      <label>Lender <select value={lender} onChange={event=>setLender(event.target.value)}><option value="bank">Bank</option>{game.players.map((player,i)=>i!==game.current&&!player.bankrupt?<option key={i} value={i}>{player.name} (${player.money})</option>:null)}</select></label>
      <label>Amount <input type="number" aria-label="Loan amount" min="1" max={lender==='bank'?500:1000000} step="1" required value={amount} onChange={event=>setAmount(event.target.value)}/></label>
      {Number.isSafeInteger(principal)&&principal>0 && <p>Total to repay: <strong>${principal+Math.ceil(principal/10)}</strong></p>}
      <div className="game-actions"><button type="submit">Request loan</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  </section></div>;
}
export default function LocalGame() {
  const [game, setGame] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(KEY)); return saved && saved.version === 1 ? ensureMatchId(normalizeGame(saved)) : null; } catch { return null; } });
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6']);
  const [bid, setBid] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState(() => game ? game.players.map(player => player.position) : null);
  const [sequence, setSequence] = useState('idle');
  const [dice, setDice] = useState(() => game?.dice || [1,1]);
  const [soundOn, setSoundOn] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [managedProperty, setManagedProperty] = useState('');
  const [propertyCard, setPropertyCard] = useState(null);
  const [deckHighlight, setDeckHighlight] = useState(null);
  const [deckVisible, setDeckVisible] = useState(true);
  const moving = sequence !== 'idle';
  const animation = useRef(null);
  const audio = useRef(null);
  const dispatchRef = useRef(null);
  useEffect(() => { try { if (game) { localStorage.setItem(KEY, JSON.stringify(game));recordResult(game); } else localStorage.removeItem(KEY); } catch {} }, [game]);
  useEffect(() => () => { clearTimeout(animation.current); if (audio.current) audio.current.close().catch(() => {}); }, []);
  useEffect(() => { if (!activityOpen) return; const closeOnEscape = event => { if (event.key === 'Escape') setActivityOpen(false); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [activityOpen]);
  useEffect(() => {
    if(game?.phase!=='card' || sequence!=='idle' || !deckVisible) return undefined;
    const timer=setTimeout(()=>{setDeckVisible(false);dispatchRef.current('resolveCard');},3000);
    return () => clearTimeout(timer);
  },[game?.phase,game?.pendingCard?.deck,game?.pendingCard?.id,sequence,deckVisible]);
  function dispatch(type, payload) {
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
  return <main className="local-game">
    <header><div className="game-heading"><Link className="home-link" to="/home">← Home</Link><div><span className="game-eyebrow">GAME NIGHT</span><h1>Monopoly <span>· Local game</span></h1></div></div><div className="header-actions"><button type="button" aria-pressed={soundOn} onClick={() => { if (soundOn && audio.current) { audio.current.close().catch(() => {}); audio.current = null; } setSoundOn(!soundOn); }}>{soundOn ? 'Sound on' : 'Sound off'}</button>{game && <button disabled={moving} onClick={() => { if (window.confirm('Start a new game? The saved game will be removed.')) setGame(null); }}>New game</button>}</div></header>
    {!game ? <form onSubmit={start} className="game-panel setup-panel"><span className="setup-eyebrow">READY TO PLAY?</span><h2>Set up players</h2><p>Choose 2–6 players and pass the device around on each turn.</p><label>Number of players <select value={count} onChange={e => setCount(Number(e.target.value))}>{[2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label><div className="setup-players">{names.slice(0, count).map((name, i) => <label key={i}><span className="setup-player-label"><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> Player {i+1}</span><input list="saved-player-names" required maxLength="30" value={name} onChange={e => setNames(names.map((n,j) => i === j ? e.target.value : n))}/></label>)}</div><datalist id="saved-player-names">{readPlayers().map(name=><option value={name} key={name}/>)}</datalist><button type="submit">Start game</button></form> : <>
      <p className="game-notice">Game in progress: bankruptcy is simplified. Properties can be sold directly to the bank for half their purchase price.</p>
      <section className="game-layout"><OwnershipPanel game={game} buildings={buildings} onProperty={setPropertyCard}/><Board game={game} positions={positions} dice={dice} rolling={sequence==='rolling'} moving={moving} onRoll={() => dispatch('roll', {dice:[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)]})} onEnd={()=>dispatch('end')}/><div className="game-panel game-sidebar">
        <div className="turn-heading"><span className="turn-eyebrow">{game.winner !== null ? 'GAME COMPLETE' : game.bankruptcyAuction ? 'AUCTION' : 'CURRENT TURN'}</span><h2>{game.winner !== null ? `${game.players[game.winner].name} wins!` : game.bankruptcyAuction ? 'Bankruptcy auctions' : `${p.name}'s turn`}</h2><p className="turn-meta">{sequence === 'revealed' || sequence === 'moving' ? `Roll: ${dice.join(' + ')}` : game.dice ? `Last roll: ${game.dice.join(' + ')}` : 'Ready to roll'}</p></div>
        {moving && <p role="status">{sequence === 'rolling' ? 'Rolling dice…' : sequence === 'revealed' ? `Rolled ${dice.join(' and ')}.` : sequence === 'selecting' ? 'Drawing a card…' : `Moving ${p.name}'s token…`}</p>}
        <fieldset disabled={moving} className="game-decision">
        {game.phase === 'buy' && <div className="decision-callout"><span>AVAILABLE PROPERTY</span><strong>{board[p.position].name}</strong><p>Purchase for ${board[p.position].price}, send it to auction, or pass.</p><button type="button" className="details-link" onClick={()=>setPropertyCard(p.position)}>View property details</button>{p.money<board[p.position].price && <p>Not enough cash to buy. You can raise cash, auction it, or pass.</p>}</div>}
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
          {game.phase === 'buy' && <><button disabled={p.money<board[p.position].price} onClick={() => dispatch('buy')}>Buy property</button><button onClick={() => dispatch('skip')}>Decline and auction</button><button onClick={() => dispatch('passPurchase')}>Pass and move on</button></>}
          {game.phase === 'debt' && <button onClick={() => dispatch('bankrupt')}>Declare bankruptcy</button>}
          {['roll','buy','end','debt'].includes(game.phase) && <button onClick={()=>{setError('');setTradeOpen(true);}}>Propose trade</button>}
          {['roll','buy','end','debt'].includes(game.phase) && <button onClick={()=>{setError('');setLoanOpen(true);}}>Request loan</button>}
        </div>
        </fieldset>
        <section className="turn-activity" aria-label="This turn's activity"><div className="turn-activity-heading"><h3>This turn</h3><span>LIVE</span></div>{game.turnLog?.length ? <ol aria-live="polite">{game.turnLog.map((entry,i)=><li key={i}>{sequence==='selecting' && i===0 && entry.includes(' draws ') ? `${p.name} is drawing a card…` : entry}</li>)}</ol> : <p>No actions yet. Activity will appear here.</p>}</section>
        <button type="button" className="activity-toggle" aria-expanded={activityOpen} aria-controls="activity-drawer" onClick={() => setActivityOpen(true)}>Activity log</button>
        <section className="balance-overview" aria-label="Player balances"><h3>Player balances</h3>{game.players.map((player,i)=><div className="balance-entry" key={i}><div className="balance-row"><span><span className="player-key" style={{background:tokenColors[i]}}>{i+1}</span> {player.name}</span><strong>${player.money}</strong></div>{(game.loans||[]).filter(loan=>loan.borrower===i).map(loan=><div className="loan-line" key={loan.id}><span>Owes ${loan.due} to {loan.lender===null?'bank':game.players[loan.lender].name}</span>{i===game.current && ['roll','buy','end'].includes(game.phase) && <button type="button" disabled={moving} onClick={()=>dispatch('repayLoan',{id:loan.id})}>Repay</button>}</div>)}</div>)}</section>
        {selectedSpace && ['roll','buy','end','debt'].includes(game.phase) && <fieldset disabled={moving} className="game-decision property-manager"><h3>Property actions</h3><label>Property <select value={selectedProperty} onChange={event=>setManagedProperty(event.target.value)}>{ownedProperties.map(index=><option key={index} value={index}>{board[index].name}</option>)}</select></label><p className="building-supply">Bank: {housesAvailable} houses / {12-Object.values(buildings).filter(n=>n===5).length} hotels</p><div className="game-actions"><button disabled={groupHasBuildings} onClick={()=>dispatch('sellProperty',{property:Number(selectedProperty)})}>Sell property ${selectedSpace.price/2}</button>{hasSet && game.phase!=='debt' && selectedLevel<5 && <button disabled={!!buildReason} onClick={()=>dispatch('build',{property:Number(selectedProperty)})}>Build ${selectedSpace.buildingCost}</button>}{selectedLevel>0 && <button onClick={()=>dispatch('sellBuilding',{property:Number(selectedProperty)})}>Sell building ${selectedSpace.buildingCost/2}</button>}{selectedLevel===5 && housesAvailable<4 && <button onClick={()=>dispatch('sellBuildingGroup',{property:Number(selectedProperty)})}>Sell group buildings</button>}</div>{groupHasBuildings && <p className="property-help">Sell all buildings in this color group before selling a property.</p>}{buildReason && game.phase!=='debt' && <p className="property-help">{buildReason}</p>}</fieldset>}
      </div></section>
      <aside id="activity-drawer" className={`activity-drawer ${activityOpen ? 'is-open' : ''}`} aria-hidden={!activityOpen} aria-label="Activity log"><div className="activity-heading"><h2>Activity log</h2><button type="button" tabIndex={activityOpen ? undefined : -1} onClick={() => setActivityOpen(false)} aria-label="Close activity log">×</button></div><ol className="activity-entries">{game.log.map((entry,i) => <li key={i}>{entry}</li>)}</ol></aside>
      {propertyCard!==null && <PropertyCard index={propertyCard} owner={game.owners[propertyCard]===undefined?'Bank':game.players[game.owners[propertyCard]].name} onClose={()=>setPropertyCard(null)}/>}
      {game.phase==='card' && deckVisible && <DeckReveal game={game} highlight={deckHighlight} selecting={sequence==='selecting'}/>}
      {tradeOpen && <TradeForm game={game} error={error} onCancel={()=>{setError('');setTradeOpen(false);}} onOffer={offer=>{if(dispatch('proposeTrade',offer))setTradeOpen(false);}}/>}
      {loanOpen && <LoanForm game={game} error={error} onCancel={()=>{setError('');setLoanOpen(false);}} onRequest={request=>{if(dispatch('requestLoan',request))setLoanOpen(false);}}/>}
    </>}{error && !tradeOpen && !loanOpen && <p role="alert" className="game-error">{error}</p>}
  </main>;
}
