// Serializable game state and validated local-game actions. No UI or timers live here.
const names = ['GO','Mediterranean Avenue','Community Chest','Baltic Avenue','Income Tax','Reading Railroad','Oriental Avenue','Chance','Vermont Avenue','Connecticut Avenue','Jail / Visiting','St. Charles Place','Electric Company','States Avenue','Virginia Avenue','Pennsylvania Railroad','St. James Place','Community Chest','Tennessee Avenue','New York Avenue','Free Parking','Kentucky Avenue','Chance','Indiana Avenue','Illinois Avenue','B&O Railroad','Atlantic Avenue','Ventnor Avenue','Water Works','Marvin Gardens','Go to Jail','Pacific Avenue','North Carolina Avenue','Community Chest','Pennsylvania Avenue','Short Line Railroad','Chance','Park Place','Luxury Tax','Boardwalk'];
const data = {1:[60,2,'brown'],3:[60,4,'brown'],5:[200,25,'railroad'],6:[100,6,'lightblue'],8:[100,6,'lightblue'],9:[120,8,'lightblue'],11:[140,10,'pink'],12:[150,0,'utility'],13:[140,10,'pink'],14:[160,12,'pink'],15:[200,25,'railroad'],16:[180,14,'orange'],18:[180,14,'orange'],19:[200,16,'orange'],21:[220,18,'red'],23:[220,18,'red'],24:[240,20,'red'],25:[200,25,'railroad'],26:[260,22,'yellow'],27:[260,22,'yellow'],28:[150,0,'utility'],29:[280,24,'yellow'],31:[300,26,'green'],32:[300,26,'green'],34:[320,28,'green'],35:[200,25,'railroad'],37:[350,35,'blue'],39:[400,50,'blue']};
const buildingRents = {1:[10,30,90,160,250],3:[20,60,180,320,450],6:[30,90,270,400,550],8:[30,90,270,400,550],9:[40,100,300,450,600],11:[50,150,450,625,750],13:[50,150,450,625,750],14:[60,180,500,700,900],16:[70,200,550,750,950],18:[70,200,550,750,950],19:[80,220,600,800,1000],21:[90,250,700,875,1050],23:[90,250,700,875,1050],24:[100,300,750,925,1100],26:[110,330,800,975,1150],27:[110,330,800,975,1150],29:[120,360,850,1025,1200],31:[130,390,900,1100,1275],32:[130,390,900,1100,1275],34:[150,450,1000,1200,1400],37:[175,500,1100,1300,1500],39:[200,600,1400,1700,2000]};
const board = names.map((name, i) => ({name, ...(data[i] ? {price:data[i][0], rent:data[i][1], group:data[i][2]} : {}), ...(buildingRents[i] ? {buildingRents:buildingRents[i], buildingCost:i<10?50:i<20?100:i<30?150:200} : {})}));
const cards = {
 chance:[{text:'Advance to GO. Collect $200.',to:0},{text:'Advance to Illinois Avenue.',to:24},{text:'Advance to St. Charles Place.',to:11},{text:'Take a trip to Reading Railroad.',to:5},{text:'Advance to Boardwalk.',to:39},{text:'Go back three spaces.',back:3},{text:'Go directly to jail.',jail:true},{text:'Bank pays you a dividend of $50.',cash:50},{text:'Pay a speeding fine of $15.',cash:-15},{text:'Your building loan matures. Collect $150.',cash:150},{text:'Advance to the nearest Utility. If owned, roll again and pay ten times the dice.',nearest:'utility'},{text:'Advance to the nearest Railroad. If owned, pay double rent.',nearest:'railroad'},{text:'Advance to the nearest Railroad. If owned, pay double rent.',nearest:'railroad'},{text:'Get out of jail free. Keep this card until used.',getOut:true},{text:'Make general repairs: $25 per house and $100 per hotel.',repairs:[25,100]},{text:'You are Chairman of the Board. Pay each player $50.',eachPay:50}],
 chest:[{text:'Advance to GO. Collect $200.',to:0},{text:'Bank error in your favor. Collect $200.',cash:200},{text:'Doctor’s fee. Pay $50.',cash:-50},{text:'From sale of stock you get $50.',cash:50},{text:'Go directly to jail.',jail:true},{text:'Holiday fund matures. Receive $100.',cash:100},{text:'Income tax refund. Collect $20.',cash:20},{text:'Life insurance matures. Collect $100.',cash:100},{text:'Pay hospital fees of $100.',cash:-100},{text:'Pay school fees of $50.',cash:-50},{text:'Receive $25 consultancy fee.',cash:25},{text:'You won second prize in a beauty contest. Collect $10.',cash:10},{text:'You inherit $100.',cash:100},{text:'Get out of jail free. Keep this card until used.',getOut:true},{text:'It is your birthday. Collect $10 from each player.',eachCollect:10},{text:'Street repairs: $40 per house and $115 per hotel.',repairs:[40,115]}]
};
function createGame(names) {
 if (!Array.isArray(names) || names.length < 2 || names.length > 6 || names.some(n => typeof n !== 'string' || !n.trim())) throw Error('Enter names for 2 to 6 players.');
 return {version:1, players:names.map(n=>({name:n.trim(), money:1500, position:0, jail:0, bankrupt:false})), owners:{}, buildings:{}, loans:[], nextLoanId:1, current:0, phase:'roll', dice:null, doubles:0, pending:null, auction:null, log:['Game started.'], turnLog:[], winner:null};
}
function normalizeGame(state) {
 const s=JSON.parse(JSON.stringify(state));
 if(!Array.isArray(s.turnLog))s.turnLog=[];
 if(s.mortgaged){
  const old=s.mortgaged;
  const affected=Object.keys(old).some(key=>old[key]);
  if(affected){
   s.log ||= [];
   s.log.unshift('Previous mortgages were removed; properties and balances remain unchanged.');
   if(s.phase==='trade'&&s.pendingTrade&&[...(s.pendingTrade.giveProperties||[]),...(s.pendingTrade.receiveProperties||[])].some(i=>old[i])){s.phase=s.pendingTrade.returnPhase;delete s.pendingTrade;s.log.unshift('Pending trade cancelled because its terms changed.');}
  }
  delete s.mortgaged;
 }
 return s;
}
function action(state, type, payload={}) {
 const s=normalizeGame(state); const p=s.players[s.current]; s.buildings ||= {}; s.decks ||= {}; s.heldCards ||= []; s.loans ||= []; s.nextLoanId ||= 1; s.movement=[];
 const log=t=>{s.log.unshift(t);s.turnLog.unshift(t);}; const next=()=>{ if(s.winner!==null)return; do{s.current=(s.current+1)%s.players.length;}while(s.players[s.current].bankrupt); s.phase='roll';s.doubles=0;s.turnLog=[];log(`${s.players[s.current].name}'s turn begins.`); };
 const pay=(amount, creditor=null)=>{if(p.money<amount){s.pending={creditor,amount};s.phase='debt';log(`${p.name} owes $${amount} and cannot pay.`);return false;}p.money-=amount;if(creditor!==null)s.players[creditor].money+=amount;log(`${p.name} pays $${amount}${creditor===null?' to the bank':` to ${s.players[creditor].name}`}.`);return true;};
 const finish=()=>{if(s.phase==='debt')return;s.phase=s.doubles>0 && !s.players[s.current].jail?'roll':'end';};
 const jail=()=>{p.position=10;s.movement.push(10);p.jail=1;s.doubles=0;s.phase='end';log(`${p.name} goes to jail.`);};
 const land=(roll,special)=>{
  const i=p.position, space=board[i];log(`${p.name} lands on ${space.name}.`);
  if(i===30){jail();return;}
  if(i===4||i===38){pay(i===4?200:100);finish();return;}
  if([2,7,17,22,33,36].includes(i)){
   const deck=[7,22,36].includes(i)?'chance':'chest';
   if(!s.decks[deck] || !s.decks[deck].length)s.decks[deck]=cards[deck].map((_,index)=>index).filter(id=>!s.heldCards.some(held=>held.deck===deck&&held.id===id));
   const n=Number.isInteger(payload.cardRandom)&&payload.cardRandom>=0?payload.cardRandom:0;
   const id=s.decks[deck].splice(n%s.decks[deck].length,1)[0];s.pendingCard={deck,id};s.phase='card';log(`${p.name} draws ${deck==='chance'?'Chance':'Community Chest'}: ${cards[deck][id].text}`);return;
  }
  if(space.price){const owner=s.owners[i];if(owner===undefined){s.phase='buy';return;}
   if(owner!==s.current){
    const count=Object.keys(s.owners).filter(k=>s.owners[k]===owner&&board[k].group===space.group).length;
    let rent=space.rent;
    if(space.group==='railroad')rent=25*2**(count-1)*(special==='railroad'?2:1);
    else if(space.group==='utility'){if(special==='utility'){s.pendingUtility={owner};s.phase='utilityRoll';return;}rent=roll*(count===2?10:4);}
    else if(s.buildings[i])rent=space.buildingRents[s.buildings[i]-1];
    else if(Object.keys(data).filter(k=>board[k].group===space.group).every(k=>s.owners[k]===owner))rent*=2;
    pay(rent,owner);
   }
  }
  finish();
 };
 const move=(total,roll=total,special)=>{const old=p.position;const direction=total<0?-1:1;for(let step=1;step<=Math.abs(total);step++)s.movement.push((old+direction*step+40)%40);p.position=(old+total+40)%40;if(total>0&&old+total>=40){p.money+=200;log(`${p.name} collects $200 for passing GO.`);}land(roll,special);};
 const runPayments=()=>{
  const sequence=s.paymentSequence;
  while(sequence.queue.length){
   const {payer,creditor,amount}=sequence.queue.shift();
   if(s.players[payer].bankrupt || s.players[creditor].bankrupt)continue;
   const debtor=s.players[payer];
   if(debtor.money<amount){s.current=payer;s.pending={creditor,amount,paymentSequence:true};s.phase='debt';log(`${debtor.name} owes $${amount} to ${s.players[creditor].name} and cannot pay.`);return;}
   debtor.money-=amount;s.players[creditor].money+=amount;log(`${debtor.name} pays $${amount} to ${s.players[creditor].name}.`);
  }
  s.current=sequence.origin;delete s.paymentSequence;
  if(s.players[s.current].bankrupt){next();return;}s.phase='end';finish();
 };
 const settleDebt=()=>{if(s.phase==='debt' && p.money>=s.pending.amount){const debt=s.pending;s.pending=null;s.phase='end';pay(debt.amount,debt.creditor);if(debt.paymentSequence)runPayments();else if(debt.resumeMove)move(debt.resumeMove);else if(debt.releaseJail){p.jail=0;s.phase='roll';}else finish();}};
 const groupOf=i=>Object.keys(data).filter(k=>board[k].group===board[i].group);
 const supply=()=>{const levels=Object.values(s.buildings);return {houses:32-levels.reduce((sum,n)=>sum+(n<5?n:0),0),hotels:12-levels.filter(n=>n===5).length};};
 const validateLoan=(lender,principal)=>{
  if(!Number.isSafeInteger(principal)||principal<1||principal>1000000)throw Error('Enter a loan amount between $1 and $1,000,000.');
  if(lender!==null&&(!Number.isInteger(lender)||lender===s.current||!s.players[lender]||s.players[lender].bankrupt))throw Error('Choose an active lender.');
  if(lender===null&&principal>500)throw Error('A bank loan is limited to $500.');
  if(lender!==null&&s.players[lender].money<principal)throw Error('The lender does not have enough cash.');
  if(lender===null&&s.loans.some(loan=>loan.borrower===s.current&&loan.lender===null))throw Error('Repay the existing bank loan first.');
 };
 const issueLoan=(lender,principal)=>{validateLoan(lender,principal);if(lender!==null)s.players[lender].money-=principal;p.money+=principal;const due=principal+Math.ceil(principal/10);s.loans.push({id:s.nextLoanId++,borrower:s.current,lender,principal,due});log(`${p.name} borrows $${principal} from ${lender===null?'the bank':s.players[lender].name}; $${due} is owed.`);settleDebt();};
 const validateTrade=t=>{
  if(!Number.isInteger(t.partner)||t.partner===s.current||!s.players[t.partner]||s.players[t.partner].bankrupt)throw Error('Choose an active trading partner.');
  if(!Number.isSafeInteger(t.giveCash)||t.giveCash<0||!Number.isSafeInteger(t.receiveCash)||t.receiveCash<0)throw Error('Cash amounts must be non-negative whole dollars.');
  if(t.giveCash>p.money||t.receiveCash>s.players[t.partner].money)throw Error('Both players must have enough cash.');
  if(!Array.isArray(t.giveProperties)||!Array.isArray(t.receiveProperties))throw Error('Invalid property selection.');
  const all=[...t.giveProperties,...t.receiveProperties];
  if(new Set(all).size!==all.length||all.some(i=>!Number.isInteger(i)||!board[i]||!board[i].price))throw Error('Invalid property selection.');
  const giveCards=t.giveCards||[],receiveCards=t.receiveCards||[];
  if(!Array.isArray(giveCards)||!Array.isArray(receiveCards))throw Error('Invalid jail card selection.');
  const allCards=[...giveCards,...receiveCards];
  if(new Set(allCards).size!==allCards.length||allCards.some(key=>typeof key!=='string'))throw Error('Invalid jail card selection.');
  if(!t.giveCash&&!t.receiveCash&&!all.length&&!allCards.length)throw Error('Choose cash, property or a jail card to trade.');
  for(const [list,owner] of [[t.giveProperties,s.current],[t.receiveProperties,t.partner]])for(const i of list){
   if(s.owners[i]!==owner)throw Error('A selected property is no longer owned by the offering player.');
   if(groupOf(i).some(k=>s.buildings[k]))throw Error('Sell buildings in the color group before trading.');
  }
  for(const [list,owner] of [[giveCards,s.current],[receiveCards,t.partner]])for(const key of list){if(!s.heldCards.some(card=>`${card.deck}:${card.id}`===key&&card.owner===owner))throw Error('A selected jail card is no longer owned by that player.');}
 };
 const startBankruptcyAuction=()=>{const sequence=s.bankruptcyAuction;if(!sequence.properties.length){s.current=sequence.origin;delete s.bankruptcyAuction;next();return;}const property=sequence.properties.shift(),bidders=s.players.map((player,i)=>player.bankrupt?null:i).filter(i=>i!==null);s.phase='auction';s.auction={property,bidders,turn:bidders[0],bid:0,highBidder:null};log(`The bank auctions ${board[property].name}.`);};
 const advanceAuction=()=>{const a=s.auction;const remaining=a.bidders.filter(i=>i!==a.highBidder);if(!remaining.length){if(a.highBidder!==null){s.players[a.highBidder].money-=a.bid;s.owners[a.property]=a.highBidder;log(`${s.players[a.highBidder].name} wins ${board[a.property].name} for $${a.bid}.`);}else log(`No bids for ${board[a.property].name}.`);s.auction=null;if(s.bankruptcyAuction)startBankruptcyAuction();else finish();return;}let i=a.turn;do{i=(i+1)%s.players.length;}while(!remaining.includes(i));a.turn=i;};
 if(type==='resign'){
  const player=payload.player;
  if(!Number.isInteger(player)||!s.players[player]||s.players[player].bankrupt||s.winner!==null)throw Error('This player cannot resign.');
  if(!['roll','buy','end'].includes(s.phase))throw Error('Finish the current auction, offer, card or debt before resigning.');
  const departing=s.players[player];
  Object.keys(s.owners).forEach(key=>{if(s.owners[key]===player){delete s.owners[key];delete s.buildings[key];}});
  s.heldCards=s.heldCards.filter(card=>{if(card.owner!==player)return true;(s.decks[card.deck] ||= []).push(card.id);return false;});
  s.loans=s.loans.filter(loan=>{if(loan.borrower===player){if(loan.lender!==null&&!s.players[loan.lender].bankrupt){s.players[loan.lender].money+=loan.due;log(`The bank pays ${s.players[loan.lender].name} $${loan.due} for ${departing.name}'s unpaid loan.`);}return false;}if(loan.lender===player)loan.lender=null;return true;});
  departing.money=0;departing.bankrupt=true;departing.resigned=true;log(`${departing.name} resigns. Their properties return to the bank.`);
  const active=s.players.map((x,i)=>!x.bankrupt?i:null).filter(i=>i!==null);
  if(active.length===1){s.winner=active[0];s.phase='finished';log(`${s.players[s.winner].name} wins!`);}else if(player===s.current)next();
 } else if(type==='roll') {if(s.phase!=='roll')throw Error('Rolling is not available now.');const dice=payload.dice;if(!Array.isArray(dice)||dice.length!==2||dice.some(d=>!Number.isInteger(d)||d<1||d>6))throw Error('Invalid dice.');s.dice=dice;const total=dice[0]+dice[1], double=dice[0]===dice[1];log(`${p.name} rolled ${dice.join(' + ')}.`);if(p.jail){if(double){p.jail=0;s.doubles=0;}else if(p.jail<3){p.jail++;s.phase='end';return s;}else{p.jail=0;pay(50);if(s.phase==='debt'){s.pending.resumeMove=total;return s;}}}else{s.doubles=double?s.doubles+1:0;if(s.doubles===3){jail();return s;}}move(total);
 } else if(type==='buy'){if(s.phase!=='buy')throw Error('There is no property to buy.');const i=p.position;if(p.money<board[i].price)throw Error('Insufficient cash.');p.money-=board[i].price;s.owners[i]=s.current;log(`${p.name} buys ${board[i].name} for $${board[i].price}.`);finish();
 } else if(type==='passPurchase'){if(s.phase!=='buy')throw Error('There is no property to pass on.');log(`${p.name} passes on ${board[p.position].name}; it remains available.`);finish();
 } else if(type==='skip'){if(s.phase!=='buy')throw Error('There is no purchase to decline.');log(`${p.name} declines ${board[p.position].name}; auction begins.`);s.phase='auction';s.auction={property:p.position,bidders:s.players.map((x,i)=>x.bankrupt?null:i).filter(i=>i!==null),turn:s.current,bid:0,highBidder:null};
 } else if(type==='resolveCard'){
  if(s.phase!=='card'||!s.pendingCard)throw Error('There is no card to resolve.');
  const drawn=s.pendingCard,card=cards[drawn.deck][drawn.id];delete s.pendingCard;
  if(card.getOut){s.heldCards.push({deck:drawn.deck,id:drawn.id,owner:s.current});log(`${p.name} keeps a get out of jail free card.`);finish();}
  else if(card.jail)jail();
  else if(card.to!==undefined){const steps=(card.to-p.position+40)%40;move(steps,s.dice[0]+s.dice[1]);}
  else if(card.back)move(-card.back,s.dice[0]+s.dice[1]);
  else if(card.nearest){const destinations=card.nearest==='railroad'?[5,15,25,35]:[12,28];const destination=destinations.find(i=>i>p.position) ?? destinations[0];move((destination-p.position+40)%40,s.dice[0]+s.dice[1],card.nearest);}
  else if(card.repairs){const cost=Object.keys(s.owners).filter(i=>s.owners[i]===s.current).reduce((sum,i)=>{const n=s.buildings[i]||0;return sum+(n===5?card.repairs[1]:n*card.repairs[0]);},0);if(cost)pay(cost);else log(`${p.name} has no repair costs.`);finish();}
  else if(card.eachPay||card.eachCollect){const origin=s.current;const others=s.players.map((player,i)=>!player.bankrupt&&i!==origin?i:null).filter(i=>i!==null);s.paymentSequence={origin,queue:others.map(i=>card.eachPay?{payer:origin,creditor:i,amount:card.eachPay}:{payer:i,creditor:origin,amount:card.eachCollect})};runPayments();}
  else{if(card.cash<0)pay(-card.cash);else{p.money+=card.cash;log(`${p.name} collects $${card.cash}.`);}finish();}
 } else if(type==='rollUtility'){
  if(s.phase!=='utilityRoll'||!s.pendingUtility)throw Error('There is no utility rent to roll for.');const dice=payload.dice;
  if(!Array.isArray(dice)||dice.length!==2||dice.some(d=>!Number.isInteger(d)||d<1||d>6))throw Error('Invalid dice.');
  const owner=s.pendingUtility.owner;delete s.pendingUtility;log(`${p.name} rolls ${dice.join(' + ')} for utility rent.`);s.phase='end';pay((dice[0]+dice[1])*10,owner);finish();
 } else if(type==='payJail'){
  if(s.phase!=='roll'||!p.jail)throw Error('Paying to leave jail is not available now.');
  if(pay(50)){p.jail=0;s.phase='roll';log(`${p.name} leaves jail.`);}else s.pending.releaseJail=true;
 } else if(type==='useJailCard'){
  if(s.phase!=='roll'||!p.jail)throw Error('A jail card cannot be used now.');
  const index=s.heldCards.findIndex(card=>card.owner===s.current);if(index<0)throw Error('You have no get out of jail free card.');
  const held=s.heldCards.splice(index,1)[0];(s.decks[held.deck] ||= []).push(held.id);p.jail=0;log(`${p.name} uses a get out of jail free card.`);
 } else if(type==='bid'||type==='pass'){if(s.phase!=='auction')throw Error('There is no auction.');const a=s.auction, bidder=s.players[a.turn];if(type==='bid'){const amount=payload.amount;if(!Number.isSafeInteger(amount)||amount<=a.bid||amount>bidder.money)throw Error('Bid must exceed the current bid and fit your cash balance.');a.bid=amount;a.highBidder=a.turn;log(`${bidder.name} bids $${amount}.`);}else{a.bidders=a.bidders.filter(i=>i!==a.turn);log(`${bidder.name} passes.`);}advanceAuction();
 } else if(type==='proposeTrade'){
  if(!['roll','end','buy','debt'].includes(s.phase))throw Error('Trading is not available now.');
  const trade={partner:payload.partner,giveCash:payload.giveCash,receiveCash:payload.receiveCash,giveProperties:payload.giveProperties,receiveProperties:payload.receiveProperties,giveCards:payload.giveCards||[],receiveCards:payload.receiveCards||[],returnPhase:s.phase};validateTrade(trade);s.pendingTrade=trade;s.phase='trade';log(`${p.name} offers a trade to ${s.players[trade.partner].name}.`);
 } else if(type==='acceptTrade'||type==='rejectTrade'){
  if(s.phase!=='trade'||!s.pendingTrade)throw Error('There is no trade to respond to.');
  const t=s.pendingTrade;validateTrade(t);s.phase=t.returnPhase;delete s.pendingTrade;
  if(type==='acceptTrade'){p.money+=t.receiveCash-t.giveCash;s.players[t.partner].money+=t.giveCash-t.receiveCash;t.giveProperties.forEach(i=>{s.owners[i]=t.partner;});t.receiveProperties.forEach(i=>{s.owners[i]=s.current;});s.heldCards.forEach(card=>{const key=`${card.deck}:${card.id}`;if((t.giveCards||[]).includes(key))card.owner=t.partner;else if((t.receiveCards||[]).includes(key))card.owner=s.current;});log(`${s.players[t.partner].name} accepts ${p.name}'s trade.`);settleDebt();}
  else log(`${s.players[t.partner].name} declines ${p.name}'s trade.`);
 } else if(type==='requestLoan'){
  if(!['roll','end','buy','debt'].includes(s.phase))throw Error('Loans are not available now.');
  const {lender,principal}=payload;validateLoan(lender,principal);
  if(lender===null)issueLoan(null,principal);else{s.pendingLoan={lender,principal,returnPhase:s.phase};s.phase='loanOffer';log(`${p.name} requests $${principal} from ${s.players[lender].name}.`);}
 } else if(type==='acceptLoan'||type==='rejectLoan'){
  if(s.phase!=='loanOffer'||!s.pendingLoan)throw Error('There is no loan request to respond to.');
  const request=s.pendingLoan;validateLoan(request.lender,request.principal);s.phase=request.returnPhase;delete s.pendingLoan;
  if(type==='acceptLoan')issueLoan(request.lender,request.principal);else log(`${s.players[request.lender].name} declines ${p.name}'s loan request.`);
 } else if(type==='repayLoan'){
  if(!['roll','end','buy'].includes(s.phase))throw Error('Resolve your current decision or debt before repaying a loan.');
  const index=s.loans.findIndex(loan=>loan.id===payload.id&&loan.borrower===s.current);if(index<0)throw Error('Choose one of your outstanding loans.');
  const loan=s.loans[index];if(p.money<loan.due)throw Error('You need enough cash to repay the full loan.');
  p.money-=loan.due;if(loan.lender!==null)s.players[loan.lender].money+=loan.due;s.loans.splice(index,1);log(`${p.name} repays $${loan.due} to ${loan.lender===null?'the bank':s.players[loan.lender].name}.`);
 } else if(type==='build'||type==='sellBuilding'||type==='sellBuildingGroup'){
  if(!['roll','end','buy','debt'].includes(s.phase))throw Error('Building management is not available now.');
  const i=Number(payload.property);if(!Number.isInteger(i)||s.owners[i]!==s.current||!board[i]||!board[i].buildingCost)throw Error('Choose an owned color property.');
  const group=groupOf(i), level=s.buildings[i]||0, levels=group.map(k=>s.buildings[k]||0), available=supply();
  if(type==='sellBuildingGroup'){
   if(available.houses>=4 || !levels.includes(5))throw Error('Group liquidation is available when a hotel cannot be exchanged for four houses.');
   if(!group.every(k=>s.owners[k]===s.current))throw Error('Own the entire color group to sell its buildings.');
   const proceeds=group.reduce((sum,k)=>sum+(s.buildings[k]||0)*board[k].buildingCost/2,0);
   group.forEach(k=>delete s.buildings[k]);p.money+=proceeds;log(`${p.name} sells all buildings in the ${board[i].group} group for $${proceeds}.`);settleDebt();
  }else if(type==='build'){
   if(s.phase==='debt')throw Error('Resolve your debt before building.');
   if(!group.every(k=>s.owners[k]===s.current))throw Error('Own the entire color group before building.');
   if(level>=5)throw Error('This property already has a hotel.');
   if(level!==Math.min(...levels))throw Error('Build evenly across the color group.');
   if(level===4 ? available.hotels<1 : available.houses<1)throw Error(level===4?'No hotels are available.':'No houses are available.');
   if(p.money<board[i].buildingCost)throw Error('Insufficient cash to build.');
   p.money-=board[i].buildingCost;s.buildings[i]=level+1;log(`${p.name} builds ${level===4?'a hotel':'a house'} on ${board[i].name} for $${board[i].buildingCost}.`);
  }else{
   if(level===0)throw Error('There is no building to sell.');
   if(level!==Math.max(...levels))throw Error('Sell buildings evenly across the color group.');
   if(level===5 && available.houses<4)throw Error('Four houses must be available to sell a hotel.');
   s.buildings[i]=level-1;if(!s.buildings[i])delete s.buildings[i];p.money+=board[i].buildingCost/2;log(`${p.name} sells ${level===5?'a hotel':'a house'} on ${board[i].name} for $${board[i].buildingCost/2}.`);settleDebt();
  }
 } else if(type==='sellProperty'){
  if(!['roll','end','buy','debt'].includes(s.phase))throw Error('Property sales are not available now.');
  const i=Number(payload.property);if(!Number.isInteger(i)||!board[i]||!board[i].price||s.owners[i]!==s.current)throw Error('Choose a property you own.');
  if(groupOf(i).some(k=>s.buildings[k]))throw Error('Sell all buildings in this color group before selling the property.');
  delete s.owners[i];const amount=board[i].price/2;p.money+=amount;log(`${p.name} sells ${board[i].name} to the bank for $${amount}.`);settleDebt();
 } else if(type==='end'){if(s.phase!=='end')throw Error('Finish the current decision first.');next();
 } else if(type==='bankrupt'){if(s.phase!=='debt')throw Error('Bankruptcy is only available when in debt.');const creditor=s.pending.creditor;const hadPaymentSequence=!!s.pending.paymentSequence;const returnedProperties=creditor===null?Object.keys(s.owners).filter(k=>s.owners[k]===s.current).map(Number):[];const buildingValue=Object.keys(s.owners).filter(k=>s.owners[k]===s.current).reduce((sum,k)=>sum+(s.buildings[k]||0)*(board[k].buildingCost||0)/2,0);const propertySaleValue=Object.keys(s.owners).filter(k=>s.owners[k]===s.current).reduce((sum,k)=>sum+board[k].price/2,0);if(p.money+buildingValue+propertySaleValue>=s.pending.amount)throw Error('Sell buildings or properties to pay this debt before declaring bankruptcy.');p.money+=buildingValue;Object.keys(s.owners).filter(k=>s.owners[k]===s.current).forEach(k=>delete s.buildings[k]);if(creditor!==null)s.players[creditor].money+=p.money;Object.keys(s.owners).forEach(k=>{if(s.owners[k]===s.current){if(creditor===null){delete s.owners[k];}else s.owners[k]=creditor;}});s.heldCards=s.heldCards.filter(card=>{if(card.owner!==s.current)return true;if(creditor!==null){card.owner=creditor;return true;}(s.decks[card.deck] ||= []).push(card.id);return false;});s.loans=s.loans.filter(loan=>{if(loan.borrower===s.current){if(loan.lender===null)log(`${p.name}'s bank loan of $${loan.due} is written off in bankruptcy.`);else{s.players[loan.lender].money+=loan.due;log(`The bank pays ${s.players[loan.lender].name} $${loan.due} for ${p.name}'s unpaid loan.`);}return false;}if(loan.lender===s.current){if(creditor===loan.borrower){log(`${s.players[loan.borrower].name}'s loan is cancelled because they inherit the claim.`);return false;}loan.lender=creditor;log(`A loan owed by ${s.players[loan.borrower].name} transfers to ${creditor===null?'the bank':s.players[creditor].name}.`);}return true;});p.money=0;p.bankrupt=true;log(`${p.name} is bankrupt.`);s.pending=null;const active=s.players.map((x,i)=>!x.bankrupt?i:null).filter(x=>x!==null);if(active.length===1){s.winner=active[0];s.phase='finished';delete s.paymentSequence;log(`${s.players[s.winner].name} wins!`);}else if(hadPaymentSequence)runPayments();else if(returnedProperties.length){s.bankruptcyAuction={origin:s.current,properties:returnedProperties};startBankruptcyAuction();}else next();
 } else throw Error('Unknown action.');return s;
}
module.exports={board,cards,createGame,normalizeGame,action};
