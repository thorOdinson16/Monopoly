import React from 'react';
import { Link } from 'react-router-dom';
import './RuleBook.css';

const sections = [
  ['Goal and setup', 'Two to six players start with $1,500 each. The last player who has not gone bankrupt wins. The game saves locally in your browser.'],
  ['Taking a turn', 'Roll two dice and follow the space you land on. Passing or landing on GO while moving forward pays $200. Rolling doubles gives another roll; three doubles in a row send you to jail.'],
  ['Buying and rent', 'On an unowned property, buy it at the listed price, send it to auction, or pass and leave it available. Landing on another player’s property requires rent. Select a property in the player panel to see its price and rent schedule.'],
  ['Building and selling', 'Own an entire color group to build houses evenly. Four houses can be upgraded to a hotel. The bank has 32 houses and 12 hotels. Buildings sell for half their cost and must be sold evenly. Sell all buildings in a color group before selling one of its properties to the bank for half price.'],
  ['Cards and jail', 'Chance and Community Chest cards are drawn from their available decks and applied after the reveal. To leave jail, roll doubles, pay $50 before rolling, or use a held get-out-of-jail card. After a third unsuccessful roll, pay $50 and move using that roll.'],
  ['Trades and loans', 'Offer cash, properties, or get-out-of-jail cards to another player, who can accept or decline. Sell buildings in a color group before trading its properties. Loans are a house rule: borrow up to $500 from the bank or request a player loan. Loans have a one-time 10% charge, rounded up, with voluntary partial or full repayment and no automatic deadline.'],
  ['Debt and bankruptcy', 'If you cannot pay, raise cash by selling buildings or properties, trading, or borrowing. If selling your buildings and properties still cannot cover the immediate debt, you may declare bankruptcy. Your remaining assets go to the creditor; properties returned to the bank are auctioned if the game continues. Your bank loans are written off, and the bank pays player lenders their outstanding balances.'],
];

export default function RuleBook() {
  return <main className="rulebook-container">
    <Link className="rulebook-home" to="/home">← Home</Link>
    <h1 className="rulebook-title">How to play</h1>
    <p className="rulebook-subtitle">Local game · 2 to 6 players</p>
    <div className="rulebook-content">{sections.map(([title,text])=><section className="rulebook-section" key={title}><h2 className="rulebook-section-title">{title}</h2><p className="rulebook-section-text">{text}</p></section>)}</div>
  </main>;
}
