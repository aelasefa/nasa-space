import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AcademyApp } from './AcademyApp'
import '../styles/mission.css'

createRoot(document.getElementById('root')!).render(<StrictMode><AcademyApp/></StrictMode>)
