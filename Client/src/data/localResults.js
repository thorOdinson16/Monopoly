const RESULTS_KEY = 'monopoly-local-results-v1';
const GAME_KEY = 'monopoly-local-game-v1';
export function ensureMatchId(game) {
  if (game.matchId) return game;
  const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {...game, matchId:id};
}
export function readResults() {
  try { const data=JSON.parse(localStorage.getItem(RESULTS_KEY));return Array.isArray(data)?data.filter(item=>item && typeof item.id==='string' && Array.isArray(item.players) && typeof item.winner==='string'):[]; } catch { return []; }
}
export function recordResult(game) {
  if (!game?.matchId || !Number.isInteger(game.winner) || !game.players?.[game.winner]) return;
  try {
    const results=readResults();if(results.some(result=>result.id===game.matchId))return;
    results.unshift({id:game.matchId,players:game.players.map(player=>player.name),winner:game.players[game.winner].name,completedAt:new Date().toISOString()});
    localStorage.setItem(RESULTS_KEY,JSON.stringify(results));
  } catch { /* The game remains playable if storage is unavailable. */ }
}
export function readCurrentGame() {
  try {const game=JSON.parse(localStorage.getItem(GAME_KEY));return game?.version===1 && Array.isArray(game.players)?game:null;} catch {return null;}
}
export function standings(results) {
  const byName=new Map();
  for(const game of results){
    const seen=new Set();
    for(const raw of game.players){if(typeof raw!=='string'||!raw.trim())continue;const name=raw.trim(),key=name.toLocaleLowerCase();if(seen.has(key))continue;seen.add(key);const entry=byName.get(key)||{name,played:0,wins:0};entry.played++;if(typeof game.winner==='string'&&game.winner.trim().toLocaleLowerCase()===key)entry.wins++;byName.set(key,entry);}
  }
  return [...byName.values()].sort((a,b)=>b.wins-a.wins||b.played-a.played||a.name.localeCompare(b.name));
}
