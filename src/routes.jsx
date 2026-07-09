import { lazy } from 'react'

export const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
export const RsvpPage = lazy(() => import('./rsvp/RsvpPage.jsx'))
export const WeddingPage = lazy(() => import('./wedding/WeddingPage.jsx'))
export const WishesWrappedPage = lazy(() => import('./wishes-wrapped/WishesWrappedPage.jsx'))
