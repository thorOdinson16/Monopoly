import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./Signup', () => () => null);
jest.mock('./Login', () => () => null);

test('Play opens the unified game setup', () => {
  localStorage.clear();
  window.history.pushState({}, '', '/home');
  render(<App />);
  fireEvent.click(screen.getByRole('button', {name:'Play'}));
  expect(screen.getByRole('heading', {name:'Set up players'})).toBeInTheDocument();
  expect(window.location.pathname).toBe('/game');
});

test.each(['/local-game','/game2','/game3','/game5','/game6'])('old route %s redirects to the unified game', (path) => {
  localStorage.clear();
  window.history.pushState({}, '', path);
  render(<App />);
  expect(screen.getByRole('heading', {name:'Set up players'})).toBeInTheDocument();
  expect(window.location.pathname).toBe('/game');
});
