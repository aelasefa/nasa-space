import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createGame } from './app/controller'
import { engine } from './app/engine'
import type { Storage } from './app/save'
import './styles/mission.css'

const storage: Storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
}
const game = createGame(engine, storage)
createRoot(document.getElementById('root')!).render(<StrictMode><App game={game}/></StrictMode>)
