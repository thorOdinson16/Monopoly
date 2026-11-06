import {readCurrentGame, readResults} from './localResults';
import {readPlayers} from './localPlayers';

const keys={game:'monopoly-local-game-v1',results:'monopoly-local-results-v1',players:'monopoly-local-players-v1'};
export function snapshotLocalState(){return {game:readCurrentGame(),results:readResults(),players:readPlayers()};}
export function restoreLocalState(data){
  if(!data || !(data.game===null || (data.game?.version===1 && Array.isArray(data.game.players))) || !Array.isArray(data.results) || !Array.isArray(data.players) || data.players.some(name=>typeof name!=='string'))throw new Error('The saved data is invalid.');
  const previous=Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,localStorage.getItem(value)]));
  try{for(const [key,value] of Object.entries(keys)){if(data[key]===null)localStorage.removeItem(value);else localStorage.setItem(value,JSON.stringify(data[key]));}}
  catch(error){for(const [key,value] of Object.entries(keys)){try{if(previous[key]===null)localStorage.removeItem(value);else localStorage.setItem(value,previous[key]);}catch{}}throw new Error('Could not restore data in this browser.');}
}
