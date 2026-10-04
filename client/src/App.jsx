import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import Booth from './pages/Booth'
import FrameSelection from './pages/FrameSelection'
import PrintSelection from './pages/PrintSelection'
import Capture from './pages/Capture'
import BoothLogin from './pages/BoothLogin'
import { BoothProvider } from './context/BoothContext'
import Customize from "./pages/Customize";
import OrderSuccess from './pages/OrderSuccess';
import DownloadPage from './pages/DownloadPage';
import SharePage from './pages/SharePage';
import SupportWidget from './components/SupportWidget';
import CopiesPayment from './pages/CopiesPayment';
import StartShooting from './pages/StartShooting';
import EditReview from './pages/EditReview'

function App() {

  return (
    <BoothProvider>
      <Routes>
        <Route path="/login" element={<BoothLogin />} />
        <Route path="/" element={<Home />} />
        <Route path="/booth" element={<Booth />} />
        <Route path='/copies-payment' element={<CopiesPayment />} />
        <Route path='/start-shooting' element={<StartShooting />} />
        <Route path='/frameselection' element={<FrameSelection />} />
        <Route path='/capture' element={<Capture />} />
        <Route path='/edit-review' element={<EditReview />} />
        <Route path='/printselection' element={<PrintSelection />} />
        <Route path="/customize" element={<Customize />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/download/:token" element={<DownloadPage />} />
        <Route path="/share/:token" element={<SharePage />} />
      </Routes>
      <SupportWidget />
    </BoothProvider>
  )

}

export default App
