import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import AdminApp from './admin/AdminApp.jsx'
import RsvpPage from './rsvp/RsvpPage.jsx'
import WeddingPage from './wedding/WeddingPage.jsx'
import WishesWrappedPage from './wishes-wrapped/WishesWrappedPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        <Route path="/rsvp" element={<RsvpPage />} />
        <Route path="/wedding/:slug" element={<WeddingPage />} />
        <Route path="/wishes-wrapped" element={<WishesWrappedPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
