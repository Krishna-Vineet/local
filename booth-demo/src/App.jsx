import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BoothProvider } from './context/BoothContext'
import Setup from './pages/Setup'
import Start from './pages/booth/Start'
import Orientation from './pages/booth/Orientation'
import Templates from './pages/booth/Templates'
import Prints from './pages/booth/Prints'
import Payment from './pages/booth/Payment'
import Camera from './pages/booth/Camera'
import Photos from './pages/booth/Photos'
import Customize from './pages/booth/Customize'
import Success from './pages/booth/Success'

export default function App(){
  return (
    <BoothProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Setup/>} />
          <Route path="/experience" element={<Navigate to="/" replace />} />
          <Route path="/setup" element={<Navigate to="/" replace />} />
          <Route path="/booth/start" element={<Start/>} />
          <Route path="/booth/orientation" element={<Orientation/>} />
          <Route path="/booth/templates" element={<Templates/>} />
          <Route path="/booth/prints" element={<Prints/>} />
          <Route path="/booth/payment" element={<Payment/>} />
          <Route path="/booth/camera" element={<Camera/>} />
          <Route path="/booth/photos" element={<Photos/>} />
          <Route path="/booth/customize" element={<Customize/>} />
          <Route path="/booth/success" element={<Success/>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BoothProvider>
  )
}
