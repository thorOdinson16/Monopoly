import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnlineRoom from './OnlineRoom';

test('returning after a finished game offers a fresh room', async () => {
  localStorage.setItem('monopoly-room', JSON.stringify({code:'ABC', token:'secret'}));
  global.fetch = jest.fn().mockResolvedValue({ok:true, json:async () => ({code:'ABC', revision:1, game:{winner:0}})});
  render(<MemoryRouter><OnlineRoom /></MemoryRouter>);
  expect(await screen.findByText(/previous game has finished/i)).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Create room'})).toBeInTheDocument();
  expect(localStorage.getItem('monopoly-room')).toBeNull();
  delete global.fetch;
});

test('a new invitation takes precedence over a saved ended room', async () => {
  localStorage.setItem('monopoly-room', JSON.stringify({code:'OLDROOM', token:'old-token'}));
  global.fetch = jest.fn().mockResolvedValue({ok:true, json:async () => ({code:'NEWROOM', token:'new-token', seat:1, revision:1, players:[{name:'Host',approved:true},{name:'Guest',approved:false}]})});
  render(<MemoryRouter initialEntries={['/online?code=newroom']}><OnlineRoom /></MemoryRouter>);
  expect(screen.getByLabelText('Room code')).toHaveValue('NEWROOM');
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Your name'), {target:{value:'Guest'}});
  fireEvent.click(screen.getByRole('button', {name:'Join room'}));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/rooms/NEWROOM/join', expect.objectContaining({method:'POST'})));
  expect(await screen.findByText('Waiting for the host to approve you.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('monopoly-room')).code).toBe('NEWROOM');
  delete global.fetch;
});
