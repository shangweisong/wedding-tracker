import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { LocaleProvider } from './i18n/index.jsx'

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const RsvpPage = lazy(() => import('./rsvp/RsvpPage.jsx'))
const WeddingPage = lazy(() => import('./wedding/WeddingPage.jsx'))
const WishesWrappedPage = lazy(() => import('./wishes-wrapped/WishesWrappedPage.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route path="/" element={<AdminApp />} />
          {/* Public pages are multilingual (EN / 中文); admin + emails stay English. */}
          <Route path="/rsvp" element={<LocaleProvider><RsvpPage /></LocaleProvider>} />
          <Route path="/wedding/:slug" element={<LocaleProvider><WeddingPage /></LocaleProvider>} />
          <Route path="/wishes-wrapped" element={<WishesWrappedPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
