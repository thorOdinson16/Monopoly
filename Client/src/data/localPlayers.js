const KEY='monopoly-local-players-v1';
export function readPlayers(){try{const list=JSON.parse(localStorage.getItem(KEY));return Array.isArray(list)?list.filter(name=>typeof name==='string'&&name.trim()):[];}catch{return [];}}
export function savePlayers(players){localStorage.setItem(KEY,JSON.stringify(players));}
