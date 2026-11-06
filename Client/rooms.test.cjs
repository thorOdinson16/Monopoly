const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRooms } = require('./rooms.cjs');
const { createGame, action } = require('./src/game/engine');

test('rooms persist, require seat tokens and enforce the current player', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monopoly-rooms-'));
  const file = path.join(dir, 'rooms.json');
  try {
    let rooms = createRooms(file);
    const host = rooms.create('Alice');
    const guest = rooms.join(host.code, 'Bob');
    assert.throws(() => rooms.read(host.code, 'bad'), /session/);
    assert.throws(() => rooms.start(host.code, guest.token), /host/);
    assert.throws(() => rooms.start(host.code, host.token), /pending/);
    rooms.decide(host.code, host.token, 1, true);
    const started = rooms.start(host.code, host.token);
    assert.throws(() => rooms.join(host.code, 'Charlie'), /started/);
    assert.throws(() => rooms.perform(host.code, guest.token, 'roll', {}, started.revision), /not your decision/);
    const result = rooms.perform(host.code, host.token, 'roll', { dice: [99, 99] }, started.revision);
    assert.ok(result.game.dice.every(die => die >= 1 && die <= 6));
    assert.throws(() => rooms.perform(host.code, host.token, 'roll', {}, started.revision), /changed/);
    rooms = createRooms(file);
    assert.equal(rooms.read(host.code, guest.token).revision, result.revision);
    assert.ok(!fs.readFileSync(file, 'utf8').includes(host.token));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('resigning returns assets and settles loan rules without interrupting another turn', () => {
  const game = createGame(['Alice', 'Bob', 'Sam']);
  game.owners = {1:1, 3:1}; game.buildings = {1:2, 3:2};
  game.heldCards = [{deck:'chance', id:13, owner:1}]; game.decks = {chance:[]};
  game.loans = [{id:1, borrower:1, lender:0, due:110}, {id:2, borrower:2, lender:1, due:55}];
  const result = action(game, 'resign', {player:1});
  assert.equal(result.current, 0);
  assert.equal(result.players[1].resigned, true);
  assert.equal(result.players[0].money, 1610);
  assert.equal(result.owners[1], undefined);
  assert.deepEqual(result.buildings, {});
  assert.deepEqual(result.decks.chance, [13]);
  assert.equal(result.loans[0].lender, null);
  const finished = action(result, 'resign', {player:2});
  assert.equal(finished.winner, 0);
  assert.equal(finished.phase, 'finished');
  assert.throws(() => action({...game, phase:'auction'}, 'resign', {player:1}), /Finish the current/);
});

test('only the host can end a game, and players can only resign themselves', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monopoly-exit-'));
  try {
    const rooms = createRooms(path.join(dir, 'rooms.json'));
    const host = rooms.create('Alice');
    const bob = rooms.join(host.code, 'Bob');
    const sam = rooms.join(host.code, 'Sam');
    rooms.decide(host.code, host.token, 1, true);
    rooms.decide(host.code, host.token, 2, true);
    const start = rooms.start(host.code, host.token);
    assert.throws(() => rooms.perform(host.code, bob.token, 'abandon', {}, start.revision), /host/);
    const after = rooms.perform(host.code, bob.token, 'resign', {player:0}, start.revision);
    assert.equal(after.game.players[1].resigned, true);
    assert.equal(after.game.players[0].bankrupt, false);
    assert.equal(after.game.current, 0);
    assert.throws(() => rooms.perform(host.code, bob.token, 'resign', {}, after.revision), /cannot resign/);
    const ended = rooms.perform(host.code, host.token, 'abandon', {}, after.revision);
    assert.equal(ended.game.abandoned, true);
    assert.equal(ended.game.winner, null);
    assert.equal(rooms.read(host.code, sam.token).game.phase, 'abandoned');
    assert.throws(() => rooms.perform(host.code, sam.token, 'roll', {}, ended.revision), /ended/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('account-linked seats can be recovered and produce private game statistics', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monopoly-account-rooms-'));
  try {
    const rooms=createRooms(path.join(dir,'rooms.json'));
    const host=rooms.create('Alice','alice@example.com');
    const guest=rooms.join(host.code,'Bob');
    rooms.link(host.code,guest.token,'bob@example.com');
    assert.throws(()=>rooms.link(host.code,guest.token,'mallory@example.com'),/another account/);
    assert.throws(()=>rooms.rejoin(host.code,'mallory@example.com'),/No active seat/);
    const recovered=rooms.rejoin(host.code,'bob@example.com');
    assert.equal(recovered.seat,1);
    assert.equal(rooms.read(host.code,guest.token).seat,1);
    rooms.decide(host.code,host.token,1,true);
    const started=rooms.start(host.code,host.token);
    assert.equal(rooms.analytics('bob@example.com').active,1);
    rooms.perform(host.code,recovered.token,'resign',{},started.revision);
    assert.equal(rooms.analytics('alice@example.com').wins,1);
    assert.equal(rooms.analytics('bob@example.com').games[0].result,'loss');
    assert.throws(()=>rooms.rejoin(host.code,'bob@example.com'),/No active seat/);
    assert.ok(!JSON.stringify(rooms.read(host.code,host.token)).includes('bob@example.com'));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
