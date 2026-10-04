import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Ensure the device token is attached if present in local storage
const attachToken = () => {
  const token = localStorage.getItem('hp_device_token');
  if (token) {
    axios.defaults.headers.common['x-device-token'] = token;
  } else {
    delete axios.defaults.headers.common['x-device-token'];
  }
};
attachToken();

const BoothContext = createContext();

export const BoothProvider = ({ children }) => {
  const [session, setSession] = useState({
    orientation: 'vertical',
    frames: 4,
    images: [],
    selectedImages: [],
    retakeIndex: null,
    activeEvent: null,
    globalSettings: { printPrice: 100, taxRate: 0, boothTimeout: 30 },
    selectedTemplate: null,
    taglineText: '',
    optionalLogoUrl: '',
    activeFilter: 'none',
    outputType: 'both',
    printCopies: 1,
    selectedGrid: null,
    gridKey: null,
    gridPrice: null,
    copiesPaid: 1,
    wantsDigitalQr: true,
    paymentId: null,
    isRegistered: !!localStorage.getItem('hp_device_token'),
    deviceName: localStorage.getItem('hp_device_name') || '',
  });

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');

  // Fetch org-scoped settings whenever token/event changes
  useEffect(() => {
    const fetchEventSettings = async () => {
      const eventId = session.activeEvent?._id;
      try {
        const url = eventId
          ? `${apiUrl}/api/settings/public?eventId=${eventId}`
          : `${apiUrl}/api/settings/public`;
        const settingsRes = await axios.get(url);
        if (settingsRes.data) {
          setSession((prev) => ({ ...prev, globalSettings: settingsRes.data }));
        }
      } catch (err) {
        console.warn('Failed to fetch settings for active event:', err.message);
      }
    };
    if (session.isRegistered) {
      fetchEventSettings();
    }
  }, [session.activeEvent?._id, session.isRegistered, apiUrl]);

  // ── Heartbeat: ping server every 30s + detect admin event assignments ──
  const heartbeatRef = useRef(null);
  useEffect(() => {
    if (!session.isRegistered) return; // Not registered — skip heartbeat

    const ping = async () => {
      try {
        // Send basic simulated telemetry
        const pong = await axios.post(`${apiUrl}/api/devices/ping`, {
          telemetry: { prints: Math.floor(Math.random()*10), shutters: Math.floor(Math.random()*15), batteryPct: 95 },
          connections: { camera: true, printer: true, kioskScreen: false }
        });

        const assignedEventId = pong.data?.currentEventId || null;
        const currentEventId = session.activeEvent?._id || null;

        if (assignedEventId && assignedEventId !== currentEventId) {
          // Admin assigned a NEW event — auto-load it
          try {
            const eventRes = await axios.get(`${apiUrl}/api/devices/current-event`);
            if (eventRes.data?.event) {
              setSession((prev) => ({ ...prev, activeEvent: eventRes.data.event }));
              console.info('🔄 Event assigned by admin:', eventRes.data.event.name);
            }
          } catch (e) {
            console.warn('Failed to fetch assigned event:', e.message);
          }
        } else if (!assignedEventId && currentEventId) {
          // Admin removed the event assignment
          setSession((prev) => ({ ...prev, activeEvent: null }));
          console.info('🔄 Event unassigned by admin');
        }
      } catch (err) {
        console.warn('Heartbeat ping failed:', err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
           // Token invalid or device blocked
           logoutBooth();
        }
      }
    };

    ping();
    heartbeatRef.current = setInterval(ping, 30000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [session.activeEvent, session.isRegistered, apiUrl]);

  const loginBooth = async (orgId, password, deviceName, location) => {
    const res = await axios.post(`${apiUrl}/api/devices/booth-login`, { orgId, password, deviceName, location });
    const { deviceToken, deviceName: name, currentEventId } = res.data;
    
    localStorage.setItem('hp_device_token', deviceToken);
    localStorage.setItem('hp_device_name', name);
    attachToken();

    setSession((prev) => ({ ...prev, isRegistered: true, deviceName: name }));
    
    // Trigger immediate fetch of event
    if (currentEventId) {
      try {
        const eventRes = await axios.get(`${apiUrl}/api/devices/current-event`);
        if (eventRes.data?.event) {
          setSession((prev) => ({ ...prev, activeEvent: eventRes.data.event }));
        }
      } catch (e) {}
    }
  };

  const logoutBooth = () => {
    localStorage.removeItem('hp_device_token');
    localStorage.removeItem('hp_device_name');
    attachToken();
    setSession((prev) => ({ ...prev, isRegistered: false, activeEvent: null, deviceName: '' }));
  };

  const setRetakeIndex = (index) => setSession((prev) => ({ ...prev, retakeIndex: index }));
  const setOrientation = (orientation) => setSession((prev) => ({ ...prev, orientation }));
  const setFrames = (frames) => setSession((prev) => ({ ...prev, frames }));

  const addImage = (url) => {
    setSession((prev) => ({
      ...prev,
      images: [...prev.images, { id: Date.now(), url }],
    }));
  };

  const updateImageAt = (index, url) => {
    setSession((prev) => {
      const newImages = [...prev.images];
      newImages[index] = { id: Date.now(), url };
      const newSelectedImages = [...prev.selectedImages];
      if (newSelectedImages[index]) newSelectedImages[index] = newImages[index];
      return { ...prev, images: newImages, selectedImages: newSelectedImages };
    });
  };

  const setSelectedImages = (images) => setSession((prev) => ({ ...prev, selectedImages: images }));

  const selectTemplate = (template) => {
    setSession((prev) => ({
      ...prev,
      selectedTemplate: template,
      frames: template.frames,
      orientation: template.orientation || 'vertical',
    }));
  };

  const setTaglineText = (text) => setSession((prev) => ({ ...prev, taglineText: text }));
  const setOptionalLogoUrl = (url) => setSession((prev) => ({ ...prev, optionalLogoUrl: url }));
  const setActiveFilter = (filter) => setSession((prev) => ({ ...prev, activeFilter: filter }));
  const resetImages = () => setSession((prev) => ({ ...prev, images: [] }));

  const resetSession = () => {
    setSession((prev) => ({
      ...prev,
      orientation: 'vertical',
      frames: 4,
      images: [],
      selectedImages: [],
      retakeIndex: null,
      selectedTemplate: null,
      taglineText: '',
      optionalLogoUrl: '',
      activeFilter: 'none',
      outputType: 'both',
      printCopies: 1,
      selectedGrid: null,
      gridKey: null,
      gridPrice: null,
      copiesPaid: 1,
      wantsDigitalQr: true,
      paymentId: null,
    }));
  };

  const setGridSelection = ({ selectedGrid, gridKey, gridPrice, copiesPaid, wantsDigitalQr, paymentId }) => {
    setSession((prev) => ({
      ...prev,
      selectedGrid,
      gridKey,
      gridPrice,
      copiesPaid: copiesPaid ?? 1,
      wantsDigitalQr: wantsDigitalQr ?? true,
      paymentId: paymentId || prev.paymentId || null,
    }));
  };

  const setOutputPreferences = (outputType, printCopies) => {
    setSession((prev) => ({ ...prev, outputType, printCopies }));
  };

  return (
    <BoothContext.Provider
      value={{
        session,
        setOrientation,
        setFrames,
        selectTemplate,
        setRetakeIndex,
        addImage,
        updateImageAt,
        setSelectedImages,
        resetImages,
        resetSession,
        loginBooth,
        logoutBooth,
        setTaglineText,
        setOptionalLogoUrl,
        setActiveFilter,
        setOutputPreferences,
        setGridSelection,
        isRegistered: session.isRegistered,
      }}
    >
      {children}
    </BoothContext.Provider>
  );
};

export const useBooth = () => {
  const context = useContext(BoothContext);
  if (!context) {
    throw new Error('useBooth must be used within a BoothProvider');
  }
  return context;
};
