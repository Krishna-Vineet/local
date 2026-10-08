import express from 'express';
import mongoose from 'mongoose';
import Device from '../models/Device.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
import Template from '../models/Template.js';
import Payment from '../models/Payment.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import Setting from '../models/Setting.js';
import SupportTicket from '../models/SupportTicket.js';

const router = express.Router();

// Middleware to authenticate booth API requests
const authenticateBooth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Device ')) {
      return res.status(401).json({ error: 'Device token required.' });
    }
    const token = authHeader.substring(7);
    const deviceUuid = req.headers['x-device-uuid'];

    const device = await Device.findOne({ deviceToken: token, deviceUuid });
    if (!device || device.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive device.' });
    }

    const org = await Organization.findById(device.organizationId);
    if (!org || org.status === 'banned') {
      return res.status(403).json({ error: 'Organization banned or not found.' });
    }

    req.device = device;
    req.organization = org;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Helper to build BoothSnapshot
const buildSnapshot = async (device, org) => {
  let eventPayload = null;
  const orgDefaults = await OrganizationDefaults.findOne({ organizationId: org._id }).lean();
  const orgSetting = (await Setting.findOne({ organizationId: org._id }).lean()) || (await Setting.findOne({ organizationId: null }).lean());
  
  if (device.assignedEventId) {
    const event = await Event.findById(device.assignedEventId).populate('templateIds').lean();
    if (event) {
      
      const mapTemplate = (t) => {
        // e.g. layoutId "57-v3" -> familyId "57", slots 3, orientation portrait
        const parts = (t.layoutId || '46-v1').split('-');
        const familyId = parts[0];
        const secondPart = parts[1] || 'v1';
        const orientation = secondPart.charAt(0) === 'h' ? 'landscape' : 'portrait';
        const slots = parseInt(secondPart.slice(1)) || 1;
        const printSize = familyId === '57' ? '5 × 7' : (familyId === '68' ? '6 × 8' : '4 × 6');
        
        const canvas = orientation === 'portrait' ? { width: 1000, height: 1500 } : { width: 1500, height: 1000 };
        const footer = 150;
const arrangeSlots = (w, h, n) => {
  const g = Math.max(10, Math.round(w * 0.022));
  const aspect = w / h;
  const out = [];
  const row = (cols, y, rh) => {
    const cw = (w - g * (cols - 1)) / cols;
    for (let i = 0; i < cols; i++) out.push({ x: i * (cw + g), y, w: cw, h: rh });
    return out;
  };
  const col = (rows, x, cw) => {
    const rh = (h - g * (rows - 1)) / rows;
    for (let i = 0; i < rows; i++) out.push({ x, y: i * (rh + g), w: cw, h: rh });
    return out;
  };
  const grid = (cols, rows) => {
    const cw = (w - g * (cols - 1)) / cols;
    const rh = (h - g * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: c * (cw + g), y: r * (rh + g), w: cw, h: rh });
      }
    }
    return out;
  };

  if (n === 1) return [{ x: 0, y: 0, w, h }];
  if (n === 2) return aspect >= 1 ? row(2, 0, h) : col(2, 0, w);
  if (n === 3) {
    if (aspect <= 0.5) return col(3, 0, w);
    if (aspect >= 1.15) {
      const bw = Math.round((w - g) * 0.58);
      const out2 = [{ x: 0, y: 0, w: bw, h }];
      const rh = (h - g) / 2;
      out2.push({ x: bw + g, y: 0, w: w - bw - g, h: rh });
      out2.push({ x: bw + g, y: rh + g, w: w - bw - g, h: rh });
      return out2;
    }
    const bh = Math.round((h - g) * 0.58);
    const out2 = [{ x: 0, y: 0, w, h: bh }];
    const cw = (w - g) / 2;
    out2.push({ x: 0, y: bh + g, w: cw, h: h - bh - g });
    out2.push({ x: cw + g, y: bh + g, w: cw, h: h - bh - g });
    return out2;
  }
  if (n === 4) {
    if (aspect <= 0.42) return col(4, 0, w);
    if (aspect >= 2.1) return row(4, 0, h);
    return grid(2, 2);
  }
  if (n === 5) {
    if (aspect <= 0.42) return col(5, 0, w);
    if (aspect >= 2.1) return row(5, 0, h);
    if (aspect >= 1.15) {
      const bw = Math.round((w - g) * 0.52);
      const out2 = [{ x: 0, y: 0, w: bw, h }];
      const gw = w - bw - g;
      const cw = (gw - g) / 2;
      const rh = (h - g) / 2;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) out2.push({ x: bw + g + c * (cw + g), y: r * (rh + g), w: cw, h: rh });
      return out2;
    }
    const bh = Math.round((h - g) * 0.52);
    const out2 = [{ x: 0, y: 0, w, h: bh }];
    const gh = h - bh - g;
    const rh = (gh - g) / 2;
    const cw = (w - g) / 2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) out2.push({ x: c * (cw + g), y: bh + g + r * (rh + g), w: cw, h: rh });
    return out2;
  }
  if (n === 6) {
    if (aspect <= 0.42) return col(6, 0, w);
    if (aspect >= 1.15) return grid(3, 2);
    return grid(2, 3);
  }
  if (n === 8) return aspect >= 1 ? grid(4, 2) : grid(2, 4);
  if (n === 9) return grid(3, 3);
  return col(n, 0, w);
};

        const footerRatio = 0.15;
        const footerH = Math.round(canvas.height * footerRatio);
        const photoAreaH = canvas.height - footerH;
        
        const arranged = arrangeSlots(canvas.width, photoAreaH, slots);
        const photoSlots = arranged.map((s, index) => ({
          id: `slot-${index + 1}`,
          x: Math.round(s.x),
          y: Math.round(s.y),
          width: Math.round(s.w),
          height: Math.round(s.h)
        }));
        
          let bg = t.design?.bg || t.design?.background || { type: 'solid', colors: ['#ffffff'] };
          if (typeof bg === 'string') {
            if (bg.startsWith('http') || bg.startsWith('data:')) {
              bg = { type: 'image', colors: [], url: bg };
            } else {
              bg = { type: 'solid', colors: [bg] };
            }
          } else if (bg && !bg.type) {
            bg = { type: 'solid', colors: bg.colors || ['#ffffff'] };
          }
          
          return {
            id: t._id.toString(),
            name: t.name || 'Custom Template',
            category: t.category || 'Custom',
            description: t.description || `${printSize} ${slots}-photo ${orientation}`,
            source: t.source || 'designer',
            componentId: t.componentId || undefined,
            active: t.active ?? true,
            layout: {
              id: t.layoutId,
              familyId,
              label: `${printSize} · ${slots} photo${slots === 1 ? '' : 's'}`,
              printSize,
              sheetSize: printSize,
              orientation,
              slots,
              canvas,
              photoSlots,
            },
            design: {
              background: bg,
              accent: t.design?.accent || '#ff4f9a',
              textColor: t.design?.textColor || '#000000',
              ornament: t.design?.ornament || 'none',
              slotShape: t.design?.slotShape || 'square',
              title: t.design?.title || 'HappyPix',
              subtitle: t.design?.subtitle || ''
            }
          };
      };

      let prices = event.layoutPrices instanceof Map ? Object.fromEntries(event.layoutPrices) : (event.layoutPrices || {});
      const defPrices = orgDefaults?.layoutPrices instanceof Map ? Object.fromEntries(orgDefaults.layoutPrices) : (orgDefaults?.layoutPrices || {});
      const templates = (event.templateIds || []).filter(t => t && t._id);
      templates.forEach(t => {
        const parts = (t.layoutId || '57-v3').split('-');
        const priceKey = `${parts[0] || '57'}:${parseInt((parts[1] || 'v1').slice(1)) || 1}`;
        if (typeof prices[priceKey] !== 'number') {
          if (typeof defPrices[priceKey] === 'number') {
            prices[priceKey] = defPrices[priceKey];
          } else {
            prices[priceKey] = event.printPrice || 0;
          }
        }
      });

      const defaultLogos = orgDefaults?.logoUrl ? [orgDefaults.logoUrl] : [];
      const defaultTagline = orgDefaults?.tagline || '';

      eventPayload = {
        id: event._id.toString(),
        organizationId: org._id.toString(),
        name: event.name,
        clientName: event.clientName || '',
        location: event.location || '',
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status || 'live',
        digitalCopy: event.digitalCopy ?? true,
        filters: event.filters?.length ? event.filters : ['original'],
        branding: {
          logos: (event.branding?.logos && event.branding.logos.length > 0) ? event.branding.logos : defaultLogos,
          tagline: event.branding?.tagline || defaultTagline
        },
        layoutPrices: prices,
        templates: templates.map(mapTemplate),
        revision: event.updatedAt?.toISOString() || new Date().toISOString(),
        templateContractVersion: 1
      };
    }
  }

  const snapshotRevision = `${eventPayload ? eventPayload.id : 'no-event'}_${eventPayload ? eventPayload.revision : 'no-rev'}_${orgDefaults?.updatedAt?.toISOString() || 'def'}`;

  return {
    device: { id: device._id.toString(), name: device.deviceName, uuid: device.deviceUuid },
    organization: {
      id: org._id.toString(),
      name: org.name || 'Organization',
      branding: {
        logoUrl: orgDefaults?.logoUrl || null,
        tagline: orgDefaults?.tagline || ''
      }
    },
    event: eventPayload,
    settings: {
      organizationName: orgDefaults?.displayName || org.name || 'HappyPix Org',
      boothTimeoutSec: orgDefaults?.boothTimeoutSec ?? 90,
      payoutMode: orgDefaults?.payoutMode || 'wallet',
      upiId: orgDefaults?.upiId || null,
      paymentDisplayName: orgDefaults?.displayName || org.name || 'HappyPix',
      currency: orgDefaults?.currency || 'INR',
      maximumPrints: orgDefaults?.maximumPrints || 10,
      galleryEnabled: orgSetting ? (orgSetting.galleryEnabled !== false) : true,
      requireGuestConsent: orgSetting ? Boolean(orgSetting.requireGuestConsent) : false,
      branding: {
        logoUrl: orgDefaults?.logoUrl || null,
        tagline: orgDefaults?.tagline || ''
      }
    },
    revision: snapshotRevision,
    serverTime: new Date().toISOString()
  };
};

// POST /api/booth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceUuid, deviceName, location, platform, appVersion } = req.body;

    // Check Roles and Access
    const admin = await User.findOne({ email, role: { $in: ['ORG_ADMIN', 'ORG_MANAGER'] } });
    if (!admin) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const org = await Organization.findById(admin.organizationId);
    if (!org || org.status === 'suspended' || org.status === 'banned') {
      return res.status(403).json({ error: `Organization is ${org?.status || 'inactive'}. Booth access not permitted.` });
    }

    // Link or create device
    let device = await Device.findOne({ deviceUuid, organizationId: org._id });
    if (!device) {
      device = new Device({
        organizationId: org._id,
        deviceUuid,
        deviceName: deviceName || 'New Booth',
        location: location?.label || '',
        deviceToken: Device.generateToken(),
        platform,
        appVersion,
        status: 'active'
      });
    } else {
      device.deviceToken = Device.generateToken();
      device.platform = platform;
      device.appVersion = appVersion;
    }
    await device.save();

    const installation = {
      deviceUuid: device.deviceUuid,
      deviceToken: device.deviceToken,
      deviceId: device._id.toString(),
      organizationId: org._id.toString(),
      pairedAt: new Date().toISOString(),
      locationLabel: location?.label || ''
    };

    const snapshot = await buildSnapshot(device, org);
    res.json({ installation, snapshot });
  } catch (error) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// GET /api/booth/bootstrap
router.get('/bootstrap', authenticateBooth, async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.device, req.organization);
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: 'Bootstrap failed.' });
  }
});

// POST /api/booth/heartbeat
router.post('/heartbeat', authenticateBooth, async (req, res) => {
  try {
    req.device.lastSeenAt = new Date();
    const forwardedFor = req.headers['x-forwarded-for'];
    req.device.ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0])?.trim()
      || req.ip
      || req.socket?.remoteAddress
      || null;
    req.device.userAgent = req.headers['user-agent'] || null;
    
    if (req.body.hardware) {
      const hw = req.body.hardware;
      req.device.telemetry = {
        prints: hw.printer?.printsTotal || req.device.telemetry?.prints || 0,
        shutters: hw.camera?.shutterCount || req.device.telemetry?.shutters || 0,
        batteryPct: hw.camera?.batteryPct || req.device.telemetry?.batteryPct || 100,
        updatedAt: new Date()
      };
      req.device.connections = {
        camera: hw.camera?.connected || false,
        printer: hw.printer?.connected || false,
        kioskScreen: hw.kioskScreen?.connected || false,
        updatedAt: new Date()
      };
    }
    
    await req.device.save();

    const snapshot = await buildSnapshot(req.device, req.organization);
    const knownRevision = req.body.knownRevision;
    // Only send full snapshot when something actually changed
    if (knownRevision && knownRevision === snapshot.revision) {
      return res.json({ changed: false });
    }
    res.json({ changed: true, snapshot });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat failed.' });
  }
});

// Real checkout flow
router.post('/checkout/quote', authenticateBooth, async (req, res) => {
  try {
    const { eventId, templateId, layoutId, prints, digitalCopy, couponCode } = req.body;
    const event = await Event.findById(eventId).populate('templateIds');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const template = event.templateIds.find(t => t._id.toString() === templateId);
    if (!template || template.layoutId !== layoutId) {
      return res.status(400).json({ error: 'Template not available' });
    }

    const parts = template.layoutId.split('-');
    const familyId = parts[0];
    const secondPart = parts[1] || 'v1';
    const slots = parseInt(secondPart.slice(1)) || 1;
    const priceKey = `${familyId}:${slots}`;
    
    let unitPrice;
    if (event.layoutPrices instanceof Map && event.layoutPrices.has(priceKey)) {
      unitPrice = event.layoutPrices.get(priceKey);
    } else if (event.layoutPrices && typeof event.layoutPrices[priceKey] === 'number') {
      unitPrice = event.layoutPrices[priceKey];
    }
    
    if (typeof unitPrice !== 'number') {
      // Fallback to legacy printPrice or default to 0 if no pricing is set at all
      unitPrice = event.printPrice || 0;
    }

    let gross = unitPrice * prints;
    let discount = 0;
    let couponMessage = null;
    let validCoupon = null;

    if (couponCode) {
      const code = couponCode.trim().toUpperCase();
      if (code === 'PIX20') {
        discount = Math.round(gross * 0.2);
        couponMessage = 'PIX20 applied · 20% off';
        validCoupon = code;
      } else if (code === 'FREEPIX') {
        discount = gross;
        couponMessage = 'FREEPIX applied · your order is free';
        validCoupon = code;
      } else {
        return res.status(400).json({ error: 'Invalid coupon' });
      }
    }

    const finalAmount = Math.max(0, gross - discount);

    res.json({
      quoteId: `quote-${Date.now()}`,
      unitPrice,
      prints,
      gross,
      discount,
      finalAmount,
      couponCode: validCoupon,
      couponMessage,
      settlement: req.organization?.payoutMode || 'wallet',
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate quote' });
  }
});

router.post('/payments', authenticateBooth, async (req, res) => {
  try {
    const { quote } = req.body;
    if (!quote || quote.finalAmount === undefined) {
      return res.status(400).json({ error: 'Quote required' });
    }

    // Generate a unique order ID for razorpay or UPI
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    
    // In a real app we'd call Razorpay API here to create an order
    // But since this is a local app (and we don't have RZP creds here), we mock the QR
    const qrPayload = `upi://pay?pa=test@upi&pn=${encodeURIComponent(req.organization.name)}&am=${quote.finalAmount}&cu=INR&tn=${paymentId}`;

    const payment = new Payment({
      organizationId: req.organization._id,
      eventId: req.device.assignedEventId,
      razorpayOrderId: paymentId,
      amount: quote.finalAmount,
      currency: 'INR',
      printCount: quote.prints,
      digitalCopy: true,
      couponCode: quote.couponCode,
      discountApplied: quote.discount,
      status: 'pending' // custom logic uses 'created' or 'pending'
    });
    await payment.save();

    res.json({
      paymentId: payment._id.toString(),
      amount: quote.finalAmount,
      qrPayload,
      status: 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.get('/payments/:id', authenticateBooth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Not found' });
    
    // For demo purposes, we automatically mark it as paid after 10 seconds of creation
    const ageMs = Date.now() - payment.createdAt.getTime();
    if (payment.status !== 'paid' && ageMs > 6500) {
      payment.status = 'paid';
      payment.paidAt = new Date();
      await payment.save();
    }
    
    res.json({ status: payment.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

router.post('/checkout/free-complete', authenticateBooth, async (req, res) => {
  try {
    const { quoteId } = req.body; // Wait, we might not have the full quote if the client just sends quoteId. But we want to record something.
    // If quote is passed, we save it. Let's assume req.body.quote might be passed, or we just save a generic free payment.
    const payment = new Payment({
      organizationId: req.organization._id,
      eventId: req.device.assignedEventId,
      razorpayOrderId: `free_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      amount: 0,
      currency: 'INR',
      printCount: 1, // default or from quote if available
      digitalCopy: true,
      status: 'paid',
      paidAt: new Date()
    });
    
    if (req.body.quote) {
      payment.amount = req.body.quote.finalAmount || 0;
      payment.printCount = req.body.quote.prints || 1;
      payment.couponCode = req.body.quote.couponCode;
      payment.discountApplied = req.body.quote.discount;
    }

    await payment.save();
    res.json({ success: true, paymentId: payment._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete free checkout' });
  }
});

router.post('/sessions/complete', authenticateBooth, async (req, res) => {
  try {
    const { sessionId, digitalCopy, guestConsent } = req.body;
    // Log the session usage telemetry to device
    req.device.telemetry = req.device.telemetry || {};
    req.device.telemetry.prints = (req.device.telemetry.prints || 0) + 1;
    if (guestConsent !== undefined) {
      req.device.telemetry.lastGuestConsent = Boolean(guestConsent);
    }
    await req.device.save();
    
    res.json({ shareUrl: digitalCopy ? `https://happypix.in/share/${sessionId}` : null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

router.post('/support', authenticateBooth, async (req, res) => {
  try {
    const { name, email, subject, message, category, sessionId, paymentReference } = req.body;
    const ticket = new SupportTicket({
      ticketType: 'end_user',
      name: (name || 'Booth Guest').trim(),
      email: (email || 'guest@happypix.in').trim().toLowerCase(),
      subject: (subject || `Issue reported from ${category || 'Booth'}`).trim(),
      message: (message || 'No description provided.').trim(),
      organizationId: req.organization._id,
      eventId: req.device.assignedEventId || null,
      deviceId: req.device._id,
      sessionId: sessionId || null,
      paymentReference: paymentReference || null,
      holdPhotos: Boolean(sessionId),
    });
    await ticket.save();
    res.status(201).json({ success: true, ticketId: ticket._id.toString() });
  } catch (err) {
    console.error('Failed to create support ticket from booth:', err);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

export default router;
