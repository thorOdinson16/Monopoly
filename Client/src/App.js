import {useEffect, useRef, useState} from 'react'
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css'
import Signup from './Signup'
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom'
import Login from './Login';
import Home from './home';
import Leaderboard from './LeaderBoard';
import Profile from './Profile'
import Rulebook from './rulebook';
import Addfriend from './addfriend';
import LocalGame from './game/LocalGame';
import { accountRequest } from './data/accountApi';

function App() {
  const [user, setUser] = useState(null);
  const authVersion = useRef(0);
  useEffect(() => {let active=true;const version=authVersion.current;accountRequest('/session').then(result=>{if(active && authVersion.current===version)setUser(result.user);}).catch(()=>{});return ()=>{active=false;};}, []);
  const authenticated = next => {authVersion.current++;setUser(next);};
  const signOut = async () => {await accountRequest('/logout',{method:'POST'});authVersion.current++;setUser(null);};
  return (
    <div>

      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate to='/home' replace />} />
          <Route path='/game' element={<LocalGame />} />
          <Route path='/local-game' element={<Navigate to='/game' replace />} />
          <Route path='/register' element={<Signup onAuthenticated={authenticated}/>}></Route>
          <Route 
            path='/login' 
            element={<Login onAuthenticated={authenticated} />} 
          />
          <Route 
            path='/home' 
            element={<Home user={user} />
            } 
          />
          <Route path='/leaderboard' element={<Leaderboard/>}></Route>
          <Route path='/profile' element={<Profile user={user} onSignOut={signOut}/>}></Route>
        <Route path='/game2' element={<Navigate to='/game' replace />}/>
        <Route path='/game3' element={<Navigate to='/game' replace />}/>
        <Route path='/game5' element={<Navigate to='/game' replace />}/>
        <Route path='/game6' element={<Navigate to='/game' replace />}/>

        <Route path='/rulebook' element={<Rulebook/>}></Route>
        <Route path='/addfriend' element={<Addfriend/>}></Route>

        </Routes>
      </BrowserRouter>
      
    </div>
  );
}

export default App;

