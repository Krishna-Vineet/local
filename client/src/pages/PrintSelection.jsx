import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useBooth } from "../context/BoothContext";
import logolight from "../assets/logo_light.svg";
import axios from 'axios';
import html2canvas from 'html2canvas-pro';
import { useIdleTimer } from '../hooks/useIdleTimer';
import IdleTimerRing from '../components/IdleTimerRing';
import { QRCodeSVG } from 'qrcode.react';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};
const API_URL = getApiUrl();

const FILTER_MAP = {
  none: 'none',
  vintage: 'sepia(0.6) contrast(1.15) brightness(0.95) hue-rotate(-10deg)',
  blackwhite: 'grayscale(1) contrast(1.25) brightness(1.05)',
  warm: 'sepia(0.25) saturate(1.35) hue-rotate(5deg) contrast(1.05)',
  cool: 'saturate(1.15) hue-rotate(-15deg) brightness(1.05) contrast(1.02)',
  vivid: 'saturate(1.65) contrast(1.15) brightness(1.05)',
};

// Dynamically load Razorpay checkout script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PrintSelection = () => {
  const navigate = useNavigate();
  const { session, resetSession } = useBooth();

  const canPrint = session.activeEvent?.allowPrint !== false && session.activeEvent?.printingEnabled !== false;
  const [outputType, setOutputType] = useState(canPrint ? 'print-digital' : 'digital-only');
  const [paymentMethod, setPaymentMethod] = useState('upi-qr'); // 'upi-qr' or 'razorpay'

  const [selected, setSelected] = useState(2);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [utrInput, setUtrInput] = useState('');

  // 30-second idle timer — paused during payment, resets on any interaction
  const TIMEOUT = 30;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    disabled: paymentLoading,     // freeze timer while Razorpay modal is open
    onTimeout: () => {
      resetSession();
      navigate('/');
    },
  });

  const eventLogo = session.activeEvent?.branding?.logoUrl || logolight;
  const basePrice = session.activeEvent?.printPrice != null ? session.activeEvent.printPrice : (session.globalSettings?.printPrice || 100);
  const printCount = outputType === 'digital-only' ? 0 : selected;
  const subtotal = printCount * basePrice;
  const finalPrice = Math.max(0, subtotal - discount);

  // Collect selected photo URLs for digital copy
  const photoUrls = (session.selectedImages || [])
    .filter(Boolean)
    .map((img) => img.url)
    .filter(Boolean);

  const applyCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');
    if (!couponCode) return;
    try {
      const res = await axios.post(`${API_URL}/api/coupons/public/validate`, { code: couponCode });
      if (res.data.valid) {
        const coupon = res.data.coupon;
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
          discountAmount = Math.round((subtotal * coupon.value) / 100);
        } else {
          discountAmount = coupon.value;
        }
        setDiscount(Math.min(discountAmount, subtotal));
        setCouponSuccess(`Coupon applied! You save ₹${Math.min(discountAmount, subtotal)}`);
      }
    } catch (err) {
      setCouponError(err.response?.data?.error || 'Invalid coupon');
      setDiscount(0);
    }
  };

  const getProxyUrl = (url) => {
    if (!url) return '';
    // Skip proxying for data/blob URLs and local assets (paths starting with '/' or relative paths)
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || !url.startsWith('http')) return url;
    return `${API_URL}/api/proxy/logo?url=${encodeURIComponent(url)}`;
  };

  const captureAndUploadComposite = async () => {
    const element = document.getElementById("photo-strip-capture");
    if (!element) return null;
    
    try {
      // Small timeout to ensure all images in the preview are fully loaded
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 3, // High print-ready resolution
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      
      const formData = new FormData();
      formData.append('photo', blob, `composite-${Date.now()}.png`);
      if (session?.activeEvent?._id) {
        formData.append('eventId', session.activeEvent._id);
      }
      
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      return response.data.url;
    } catch (err) {
      console.error("Failed to generate or upload composite photo strip:", err);
      return null;
    }
  };

  const handleFinish = async () => {
    setPaymentError('');
    const wantsDigital = outputType === 'print-digital' || outputType === 'digital-only';
    setPaymentLoading(true);

    // Capture and upload composite strip first
    let compositeUrl = null;
    try {
      compositeUrl = await captureAndUploadComposite();
    } catch (err) {
      console.error("Composite capture error:", err);
    }

    // ── Free order (100% coupon discount) ─────────────────────────────
    if (finalPrice === 0) {
      try {
        const res = await axios.post(`${API_URL}/api/payments/free-complete`, {
          amount: 0,
          printCount: printCount,
          digitalCopy: wantsDigital,
          photoUrls: wantsDigital ? photoUrls : [],
          compositeUrl,
          couponCode: couponCode || null,
          discountApplied: discount,
          eventId: session.activeEvent?._id || null,
          eventName: session.activeEvent?.name || 'General',
        });

        const { qrToken } = res.data;
        navigateToSuccess({
          printCount: printCount,
          amount: 0,
          digitalCopy: wantsDigital,
          qrToken: qrToken || null,
        });
      } catch (err) {
        console.error('Free complete error:', err);
        setPaymentError('Something went wrong. Please try again.');
        setPaymentLoading(false);
      }
      return;
    }

    // ── Paid order via UPI QR ──────────────────────────────────────────
    if (paymentMethod === 'upi-qr') {
      if (!utrInput) {
        setPaymentError('Please enter the 12-digit UPI Reference Number (UTR).');
        setPaymentLoading(false);
        return;
      }
      if (!/^\d{12}$/.test(utrInput)) {
        setPaymentError('UPI Reference Number (UTR) must be exactly 12 digits.');
        setPaymentLoading(false);
        return;
      }

      try {
        const res = await axios.post(`${API_URL}/api/payments/free-complete`, {
          amount: finalPrice,
          printCount: printCount,
          digitalCopy: wantsDigital,
          photoUrls: wantsDigital ? photoUrls : [],
          compositeUrl,
          couponCode: couponCode || null,
          discountApplied: discount,
          eventId: session.activeEvent?._id || null,
          eventName: session.activeEvent?.name || 'General',
          utr: utrInput,
        });

        const { qrToken } = res.data;
        navigateToSuccess({
          printCount: printCount,
          amount: finalPrice,
          digitalCopy: wantsDigital,
          qrToken: qrToken || null,
        });
      } catch (err) {
        console.error('UPI QR payment complete error:', err);
        setPaymentError(err.response?.data?.error || 'Failed to confirm UPI payment. Please try again.');
        setPaymentLoading(false);
      }
      return;
    }

    // ── Paid order via Razorpay ────────────────────────────────────────
    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentError('Failed to load payment gateway. Check your internet connection.');
        setPaymentLoading(false);
        return;
      }

      // 2. Create order on server (pass photo URLs and composite URL)
      const orderRes = await axios.post(`${API_URL}/api/payments/create-order`, {
        amount: finalPrice,
        printCount: printCount,
        digitalCopy: wantsDigital,
        photoUrls: wantsDigital ? photoUrls : [],
        compositeUrl,
        couponCode: couponCode || null,
        discountApplied: discount,
        eventId: session.activeEvent?._id || null,
        eventName: session.activeEvent?.name || 'General',
      });

      const { orderId, amount, currency, key } = orderRes.data;

      // Verify if eventLogo is a valid, accessible public HTTPS URL
      let verifiedLogoUrl = null;
      if (eventLogo && eventLogo.startsWith('https://') && !eventLogo.includes('localhost') && !eventLogo.includes('127.0.0.1')) {
        try {
          const testRes = await fetch(`${API_URL}/api/proxy/logo?url=${encodeURIComponent(eventLogo)}`);
          if (testRes.ok) {
            verifiedLogoUrl = eventLogo;
          }
        } catch (e) {
          console.warn('Failed to verify logo URL availability:', e);
        }
      }

      // 3. Open Razorpay modal
      const options = {
        key,
        amount,
        currency,
        name: session.activeEvent?.name || 'HappyPix',
        description: `${printCount} Print${printCount > 1 ? 's' : ''}${wantsDigital ? ' + Digital Copy' : ''}`,
        ...(verifiedLogoUrl ? { image: verifiedLogoUrl } : {}),
        order_id: orderId,
        handler: async (response) => {
          try {
            // 4. Verify payment on server — returns qrToken
            const verifyRes = await axios.post(`${API_URL}/api/payments/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            const { qrToken } = verifyRes.data;
            navigateToSuccess({
              printCount: printCount,
              amount: finalPrice,
              digitalCopy: wantsDigital,
              qrToken: qrToken || null,
            });
          } catch (err) {
            setPaymentError('Payment verification failed. Please contact support.');
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#7c3aed',
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setPaymentError(`Payment failed: ${response.error.description}`);
        setPaymentLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error('Payment init error:', err);
      setPaymentError(err.response?.data?.error || 'Something went wrong. Please try again.');
      setPaymentLoading(false);
    }
  };

  // Navigate to the Order Success screen with state
  const navigateToSuccess = ({ printCount, amount, digitalCopy, qrToken }) => {
    const params = new URLSearchParams();
    params.set('prints', printCount);
    params.set('amount', amount);
    params.set('digital', digitalCopy ? '1' : '0');
    if (qrToken) params.set('qrToken', qrToken);
    navigate(`/order-success?${params.toString()}`);
  };

  const options = [2, 4, 6, 8, 10];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row items-center justify-around px-6 md:px-20 relative py-20 lg:py-0 transition-colors">

      {/* Idle countdown ring */}
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      {/* Left side: Preview */}
      <div className="w-full max-w-[280px] md:max-w-xs bg-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex-shrink-0 border-8 border-white mb-10 lg:mb-0 hover:rotate-1 transition-transform cursor-default">
        <div id="photo-strip-capture" className="flex flex-col gap-1.5 bg-white p-1">
          <div className={`grid ${session.orientation === 'grid' ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5`}>
            {[...Array(session.frames)].map((_, i) => (
              <div key={i} className="bg-black aspect-[4/3] w-full border border-gray-100 flex items-center justify-center overflow-hidden rounded-sm">
                {session.selectedImages[i] ? (
                  <img 
                    src={getProxyUrl(session.selectedImages[i].url)} 
                    alt={`Slot ${i + 1}`} 
                    className="w-full h-full object-cover" 
                    style={{ filter: FILTER_MAP[session.activeFilter] || 'none' }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-900"></div>
                )}
              </div>
            ))}
          </div>
          <div className="bg-gray-100 py-2 w-full flex flex-col items-center justify-center px-3 mt-2 rounded-md border border-gray-200">
            {session.taglineText && (
              <p className="text-black font-extrabold text-[10px] mb-1.5 tracking-wide uppercase text-center w-full overflow-hidden text-ellipsis whitespace-nowrap">{session.taglineText}</p>
            )}
            <div className="w-full flex items-center justify-between">
              <div className="w-3 h-3 bg-gray-300 rounded-full flex-shrink-0"></div>
              <div className="flex items-center gap-2">
                {session.optionalLogoUrl && (
                  <img src={getProxyUrl(session.optionalLogoUrl)} alt="optional logo" className="h-5 object-contain" />
                )}
                <img 
                  src={getProxyUrl(eventLogo)} 
                  alt="logo" 
                  className="h-5 object-contain" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = logolight;
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Options */}
      <div className="flex flex-col items-center w-full max-w-2xl text-center">
        {/* Output Type Toggle */}
        <div className="mb-8 max-w-md w-full px-4 text-center">
          <span className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-extrabold">Select Output Type</span>
          <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
            {canPrint && (
              <button
                type="button"
                onClick={() => setOutputType('print-digital')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  outputType === 'print-digital' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Print + Digital
              </button>
            )}
            {canPrint && (
              <button
                type="button"
                onClick={() => setOutputType('print-only')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  outputType === 'print-only' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Print Only
              </button>
            )}
            <button
              type="button"
              onClick={() => setOutputType('digital-only')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                outputType === 'digital-only' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Digital Only
            </button>
          </div>
          {!canPrint && (
            <p className="text-xs text-gray-400 mt-2">Physical printing is disabled for this event.</p>
          )}
        </div>

        {/* Prints Selection */}
        {outputType !== 'digital-only' && (
          <div className="w-full">
            <h2 className="text-xl md:text-2xl font-black mb-6 text-black uppercase tracking-tight">
              How many <span className="text-purple-600">prints</span>?
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-10 w-full px-4 justify-center">
              {options.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelected(num)}
                  className={`py-4 md:py-6 rounded-2xl font-black text-xl transition-all shadow-md active:scale-95 cursor-pointer
                    ${selected === num
                      ? "bg-purple-600 text-white shadow-purple-200"
                      : "bg-white text-black border border-gray-200 hover:border-purple-300"
                    }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price Tag */}
        <div className="mb-8 animate-bounce">
          <div className="bg-black text-white rounded-2xl px-12 py-4 font-black text-2xl md:text-3xl shadow-xl flex flex-col">
            {discount > 0 && (
              <span className="text-sm line-through text-gray-400">₹{subtotal}</span>
            )}
            <span>₹{finalPrice}</span>
            {finalPrice === 0 && (
              <span className="text-green-400 text-sm font-bold mt-1">FREE 🎉</span>
            )}
          </div>
        </div>

        {/* Coupon Code */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter Coupon Code"
              className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 font-bold uppercase text-black"
            />
            <button
              onClick={applyCoupon}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Apply
            </button>
          </div>
          {couponError && <span className="text-red-500 font-bold text-sm">{couponError}</span>}
          {couponSuccess && <span className="text-green-500 font-bold text-sm">{couponSuccess}</span>}
        </div>

        {/* Payment Method Select / UPI QR Display */}
        {finalPrice > 0 && (
          <div className="mb-10 w-full max-w-md px-4 flex flex-col items-center">
            <span className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-extrabold">Select Payment Method</span>
            <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm w-full mb-6">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi-qr')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  paymentMethod === 'upi-qr' ? 'bg-black text-white' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Scan UPI QR
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  paymentMethod === 'razorpay' ? 'bg-black text-white' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Online Card/UPI
              </button>
            </div>

            {paymentMethod === 'upi-qr' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg flex flex-col items-center w-full">
                <p className="font-extrabold text-gray-800 text-base mb-1">Scan to Pay via UPI</p>
                <p className="text-gray-400 text-[10px] mb-4">Scan with GPay, PhonePe, Paytm, BHIM</p>
                
                <div className="bg-white p-3 rounded-2xl border-2 border-purple-50 mb-3 shadow-sm inline-block">
                  {(session.activeEvent?.qrCodeUrl || session.globalSettings?.upiQrImageUrl) ? (
                    <img
                      src={getProxyUrl(session.activeEvent?.qrCodeUrl || session.globalSettings.upiQrImageUrl)}
                      alt="UPI QR Scanner"
                      style={{ width: 160, height: 160, objectFit: 'contain' }}
                    />
                  ) : (
                    <QRCodeSVG
                      value={`upi://pay?pa=${session.activeEvent?.upiId || session.globalSettings?.upiId || import.meta.env.VITE_MERCHANT_UPI_ID || 'happypix@ybl'}&pn=${encodeURIComponent(
                        session.globalSettings?.upiName || session.activeEvent?.organizerName || import.meta.env.VITE_MERCHANT_NAME || 'HappyPix'
                      )}&am=${finalPrice}&cu=INR&tn=${encodeURIComponent(`Order HP_${Date.now()}`)}`}
                      size={160}
                      level="M"
                      fgColor="#1e1b4b"
                    />
                  )}
                </div>
                
                <span className="text-purple-600 font-black text-lg tracking-wide mb-4">
                  Pay exactly ₹{finalPrice}
                </span>
                
                {/* UTR Input Field */}
                <div className="w-full mt-2 flex flex-col gap-1.5 items-start">
                  <label className="text-[10px] font-extrabold uppercase text-gray-500">12-Digit UPI Ref No. (UTR)</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={utrInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, ''); // keep only numbers
                      setUtrInput(val);
                    }}
                    placeholder="Enter 12-digit UTR..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold text-center text-lg text-black"
                  />
                  <p className="text-[9px] text-gray-400 leading-normal text-left">
                    Enter the 12-digit UTR/Ref No. from your payment app receipt to confirm.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Error */}
        {paymentError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-5 py-3 rounded-xl font-bold text-sm max-w-md text-center">
            {paymentError}
          </div>
        )}
      </div>

      {/* Back Button */}
      <button onClick={() => navigate("/edit-review")} className="absolute bottom-10 left-10 bg-purple-200 p-4 rounded-full">
        ←
      </button>

      {/* Finish / Pay Button */}
      <button
        onClick={handleFinish}
        disabled={paymentLoading}
        className={`absolute bottom-10 right-10 bg-gradient-to-r from-purple-500 to-indigo-700 text-white px-10 py-4 rounded-full font-bold text-xl shadow-lg transition-all
          ${paymentLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
      >
        {paymentLoading
          ? 'Processing...'
          : finalPrice === 0
            ? 'FINISH FREE ✓'
            : paymentMethod === 'upi-qr'
              ? 'CONFIRM PAYMENT ✓'
              : `PAY ₹${finalPrice}`}
      </button>
    </div>
  );
};

export default PrintSelection;
