import React from 'react';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Profile from './Profile';
import {accountRequest} from './data/accountApi';

jest.mock('./data/accountApi');
beforeEach(()=>{localStorage.clear();accountRequest.mockReset();});

test('account backup uses the loaded revision and restore requires confirmation', async()=>{
  const saved={game:null,results:[],players:['Sam']};
  accountRequest.mockImplementation(path=>path==='/state'?Promise.resolve({revision:3,data:saved}):Promise.resolve({}));
  render(<MemoryRouter><Profile user={{name:'Alex',email:'alex@example.test'}} onAuthenticated={jest.fn()} onSignOut={jest.fn()} /></MemoryRouter>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Restore saved data'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Restore saved data'}));
  expect(localStorage.getItem('monopoly-local-players-v1')).toBeNull();
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button',{name:'Restore'}));
  expect(JSON.parse(localStorage.getItem('monopoly-local-players-v1'))).toEqual(['Sam']);
  fireEvent.click(screen.getByRole('button',{name:'Save this device'}));
  await waitFor(()=>expect(accountRequest).toHaveBeenCalledWith('/state',expect.objectContaining({method:'PUT',body:expect.stringContaining('"revision":3')})));
});

test('changing a password signs the user out after success', async()=>{
  accountRequest.mockImplementation(path=>path==='/state'?Promise.resolve({revision:0,data:null}):Promise.resolve({ok:true}));
  const update=jest.fn();
  render(<MemoryRouter><Profile user={{name:'Alex',email:'alex@example.test'}} onAuthenticated={update} onSignOut={jest.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Current password'),{target:{value:'old-password'}});
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'new-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Change password'}));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(null));
  expect(accountRequest).toHaveBeenCalledWith('/change-password',expect.objectContaining({method:'POST'}));
});
