import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import AdminApp from './admin/AdminApp.jsx'
import RsvpPage from './rsvp/RsvpPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        <Route path="/rsvp" element={<RsvpPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
