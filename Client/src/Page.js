import React from 'react';
import { Link } from 'react-router-dom';
import './site.css';

export default function Page({eyebrow, title, subtitle, children}) {
  return <main className="site-shell"><header className="site-header"><Link className="site-back" to="/home">← Home</Link><Link className="site-wordmark" to="/home">MONOPOLY</Link></header><section className="site-card"><span className="site-eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p className="site-subtitle">{subtitle}</p>}{children}</section></main>;
}
