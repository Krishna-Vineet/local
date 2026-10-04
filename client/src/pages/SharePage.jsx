import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Share2, Copy, AlertCircle, CheckCircle2 } from 'lucide-react';
import './SharePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SharePage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch(`${API_BASE}/share/view/${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch photos. Link may be expired.');
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPhotos();
  }, [token]);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My HappyPix Photos',
          text: 'Check out my photos from HappyPix!',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownload = async (url, filename) => {
    try {
      // Use proxy if S3 CORS is an issue, or fetch directly as blob
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'HappyPix-Photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      // Fallback
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="share-page-container center">
        <div className="loader"></div>
        <p className="loading-text">Loading your memories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="share-page-container center">
        <AlertCircle size={64} className="error-icon" />
        <h2 className="error-title">Oops!</h2>
        <p className="error-msg">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { share, config } = data;
  const canDownload = config?.download?.enabled !== false;
  const canNativeShare = config?.nativeShare?.enabled !== false;
  const canCopyLink = config?.copyLink?.enabled !== false;

  const allPhotos = [];
  if (share.compositeUrl) allPhotos.push({ url: share.compositeUrl, type: 'composite' });
  if (share.photoUrls && share.photoUrls.length > 0) {
    share.photoUrls.forEach(url => allPhotos.push({ url, type: 'individual' }));
  }

  return (
    <div className="share-page-container">
      <div className="share-header">
        <h1 className="share-title">Your HappyPix Memories</h1>
        <p className="share-subtitle">Relive the fun and share it with the world!</p>
      </div>

      <div className="photos-grid">
        {allPhotos.map((photo, index) => (
          <div key={index} className={`photo-card ${photo.type}`}>
            <div className="photo-wrapper">
              <img src={photo.url} alt={`HappyPix Photo ${index + 1}`} className="photo-img" />
            </div>
            {canDownload && (
              <button 
                className="download-btn"
                onClick={() => handleDownload(photo.url, `HappyPix-${photo.type}-${index}.jpg`)}
              >
                <Download size={18} />
                <span>Download</span>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="share-actions">
        {canNativeShare && navigator.share && (
          <button className="action-btn primary" onClick={handleNativeShare}>
            <Share2 size={20} />
            <span>Share Link</span>
          </button>
        )}
        
        {canCopyLink && (
          <button className={`action-btn secondary ${copySuccess ? 'success' : ''}`} onClick={handleCopyLink}>
            {copySuccess ? <CheckCircle2 size={20} /> : <Copy size={20} />}
            <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
          </button>
        )}
      </div>
      
      <div className="share-footer">
        <p>Powered by HappyPix</p>
      </div>
    </div>
  );
};

export default SharePage;
