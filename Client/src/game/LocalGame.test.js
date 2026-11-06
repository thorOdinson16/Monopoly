import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LocalGame from './LocalGame';
import { action, createGame } from './engine';

test('dice settle before the pawn moves and controls unlock afterwards', () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  localStorage.clear();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Start game'}));
  expect(within(screen.getByLabelText('Monopoly board')).getByRole('button', {name:'End turn'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'Roll dice'}));
  expect(screen.getByLabelText('Rolling dice')).toBeInTheDocument();
  expect(screen.getByLabelText('Player 1: GO')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('monopoly-local-game-v1')).players[0].position).toBe(2);
  expect(screen.getByRole('button', {name:'Roll dice'})).toBeDisabled();
  act(() => jest.advanceTimersByTime(900));
  expect(screen.getByLabelText('Dice: 1 and 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Player 1: GO')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(800));
  expect(screen.getByLabelText('Player 1: Mediterranean Avenue')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(440));
  expect(screen.getByLabelText('Player 1: Community Chest')).toBeInTheDocument();
  expect(screen.getByRole('dialog', {name:'Community Chest'})).toBeInTheDocument();
  expect(screen.getByText('Drawing…')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(7000));
  expect(screen.getByRole('status', {name:''})).toHaveTextContent('Selected: Advance to GO. Collect $200.');
  act(() => jest.advanceTimersByTime(2999));
  expect(screen.getByRole('dialog', {name:'Community Chest'})).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole('dialog', {name:'Community Chest'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Player 1: Community Chest')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(150));
  expect(screen.getByLabelText('Player 1: Baltic Avenue')).toBeInTheDocument();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('online card closes before its resulting movement starts', () => {
  jest.useFakeTimers();
  const drawn = action(createGame(['Alex', 'Sam']), 'roll', {dice:[1,1], cardRandom:0});
  const resolved = action(drawn, 'resolveCard', {cardRandom:0});
  const room = {game:drawn, seat:0, code:'TEST', revision:1};
  const view = render(<MemoryRouter><LocalGame online={{room, send:jest.fn()}} /></MemoryRouter>);
  expect(screen.getByRole('dialog', {name:'Community Chest'})).toBeInTheDocument();
  view.rerender(<MemoryRouter><LocalGame online={{room:{...room, game:resolved, revision:2, lastAction:'resolveCard'}, send:jest.fn()}} /></MemoryRouter>);
  expect(screen.queryByRole('dialog', {name:'Community Chest'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Alex: Community Chest')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(150));
  expect(screen.getByLabelText('Alex: Baltic Avenue')).toBeInTheDocument();
  view.unmount();
  jest.useRealTimers();
});

test('sound can be muted before rolling', () => {
  jest.useFakeTimers();
  const createAudio = jest.fn();
  window.AudioContext = createAudio;
  localStorage.clear();
  const view = render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Sound on'}));
  expect(screen.getByRole('button', {name:'Sound off'})).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', {name:'Start game'}));
  fireEvent.click(screen.getByRole('button', {name:'Roll dice'}));
  expect(createAudio).not.toHaveBeenCalled();
  view.unmount();
  delete window.AudioContext;
  jest.useRealTimers();
});

test('pawn movement plays a tap for each square', () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  const param = {setValueAtTime:jest.fn(), exponentialRampToValueAtTime:jest.fn()};
  const oscillator = jest.fn(() => ({frequency:param, connect:jest.fn(), start:jest.fn(), stop:jest.fn()}));
  window.AudioContext = jest.fn(() => ({currentTime:0, sampleRate:100, destination:{}, createBuffer:()=>({getChannelData:()=>new Float32Array(6)}), createBufferSource:()=>({connect:jest.fn(),start:jest.fn(),stop:jest.fn()}), createBiquadFilter:()=>({frequency:{}, Q:{},connect:jest.fn()}), createGain:()=>({gain:param,connect:jest.fn()}), createOscillator:oscillator, close:()=>Promise.resolve()}));
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(createGame(['Alex', 'Sam'])));
  const view = render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Roll dice'}));
  const diceSounds = oscillator.mock.calls.length;
  act(() => jest.advanceTimersByTime(1700));
  expect(oscillator).toHaveBeenCalledTimes(diceSounds + 1);
  act(() => jest.advanceTimersByTime(220));
  expect(oscillator).toHaveBeenCalledTimes(diceSounds + 2);
  view.unmount();
  delete window.AudioContext;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('online dice play sound on the rolling player’s click', () => {
  const createAudio = jest.fn(() => { throw new Error('No audio device in test'); });
  window.AudioContext = createAudio;
  const game = createGame(['Alex', 'Sam']);
  const send = jest.fn().mockResolvedValue({});
  render(<MemoryRouter><LocalGame online={{room:{game, seat:0, code:'TEST', revision:1}, send}} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Roll dice'}));
  expect(createAudio).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('roll', expect.any(Object));
  delete window.AudioContext;
});

test('properties and balances are in separate panels, with a closable activity drawer', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1440,position:1,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{1:0},mortgaged:{},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:['Alex buys Mediterranean Avenue.'],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  const overview = screen.getByRole('complementary', {name:'Player properties'});
  const balances = screen.getByRole('region', {name:'Player balances'});
  expect(overview).toHaveTextContent('Alex');
  expect(balances).toHaveTextContent('$1440');
  expect(overview).not.toHaveTextContent('$1440');
  expect(overview).toHaveTextContent('Mediterranean Avenue');
  expect(overview).toHaveTextContent('Sam');
  fireEvent.click(screen.getByRole('button', {name:'Activity log'}));
  expect(screen.getByRole('complementary', {name:'Activity log'})).toHaveTextContent('Alex buys Mediterranean Avenue.');
  fireEvent.click(screen.getByRole('button', {name:'Close activity log'}));
  expect(screen.queryByRole('complementary', {name:'Activity log'})).not.toBeInTheDocument();
});

test('local player order stays stable and property management is above activity', () => {
  const game = createGame(['Alex', 'Sam']);
  game.current = 1;
  game.owners[1] = 1;
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  const overview = screen.getByRole('complementary', {name:'Player properties'});
  expect(within(overview).getAllByRole('article')[0]).toHaveTextContent('Alex');
  expect(within(overview).getByText('Playing')).toBeInTheDocument();
  expect(screen.getByText('Manage properties').compareDocumentPosition(screen.getByText('This turn')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('turn highlights stay short while the activity log retains every entry', () => {
  const game = createGame(['Alex', 'Sam']);
  game.turnLog = ['Alex buys Boardwalk.', 'Sam passes.', 'Alex pays $50.', 'Alex lands on Boardwalk.', 'Alex rolled 2 + 3.', "Alex's turn begins."];
  game.log = [...game.turnLog];
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  const highlights = screen.getByRole('region', {name:"This turn's activity"});
  expect(within(highlights).getAllByRole('listitem')).toHaveLength(3);
  expect(highlights).not.toHaveTextContent('Sam passes.');
  fireEvent.click(screen.getByRole('button', {name:'Activity log'}));
  expect(screen.getByRole('complementary', {name:'Activity log'})).toHaveTextContent('Sam passes.');
});

test('online player keeps their own properties first across turns', () => {
  const game = createGame(['Alex', 'Sam']);
  const room = {game, seat:1, code:'TEST', revision:1};
  const view = render(<MemoryRouter><LocalGame online={{room, send:jest.fn()}} /></MemoryRouter>);
  const overview = screen.getByRole('complementary', {name:'Player properties'});
  expect(within(overview).getAllByRole('article')[0]).toHaveTextContent('Sam');
  view.rerender(<MemoryRouter><LocalGame online={{room:{...room, game:{...game,current:1}, revision:2}, send:jest.fn()}} /></MemoryRouter>);
  expect(within(overview).getAllByRole('article')[0]).toHaveTextContent('Sam');
  expect(screen.getByLabelText('Monopoly board')).not.toContainElement(screen.getByRole('region', {name:'Player balances'}));
  expect(screen.getByRole('region', {name:'Player balances'}).compareDocumentPosition(screen.getByLabelText('Monopoly board')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('online host can end the game and another player can resign', () => {
  const game = createGame(['Alex', 'Sam', 'Pat']);
  const send = jest.fn().mockResolvedValue({});
  const room = {game, seat:0, code:'TEST', revision:1};
  const view = render(<MemoryRouter><LocalGame online={{room, send}} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'End game for everyone'}));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', {name:'End game for everyone?'})).getByRole('button', {name:'End game'}));
  expect(send).toHaveBeenCalledWith('abandon', undefined);
  view.rerender(<MemoryRouter><LocalGame online={{room:{...room, seat:1}, send}} /></MemoryRouter>);
  expect(screen.queryByRole('button', {name:'End game for everyone'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Resign'}));
  fireEvent.click(within(screen.getByRole('dialog', {name:'Resign from game?'})).getByRole('button', {name:'Resign'}));
  expect(send).toHaveBeenCalledWith('resign', undefined);
});

test('building controls update a property and its owner balance', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:0,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{1:0,3:0},mortgaged:{},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getAllByRole('button', {name:'Build ? $50'})[0]);
  expect(screen.getByRole('complementary', {name:'Player properties'})).toHaveTextContent('Mediterranean Avenue - 1 house');
  expect(screen.getByRole('region', {name:'Player balances'})).toHaveTextContent('$1450');
  expect(screen.getByTitle('1 house')).toBeInTheDocument();
});

test('board property cards allow the owner to build, sell a house and sell the property', () => {
  const game = createGame(['Alex', 'Sam']);
  game.owners = {1:0, 3:0};
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(within(screen.getByLabelText('Monopoly board')).getByRole('button', {name:'View Mediterranean Avenue details'}));
  const card = screen.getByRole('dialog', {name:'Mediterranean Avenue'});
  fireEvent.click(within(card).getByRole('button', {name:'Build house - $50'}));
  expect(card).toHaveTextContent('1 house');
  fireEvent.click(within(card).getByRole('button', {name:'Sell house - $25'}));
  fireEvent.click(within(card).getByRole('button', {name:'Sell property - $30'}));
  expect(card).toHaveTextContent('Owned by Bank');
  expect(within(card).queryByText('Manage this property')).not.toBeInTheDocument();
});

test('landing on an owned complete set opens a build prompt after movement', () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  const game = createGame(['Alex', 'Sam']);
  game.players[0].position = 39;
  game.owners = {1:0, 3:0};
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Roll dice'}));
  expect(screen.queryByRole('dialog', {name:'Mediterranean Avenue'})).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(2500));
  const card = screen.getByRole('dialog', {name:'Mediterranean Avenue'});
  expect(card).toHaveTextContent('You can build a house here for $50.');
  fireEvent.click(within(card).getByRole('button', {name:'Build house - $50'}));
  expect(card).toHaveTextContent('1 house');
  fireEvent.click(within(card).getByRole('button', {name:'Close'}));
  expect(screen.queryByRole('dialog', {name:'Mediterranean Avenue'})).not.toBeInTheDocument();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('board spaces without properties open a details card', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(createGame(['Alex', 'Sam'])));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(within(screen.getByLabelText('Monopoly board')).getByRole('button', {name:'View GO details'}));
  expect(screen.getByRole('dialog', {name:'GO'})).toHaveTextContent('cannot be purchased');
});

test('landing on an unowned property opens a purchase popup with all options', () => {
  const game = createGame(['Alex', 'Sam']);
  game.players[0].position = 1;
  game.phase = 'buy';
  game.owners[3] = 0;
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  const dialog = screen.getByRole('dialog', {name:'Mediterranean Avenue'});
  for (const name of ['Buy property','Decline and auction','Pass and move on','Propose trade','Request loan']) expect(within(dialog).getByRole('button', {name})).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', {name:'Manage my properties'}));
  expect(screen.queryByRole('dialog', {name:'Mediterranean Avenue'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Return to purchase decision'}));
  fireEvent.click(within(screen.getByRole('dialog', {name:'Mediterranean Avenue'})).getByRole('button', {name:'Pass and move on'}));
  expect(screen.queryByRole('dialog', {name:'Mediterranean Avenue'})).not.toBeInTheDocument();
});

test('players can offer and accept a property trade', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:0,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{1:0},mortgaged:{},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Propose trade'}));
  fireEvent.click(screen.getByLabelText('Mediterranean Avenue'));
  fireEvent.change(screen.getByLabelText('Cash requested'),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'Offer trade'}));
  expect(screen.getByText('Trade offer for Sam')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Accept trade'}));
  expect(screen.getByRole('region',{name:'Player balances'})).toHaveTextContent('$1600');
  expect(screen.getByTitle('Owned by Sam')).toBeInTheDocument();
});

test('a player loan is approved and repaid', () => {
  localStorage.clear();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', {name:'Start game'}));
  fireEvent.click(screen.getByRole('button', {name:'Request loan'}));
  fireEvent.change(screen.getByLabelText('Lender'), {target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Loan amount'), {target:{value:'100'}});
  expect(screen.getByRole('dialog')).toHaveTextContent('Total to repay: $110');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name:'Request loan'}));
  expect(screen.getByText('Loan request for Player 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Approve loan'}));
  expect(screen.getByRole('region', {name:'Outstanding loans'})).toHaveTextContent('Player 1 owes $110 to Player 2');
  fireEvent.click(screen.getByRole('button', {name:'Repay'}));
  fireEvent.click(screen.getByRole('button', {name:'Make payment'}));
  expect(screen.queryByRole('region', {name:'Outstanding loans'})).not.toBeInTheDocument();
});

test('a player can repay part of a loan and see the remaining balance', () => {
  const game=createGame(['Alex','Sam']);
  game.loans=[{id:1,borrower:0,lender:1,principal:100,due:110}];
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Repay'}));
  fireEvent.change(screen.getByLabelText('Repayment amount'),{target:{value:'40'}});
  fireEvent.click(screen.getByRole('button',{name:'Make payment'}));
  expect(screen.getByRole('region',{name:'Outstanding loans'})).toHaveTextContent('Alex owes $70 to Sam');
  expect(screen.getByRole('region',{name:'Player balances'})).toHaveTextContent('$1540');
});

test('a jailed player can use a held card to leave jail', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:10,jail:1,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{},mortgaged:{},heldCards:[{deck:'chance',id:13,owner:0}],decks:{chance:[]},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Use jail card'}));
  expect(screen.queryByRole('button',{name:'Use jail card'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Roll dice'})).toBeEnabled();
});

test('utility card prompts for a separate rent roll', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:28,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{28:1},mortgaged:{},current:0,phase:'utilityRoll',pendingUtility:{owner:1},dice:[1,2],doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Roll utility dice'})).toBeEnabled();
  expect(screen.getByRole('button',{name:'Roll dice'})).toBeDisabled();
});

test('owned property opens a card with prices and full rent schedule', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:0,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{39:1},mortgaged:{},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(within(screen.getByRole('complementary', {name:'Player properties'})).getByRole('button',{name:'View Boardwalk details'}));
  const card=screen.getByRole('dialog',{name:'Boardwalk'});
  expect(card).toHaveTextContent('Purchase price$400');
  expect(card).toHaveTextContent('Sale price to bank$200');
  expect(card).toHaveTextContent('Hotel upgrade$200 + 4 houses');
  expect(card).toHaveTextContent('Hotel$2000');
  fireEvent.click(within(card).getByRole('button',{name:'Close'}));
  expect(screen.queryByRole('dialog',{name:'Boardwalk'})).not.toBeInTheDocument();
});

test('old saves keep their properties and allow property and jail card trades', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:0,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{1:0},mortgaged:{1:true},heldCards:[{deck:'chance',id:13,owner:0}],current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Propose trade'}));
  fireEvent.click(screen.getByLabelText('Mediterranean Avenue'));
  fireEvent.click(screen.getByLabelText('Chance get-out-of-jail card'));
  fireEvent.click(screen.getByRole('button',{name:'Offer trade'}));
  expect(screen.getByText(/chance jail card/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Accept trade'}));
  expect(screen.getByTitle('Owned by Sam')).toBeInTheDocument();
});

test('selling an owned property pays half price and removes ownership', () => {
  localStorage.setItem('monopoly-local-game-v1', JSON.stringify({version:1,players:[{name:'Alex',money:1500,position:0,jail:0,bankrupt:false},{name:'Sam',money:1500,position:0,jail:0,bankrupt:false}],owners:{1:0},current:0,phase:'roll',dice:null,doubles:0,pending:null,log:[],winner:null}));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Sell to bank ? $30'}));
  expect(screen.getByRole('region',{name:'Player balances'})).toHaveTextContent('$1530');
  expect(screen.queryByTitle('Owned by Alex')).not.toBeInTheDocument();
});

test('saving and reopening a resolved card debt does not repeat payments', () => {
  let s=createGame(['A','B','C','D']);s.phase='card';s.pendingCard={deck:'chance',id:15};s.dice=[1,2];s.players[0].position=7;s.players[0].money=60;s.owners[5]=0;
  s=action(s,'resolveCard');
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(s));
  const first=render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Sell to bank ? $100'}));
  expect(JSON.parse(localStorage.getItem('monopoly-local-game-v1')).players.map(p=>p.money)).toEqual([10,1550,1550,1550]);
  first.unmount();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(JSON.parse(localStorage.getItem('monopoly-local-game-v1')).players.map(p=>p.money)).toEqual([10,1550,1550,1550]);
  expect(screen.getByRole('button',{name:'End turn'})).toBeEnabled();
});

test('saving and reopening a bankruptcy auction preserves passes and the auction queue', () => {
  let s=createGame(['A','B','C']);s.owners={1:0,3:0};s.players[0].money=0;s.phase='debt';s.pending={amount:100,creditor:null};
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(s));
  const first=render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Declare bankruptcy'}));
  expect(screen.getByText('Auction: Mediterranean Avenue')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Pass'}));
  first.unmount();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByText('Auction: Mediterranean Avenue')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Pass'}));
  expect(screen.getByText('Auction: Baltic Avenue')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Pass'}));
  fireEvent.click(screen.getByRole('button',{name:'Pass'}));
  expect(screen.getByText("B's turn")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('monopoly-local-game-v1')).owners).toEqual({});
});

test('players can inspect an unowned property before deciding and see when they cannot afford it', () => {
  const game=createGame(['Alex','Sam']);game.players[0].position=1;game.players[0].money=30;game.phase='buy';
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Buy property'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Decline and auction'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'View property details'}));
  expect(screen.getByRole('dialog',{name:'Mediterranean Avenue'})).toHaveTextContent('Owned by Bank');
});

test('property actions explain why uneven building and selling are unavailable', () => {
  const game=createGame(['Alex','Sam']);game.owners={1:0,3:0};game.buildings={1:1};
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Build ? $50'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Sell to bank ? $30'})).toBeDisabled();
  expect(screen.getByText('Build evenly across the color group.')).toBeInTheDocument();
  expect(screen.getByText('Sell all buildings in this color group before selling a property.')).toBeInTheDocument();
});

test('current-turn activity remains visible, survives reload and resets on the next turn', () => {
  const game=createGame(['Alex','Sam']);game.owners={1:0};game.phase='end';
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(game));
  const first=render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Sell to bank ? $30'}));
  expect(screen.getByRole('region',{name:"This turn's activity"})).toHaveTextContent('Alex sells Mediterranean Avenue to the bank for $30.');
  first.unmount();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByRole('region',{name:"This turn's activity"})).toHaveTextContent('Alex sells Mediterranean Avenue to the bank for $30.');
  fireEvent.click(screen.getByRole('button',{name:'End turn'}));
  expect(screen.getByRole('region',{name:"This turn's activity"})).toHaveTextContent('Key actions will appear here.');
  expect(screen.getByRole('region',{name:"This turn's activity"})).not.toHaveTextContent('Alex sells Mediterranean');
  fireEvent.click(screen.getByRole('button',{name:'Activity log'}));
  expect(screen.getByRole('complementary',{name:'Activity log'})).toHaveTextContent('Alex sells Mediterranean Avenue');
});

test('a player who cannot afford a property can pass without an auction', () => {
  const game=createGame(['Alex','Sam']);game.players[0].position=1;game.players[0].money=0;game.phase='buy';
  localStorage.setItem('monopoly-local-game-v1',JSON.stringify(game));
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Buy property'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Pass and move on'}));
  expect(screen.getByRole('button',{name:'End turn'})).toBeEnabled();
  expect(screen.queryByText(/Auction:/)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('monopoly-local-game-v1')).owners).toEqual({});
});

test('reopening during a roll resumes the committed landing instead of allowing a reroll', () => {
  jest.useFakeTimers();jest.spyOn(Math,'random').mockReturnValue(0);localStorage.clear();
  const first=render(<MemoryRouter><LocalGame /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Start game'}));
  fireEvent.click(screen.getByRole('button',{name:'Roll dice'}));
  first.unmount();
  render(<MemoryRouter><LocalGame /></MemoryRouter>);
  expect(screen.getByLabelText('Player 1: Community Chest')).toBeInTheDocument();
  expect(screen.getByRole('dialog',{name:'Community Chest'})).toHaveTextContent('Advance to GO. Collect $200.');
  expect(screen.getByRole('button',{name:'Roll dice'})).toBeDisabled();
  jest.restoreAllMocks();jest.useRealTimers();
});
