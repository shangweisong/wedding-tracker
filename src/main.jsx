import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import AdminApp from './admin/AdminApp.jsx'
import RsvpPage from './rsvp/RsvpPage.jsx'
import WeddingPage from './wedding/WeddingPage.jsx'
import WishesWrappedPage from './wishes-wrapped/WishesWrappedPage.jsx'
import { LocaleProvider } from './i18n/index.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        {/* Public pages are multilingual (EN / 中文); admin + emails stay English. */}
        <Route path="/rsvp" element={<LocaleProvider><RsvpPage /></LocaleProvider>} />
        <Route path="/wedding/:slug" element={<LocaleProvider><WeddingPage /></LocaleProvider>} />
        <Route path="/wishes-wrapped" element={<WishesWrappedPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
