import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { Download, Printer, FileDown, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};
const API_URL = getApiUrl();

// ─── Countdown hook ───────────────────────────────────────────
const useCountdown = (expiresAt) => {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { remaining, expired };
};



// ─── Main Component ───────────────────────────────────────────
const DownloadPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | error | expired
  const [photoUrls, setPhotoUrls] = useState([]);
  const [compositeUrl, setCompositeUrl] = useState(null);
  const [enableMobilePrinting, setEnableMobilePrinting] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const { remaining, expired } = useCountdown(expiresAt);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/payments/download/${token}`);
        
        // Wrap URLs with proxy to bypass AWS AccessDenied
        const proxyUrl = (url) => url ? `${API_URL}/api/proxy/logo?url=${encodeURIComponent(url)}` : null;

        setPhotoUrls((res.data.photoUrls || []).map(proxyUrl));
        setCompositeUrl(proxyUrl(res.data.compositeUrl || null));
        setEnableMobilePrinting(res.data.enableMobilePrinting !== undefined ? res.data.enableMobilePrinting : true);
        setExpiresAt(res.data.expiresAt);
        setDownloadCount(res.data.downloadCount);
        setStatus('success');
      } catch (err) {
        const code = err.response?.status;
        if (code === 404 || code === 410) {
          setErrorMsg(err.response?.data?.error || 'This download link has expired or is invalid.');
          setStatus('expired');
        } else {
          setErrorMsg('Something went wrong. Please try again.');
          setStatus('error');
        }
      }
    };
    fetchToken();
  }, [token]);

  const [pdfUrl, setPdfUrl] = useState(null);

  // Pre-generate PDF so it downloads instantly when clicked
  useEffect(() => {
    if (status !== 'success' || photoUrls.length === 0) return;
    
    let isCancelled = false;
    
    const generatePDF = async () => {
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const allUrls = [];
        if (compositeUrl) allUrls.push(compositeUrl);
        allUrls.push(...photoUrls);

        for (let i = 0; i < allUrls.length; i++) {
          if (i > 0) pdf.addPage();
          
          const response = await fetch(allUrls[i], { mode: 'cors' });
          if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
          const blob = await response.blob();
          
          const base64data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (isCancelled) return;

          const imgProps = pdf.getImageProperties(base64data);
          const ratio = imgProps.width / imgProps.height;
          let finalWidth = pdfWidth - 40; // 20px margin
          let finalHeight = finalWidth / ratio;
          
          let xPos = 20;
          let yPos = 20;
          
          if (finalHeight > pdfHeight - 40) {
             finalHeight = pdfHeight - 40;
             finalWidth = finalHeight * ratio;
             xPos = (pdfWidth - finalWidth) / 2;
          } else {
             yPos = (pdfHeight - finalHeight) / 2;
          }
          
          pdf.addImage(base64data, 'JPEG', xPos, yPos, finalWidth, finalHeight);
        }
        
        if (isCancelled) return;
        
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
      } catch (err) {
        console.error('Failed to pre-generate PDF:', err);
      }
    };

    generatePDF();

    return () => {
      isCancelled = true;
    };
  }, [status, photoUrls, compositeUrl]);


  // ── Loading ──────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F0C29] via-[#302B63] to-[#24243E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
          <p className="text-indigo-200 font-medium tracking-wide">Fetching your memories…</p>
        </div>
      </div>
    );
  }

  // ── Expired / Error ──────────────────────────────────────────
  if (status === 'expired' || status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F0C29] via-[#302B63] to-[#24243E] flex items-center justify-center p-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {status === 'expired' ? 'Link Expired' : 'Link Invalid'}
          </h1>
          <p className="text-indigo-200/80 mb-6 leading-relaxed text-sm">
            {errorMsg}
          </p>
          <div className="bg-black/30 rounded-xl p-4">
            <p className="text-gray-400 text-xs">
              Digital copies are securely deleted from our servers 24 hours after your session to protect your privacy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F0C29] via-[#302B63] to-[#24243E] px-4 py-8 md:py-16 text-white font-sans overflow-x-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto w-full">
        {/* Top Header Card */}
        <div className="flex flex-col items-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md px-4 py-1.5 rounded-full mb-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-indigo-100 text-xs font-bold tracking-widest uppercase">HappyPix Digital</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300 mb-3 text-center">
            Your Photos Are Ready
          </h1>
          <p className="text-indigo-200/80 text-sm md:text-base font-medium">
            {photoUrls.length} captures • Downloaded {downloadCount} time{downloadCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Expiry Warning */}
        {expiresAt && !expired && (
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-5 py-2.5 rounded-2xl">
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-red-300 text-sm font-semibold tracking-wide">
                Expires in {remaining}
              </span>
            </div>
          </div>
        )}

        {/* Main Content Card - Redesigned to be unified */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl mb-8 flex flex-col items-center">
          
          {/* Main Display Image */}
          <div className="w-full max-w-[240px] md:max-w-[300px] mb-8 relative group perspective-1000">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative bg-white p-3 pb-12 rounded-2xl shadow-xl transform transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-1">
              <img 
                src={compositeUrl || photoUrls[0]} 
                alt="Your Photo" 
                className="w-full h-auto rounded-lg object-contain shadow-inner bg-gray-100" 
              />
            </div>
          </div>

          {/* Action Area */}
          <div className="w-full flex flex-col gap-4">
            {pdfUrl ? (
              <a
                href={pdfUrl}
                download={`happypix-photos-${token.substring(0, 5)}.pdf`}
                className="w-full group relative overflow-hidden rounded-2xl font-bold text-lg md:text-xl text-white shadow-lg transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:-translate-y-1 block"
              >
                <div className="px-6 py-4 flex items-center justify-center gap-3 relative z-10">
                  <FileDown className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Download as PDF</span>
                </div>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </a>
            ) : (
              <button
                disabled
                className="w-full group relative overflow-hidden rounded-2xl font-bold text-lg md:text-xl text-white shadow-lg transition-all duration-300 bg-indigo-900/60 cursor-not-allowed scale-95"
              >
                <div className="px-6 py-4 flex items-center justify-center gap-3 relative z-10">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Preparing Document...</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200/40 text-xs mt-16 font-medium">
          Powered by HappyPix
        </p>
      </div>
    </div>
  );
};

export default DownloadPage;
