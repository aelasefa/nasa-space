import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RoverApp } from './RoverApp'
import '../styles/mission.css'

createRoot(document.getElementById('root')!).render(<StrictMode><RoverApp/></StrictMode>)
