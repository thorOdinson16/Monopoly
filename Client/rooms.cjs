// Online rooms use the same rules engine as local play. Seat tokens stay private.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createGame, action } = require('./src/game/engine');

function createRooms(file) {
  let rooms = {};
  if (fs.existsSync(file)) rooms = JSON.parse(fs.readFileSync(file, 'utf8'));
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(rooms), { mode: 0o600 });
    fs.renameSync(temporary, file);
  }
  const token = () => crypto.randomBytes(32).toString('hex');
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  function view(room, seat) { return { code: room.code, players: room.players.map(p => ({ name: p.name, approved: p.approved !== false })), seat, started: !!room.game, abandoned: !!room.abandoned, game: room.game, revision: room.revision, lastAction: room.lastAction }; }
  function nameOf(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 30) throw Error('Enter a name of 1–30 characters.');
    return value.trim();
  }
  function create(name, account) {
    name = nameOf(name);
    if (Object.keys(rooms).length >= 200) throw Error('The server has reached its room limit.');
    let code;
    do { code = crypto.randomBytes(5).toString('hex').toUpperCase(); } while (rooms[code]);
    const secret = token();
    const room = rooms[code] = { code, players: [{ name, token: digest(secret), ...(account?{account}: {}) }], revision: 0, game: null, createdAt:new Date().toISOString() };
    save(); return { ...view(room, 0), token: secret };
  }
  function join(code, name, account) {
    const room = rooms[code]; if (!room) throw Error('Room not found.');
    if (room.abandoned) throw Error('This room has ended.');
    if (room.game) throw Error('This game has already started.');
    if (room.players.length >= 6) throw Error('This room is full.');
    if(account && room.players.some(player=>player.account===account))throw Error('This account already has a seat. Rejoin instead.');
    name = nameOf(name);
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw Error('That name is already in use.');
    const secret = token(); room.players.push({ name, token: digest(secret), approved: false, ...(account?{account}: {}) }); room.revision++; save();
    return { ...view(room, room.players.length - 1), token: secret };
  }
  function authenticate(code, secret) {
    const room = rooms[code];
    if (!room || typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) throw Error('Room or player session not found.');
    const key=digest(secret),seat = room.players.findIndex(player => player.token === key || (player.tokens||[]).includes(key));
    if (seat < 0) throw Error('Room or player session not found.');
    return { room, seat };
  }
  function read(code, secret) { const { room, seat } = authenticate(code, secret); return view(room, seat); }
  function link(code, secret, account) {
    if(!account)throw Error('Sign in to link a seat.');
    const {room,seat}=authenticate(code,secret), player=room.players[seat];
    if(player.account && player.account!==account)throw Error('This seat belongs to another account.');
    if(room.players.some((other,index)=>index!==seat && other.account===account))throw Error('This account already has a seat in the room.');
    player.account=account;save();return view(room,seat);
  }
  function rejoin(code, account) {
    const room=rooms[code];if(!room||!account||room.abandoned||room.game?.winner!==null && room.game?.winner!==undefined)throw Error('No active seat found for this account.');
    const seat=room.players.findIndex(player=>player.account===account);
    if(seat<0 || room.game?.players?.[seat]?.bankrupt)throw Error('No active seat found for this account.');
    const secret=token();room.players[seat].tokens=[...(room.players[seat].tokens||[]),digest(secret)].slice(-10);save();return {...view(room,seat),token:secret};
  }
  function analytics(account) {
    if(!account)throw Error('Sign in to see online history.');
    const games=[];
    for(const room of Object.values(rooms)){const seat=room.players.findIndex(player=>player.account===account);if(seat<0||!room.game)continue;const game=room.game;const result=room.abandoned?'abandoned':game.winner===null?'in progress':game.winner===seat?'win':'loss';games.push({code:room.code,name:room.players[seat].name,result,resigned:!!game.players[seat]?.resigned,players:game.players.length,startedAt:room.startedAt||null,endedAt:room.endedAt||null});}
    games.sort((a,b)=>(b.startedAt||'').localeCompare(a.startedAt||''));
    const played=games.filter(game=>game.result==='win'||game.result==='loss').length,wins=games.filter(game=>game.result==='win').length;
    return {games,played,wins,losses:played-wins,winRate:played?Math.round(wins/played*100):0,active:games.filter(game=>game.result==='in progress'&&!game.resigned).length};
  }
  function revokeAccountSeats(account) {
    let changed=false;
    for(const room of Object.values(rooms))for(const player of room.players)if(player.account===account){player.token=digest(token());player.tokens=[];changed=true;}
    if(changed)save();
  }
  function start(code, secret) {
    const { room, seat } = authenticate(code, secret);
    if (seat !== 0) throw Error('Only the host can start the game.');
    if (room.abandoned) throw Error('This room has ended.');
    if (room.game) throw Error('The game has already started.');
    if (room.players.some(player => player.approved === false)) throw Error('Approve or remove pending players first.');
    room.game = createGame(room.players.map(player => player.name)); room.startedAt=new Date().toISOString();room.revision++; save(); return view(room, seat);
  }
  function decide(code, secret, playerIndex, approve) {
    const { room, seat } = authenticate(code, secret);
    if (seat !== 0 || room.game || room.abandoned) throw Error('Only the host can manage the lobby.');
    if (!Number.isInteger(playerIndex) || playerIndex < 1 || playerIndex >= room.players.length) throw Error('Player not found.');
    if (approve) room.players[playerIndex].approved = true;
    else room.players.splice(playerIndex, 1);
    room.revision++; save(); return view(room, seat);
  }
  function perform(code, secret, type, payload, revision) {
    const { room, seat } = authenticate(code, secret); const game = room.game;
    if (revision !== room.revision) throw Error('The game changed. Please try again.');
    if (room.abandoned || (game && (game.phase === 'abandoned' || game.winner !== null))) throw Error('This game has ended.');
    if (type === 'abandon') {
      if (seat !== 0) throw Error('Only the host can end the game for everyone.');
      room.abandoned = true;
      room.endedAt = new Date().toISOString();
      if (game) room.game = {...game, phase:'abandoned', abandoned:true, log:[`${room.players[seat].name} ended the game.`, ...(game.log || [])]};
      room.lastAction = type; room.revision++; save(); return view(room, seat);
    }
    if (!game) throw Error('The game has not started.');
    if (type === 'resign') {
      room.game = action(game, 'resign', {player:seat});if(room.game.winner!==null)room.endedAt=new Date().toISOString();
      room.lastAction = type; room.revision++; save(); return view(room, seat);
    }
    const actor = game.phase === 'auction' ? game.auction.turn : game.phase === 'trade' ? game.pendingTrade.partner : game.phase === 'loanOffer' ? game.pendingLoan.lender : game.current;
    if (seat !== actor) throw Error('It is not your decision.');
    if (type === 'resolveCard') throw Error('Cards are resolved by the server.');
    const safe = { ...(payload && typeof payload === 'object' ? payload : {}), cardRandom: crypto.randomInt(1000000) };
    if (type === 'roll' || type === 'rollUtility') safe.dice = [crypto.randomInt(1, 7), crypto.randomInt(1, 7)];
    room.game = action(game, type, safe);if(room.game.winner!==null)room.endedAt=new Date().toISOString();room.lastAction = type; room.revision++; save();
    if (room.game.phase === 'card') scheduleCard(room);
    return view(room, seat);
  }
  function scheduleCard(room) {
    const revision = room.revision;
    setTimeout(() => {
      if (room.revision !== revision || room.game?.phase !== 'card') return;
      room.game = action(room.game, 'resolveCard', { cardRandom: crypto.randomInt(1000000) });
      if(room.game.winner!==null)room.endedAt=new Date().toISOString();
      room.lastAction = 'resolveCard'; room.revision++; save();
      if (room.game.phase === 'card') scheduleCard(room);
    }, 1700 + (room.game.movement?.length || 0) * 220 + 6400 + 3500).unref();
  }
  Object.values(rooms).filter(room => room.game?.phase === 'card').forEach(scheduleCard);
  return { create, join, read, start, perform, decide, link, rejoin, analytics, revokeAccountSeats };
}
module.exports = { createRooms };
