// ============================================================
// Organization workspace API — v2 contract, real persistence.
//
// Fixes covered here:
//   #1  suspended orgs: read-only access, no writes (requireWritableOrg)
//   #3/#5/#56 real plan limits for devices + active events
//   #6  Guest Support for Org Admins (view/reply/resolve/reopen)
//   #7  event + device management for Org Admins AND Managers
//   #27/#28/#31–#36 team page: `members`, real lastLoginAt, last-admin guard
//   #37–#40 platform support request flow (no more 500)
//   #41–#44 coupon vocabulary shared with mock + booth
//   #45–#50 defaults: layout prices persist, UPI reaches revenue API,
//        booth timeout reaches the booth, event→org→platform fallback chain
//   #51–#57 events/devices: org scoping, plan limits, hard delete that
//        invalidates booth sessions and cached configuration
//   #58/#59 branding de-duplication
//   #60/#61 gallery flow testable without Electron + respects platform policy
//   #21–#25 audit records with actor + real timestamp
// ============================================================

import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import {
  authenticate, requirePerm, requireWritableOrg, authorize, getOrgFilter,
} from '../../middleware/auth.js';
import { ROLES, PERMS } from '../../config/permissions.js';
import Organization from '../../models/Organization.js';
import OrganizationDefaults from '../../models/OrganizationDefaults.js';
import Setting from '../../models/Setting.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import SupportTicket from '../../models/SupportTicket.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import Coupon from '../../models/Coupon.js';
import Photo from '../../models/Photo.js';
import Payment from '../../models/Payment.js';

import TemplateLayout from '../../models/TemplateLayout.js';
import OrgAiTemplate from '../../models/OrgAiTemplate.js';
import TemplateGenerationService from '../../services/ai/TemplateGenerationService.js';
import { s3, uploadToS3, s3KeyFromUrl } from '../../utils/s3.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

import Template from '../../models/Template.js';
import Withdrawal from '../../models/Withdrawal.js';
import AuditLog from '../../models/AuditLog.js';

import { writeAudit, auditView, byAtDesc } from '../../utils/auditLogger.js';
import { asyncRoute, badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { planSummary, assertDeviceLimit, assertEventLimit } from '../../services/planService.js';
import { getGallerySettings, photoVisibleInGallery } from '../../services/gallerySettingsService.js';
import { signedPhotoUrl } from '../../services/photoUrlService.js';
import { couponView, couponPatch, validateCouponCreate, applyCoupon, findCouponForOrg } from '../../services/couponService.js';
import {
  computeEventStatus, isActiveEvent, eventView, eventPatch, isDeviceOnline,
} from '../../services/eventService.js';
import { layoutMeta, resolveLayoutPrices, validateLayoutPrices } from '../../config/layouts.js';
import { removeBackground } from '../../services/backgroundRemovalService.js';


const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Limit AI generation to prevent GPU credit exhaustion
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI template generations. Please try again in 15 minutes.' },
});

const MIN_WITHDRAWAL = 500;

// Public asset proxy — serves local disk assets or S3 template/branding assets
// before auth middleware so browser <img>, SVG <image>, CSS url(), and Booth
// <Image> elements can load template backgrounds & overlays without 401 errors.
router.get('/asset-proxy', async (req, res) => {
  try {
    const rawKey = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!rawKey) return res.status(400).json({ error: 'key query param required' });

    // 1. If key is already a data URL
    if (rawKey.startsWith('data:')) {
      return res.redirect(rawKey);
    }

    // 2. Check local uploads directory first
    const cleanKey = rawKey
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(/^(\/?uploads\/|\/)/, '')
      .split('?')[0];
    if (!cleanKey || cleanKey.includes('..')) {
      return res.status(400).json({ error: 'Invalid asset key' });
    }

    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return fs.createReadStream(localPath).pipe(res);
    }

    // 3. Try S3 if bucket is configured
    if (process.env.S3_BUCKET_NAME) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: cleanKey,
        });

        const s3Response = await s3.send(command);
        const contentType = s3Response.ContentType || (cleanKey.endsWith('.png') ? 'image/png' : 'image/jpeg');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        const chunks = [];
        for await (const chunk of s3Response.Body) {
          chunks.push(chunk);
        }
        return res.send(Buffer.concat(chunks));
      } catch (s3Err) {
        console.warn('⚠️ S3 asset proxy fetch failed:', s3Err.message);
      }
    }

    // 4. Fallback 404
    res.status(404).json({ error: 'Asset not found' });
  } catch (err) {
    console.error('Asset proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy asset' });
  }
});

// Every route below is organization-scoped; platform roles are rejected here.
router.use(authenticate, authorize(ROLES.ORG_ADMIN, ROLES.ORG_MANAGER));

// ─── shared helpers ────────────────────────────────────────────

const orgId = (req) => req.organization._id;


function monthsBack(count = 8) {
  const out = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    out.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('en-IN', { month: 'short' }),
      start: date,
      end: new Date(date.getFullYear(), date.getMonth() + 1, 1),

    });
  }
  return out;
}

function paymentStatusView(status) {
  if (status === 'created') return 'pending';
  return status;
}

function paymentView(payment) {
  const raw = typeof payment.toObject === 'function' ? payment.toObject() : payment;
  return {
    id: String(raw._id || raw.id),
    amount: Number(raw.amount) || 0,
    status: paymentStatusView(raw.status),
    rawStatus: raw.status,
    printCount: Number(raw.printCount) || 0,
    digitalCopy: !!raw.digitalCopy,
    couponCode: raw.couponCode || null,
    discount: Number(raw.discountApplied) || 0,
    eventId: raw.eventId ? String(raw.eventId) : null,
    eventName: raw.eventName || null,
    deviceId: raw.deviceId ? String(raw.deviceId) : null,
    settlement: raw.settlement === 'upi' ? 'upi' : 'wallet',
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    paidAt: raw.paidAt ? new Date(raw.paidAt).toISOString() : null,
  };
}

async function loadSubscription(organizationId) {
  const Subscription = mongoose.model('Subscription');
  return Subscription.findOne({ organizationId }).sort({ createdAt: -1 });
}

async function orgDefaultsFor(organizationId) {
  let defaults = await OrganizationDefaults.findOne({ organizationId });
  if (!defaults) defaults = await OrganizationDefaults.create({ organizationId });
  return defaults;
}

async function planFor(req) {
  const subscription = await loadSubscription(orgId(req));
  return planSummary(req.organization, subscription);
}

async function devicesFor(organizationId) {
  return Device.find({ organizationId }).sort({ createdAt: -1 });
}

async function eventsFor(organizationId) {
  return Event.find({ organizationId }).sort({ createdAt: -1 });
}

/** Count of events that are running right now (plan limit basis). */
async function activeEventCount(organizationId) {
  const events = await Event.find({ organizationId }).select('startDate endDate paused');
  return events.filter(isActiveEvent).length;
}

function deviceView(device, events = []) {
  const assigned = device.assignedEventId
    ? events.find((event) => String(event._id) === String(device.assignedEventId))
    : null;
  return {
    id: String(device._id),
    deviceName: device.deviceName,
    deviceUuid: device.deviceUuid,
    location: device.location || '',
    operatorName: device.operatorName || null,
    operatorPhone: device.operatorPhone || null,
    status: device.status,
    online: isDeviceOnline(device),
    registeredAt: device.createdAt ? new Date(device.createdAt).toISOString() : null,
    lastSeenAt: device.lastSeenAt ? new Date(device.lastSeenAt).toISOString() : null,
    telemetry: device.telemetry
      ? {
          prints: device.telemetry.prints || 0,
          shutters: device.telemetry.shutters || 0,
          batteryPct: device.telemetry.batteryPct ?? null,
          updatedAt: device.telemetry.updatedAt ? new Date(device.telemetry.updatedAt).toISOString() : null,
        }
      : null,
    connections: device.connections
      ? {
          camera: !!device.connections.camera,
          printer: !!device.connections.printer,
          kioskScreen: !!device.connections.kioskScreen,
          updatedAt: device.connections.updatedAt ? new Date(device.connections.updatedAt).toISOString() : null,
        }
      : null,
    assignedEvent: assigned
      ? { id: String(assigned._id), name: assigned.name, status: computeEventStatus(assigned) }
      : null,
    assignedEventId: device.assignedEventId ? String(device.assignedEventId) : null,
  };
}

/** Audit helper bound to an organization request. */
function orgAudit(req, action, entity, summary, severity = 'info') {
  return writeAudit({ req, organizationId: orgId(req), action, entity, summary, severity });
}

// ================================================================
// DASHBOARD  (#3 real limits, #56 usage display, #1 read-only notice)
// ================================================================

router.get('/dashboard', requirePerm(PERMS.ORG_DASHBOARD_VIEW), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const plan = await planFor(req);
  const devices = await devicesFor(organizationId);
  const events = await eventsFor(organizationId);
  const openTickets = await SupportTicket.find({
    organizationId,
    status: { $in: ['open', 'in-progress'] },
  }).limit(5).lean();

  const activeEvents = events.filter(isActiveEvent);
  const offline = devices.filter((device) => !isDeviceOnline(device));

  const warnings = [];
  if (plan.status === 'expiring_soon') {
    warnings.push({ kind: 'plan_expiring', text: `Your ${plan.planName} plan expires in ${plan.daysLeft} day(s).`, tone: 'warn' });
  }
  if (plan.status === 'expired') {
    warnings.push({ kind: 'plan_expired', text: 'Your plan has expired. Renew to create new events and register devices.', tone: 'danger' });
  }
  if (devices.length >= plan.deviceLimit) {
    warnings.push({ kind: 'device_limit', text: `Device limit reached (${devices.length}/${plan.deviceLimit}). Upgrade to add more booths.`, tone: 'warn' });
  }
  if (activeEvents.length >= plan.eventLimit) {
    warnings.push({ kind: 'event_limit', text: `Parallel active event limit reached (${activeEvents.length}/${plan.eventLimit}).`, tone: 'warn' });
  }
  if (offline.length && req.organization.status !== 'suspended') {
    warnings.push({ kind: 'booth_offline', text: `${offline.length} booth(s) currently offline.`, tone: 'info' });
  }
  if (req.organization.status === 'suspended') {
    warnings.push({
      kind: 'org_blocked',
      text: req.organization.suspendReason
        ? `Your organization is suspended: ${req.organization.suspendReason}.`
        : 'Your organization is suspended. Contact HappyPix support.',
      tone: 'danger',
    });
  }

  const payload = {
    organization: {
      id: String(req.organization._id),
      name: req.organization.name,
      ownerName: req.organization.ownerName,
      email: req.organization.email,
      logoUrl: req.organization.logoUrl || null,
      status: req.organization.status || 'active',
    },
    readOnly: req.organization.status === 'suspended',
    plan,
    // Issue #3/#56: `connected devices / device limit` and
    // `active events / event limit` — real numbers from the assigned plan.
    usage: {
      devicesUsed: devices.length,
      deviceLimit: plan.deviceLimit,
      eventsUsed: activeEvents.length,
      eventLimit: plan.eventLimit,
    },
    devices: { total: devices.length, online: devices.length - offline.length, offline: offline.length },
    events: {
      active: events.filter(isActiveEvent).map((event) => ({ id: String(event._id), name: event.name, startDate: event.startDate, status: 'active' })),
      upcoming: events.filter((event) => computeEventStatus(event) === 'upcoming').map((event) => ({ id: String(event._id), name: event.name, startDate: event.startDate, status: 'upcoming' })),
      paused: events.filter((event) => computeEventStatus(event) === 'paused').map((event) => ({ id: String(event._id), name: event.name, startDate: event.startDate, status: 'paused' })),
      finished: events.filter((event) => computeEventStatus(event) === 'finished').map((event) => ({ id: String(event._id), name: event.name, startDate: event.startDate, status: 'finished' })),
    },
    tickets: {
      open: openTickets.length,
      list: openTickets.map((ticket) => ({
        id: String(ticket._id),
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        guest: { name: ticket.name, contact: ticket.email },
      })),
    },
    warnings,
  };

  if (req.user.role === ROLES.ORG_ADMIN) {
    payload.revenue = await buildRevenueSummary(organizationId);
  }
  res.json(payload);
}));

// ================================================================
// REVENUE  (#47 UPI + payout, #48 wallet/settlement/totals)
// ================================================================

async function payoutSettings(organizationId) {
  const defaults = await OrganizationDefaults.findOne({ organizationId }).lean();
  return {
    // Issue #47: the UPI ID saved in defaults is what the revenue API reports.
    upiId: (defaults && defaults.upiId) || null,
    payoutMode: defaults && defaults.payoutMode === 'upi' ? 'upi' : 'wallet',
    paymentDisplayName: (defaults && defaults.paymentDisplayName) || null,
  };
}

async function walletInfo(organizationId) {
  const paid = await Payment.find({ organizationId, status: 'paid' }).lean();
  const credited = paid.filter((payment) => payment.settlement !== 'upi').reduce((sum, payment) => sum + payment.amount, 0);
  const viaUpi = paid.filter((payment) => payment.settlement === 'upi').reduce((sum, payment) => sum + payment.amount, 0);
  const withdrawals = await Withdrawal.find({ organizationId }).sort({ requestedAt: -1 }).lean();
  const withdrawn = withdrawals.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
  const processing = withdrawals.filter((row) => row.status === 'processing').reduce((sum, row) => sum + row.amount, 0);
  return {
    balance: credited - withdrawn - processing,
    credited,
    withdrawn,
    processing,
    viaUpi,
    minWithdrawal: MIN_WITHDRAWAL,
    withdrawals: withdrawals.map((row) => ({
      id: String(row._id),
      amount: row.amount,
      status: row.status,
      upiId: row.upiId,
      requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : null,
      processedAt: row.processedAt ? new Date(row.processedAt).toISOString() : null,
    })),
  };
}

async function buildRevenueSummary(organizationId) {
  const payments = await Payment.find({ organizationId }).lean();
  const paid = payments.filter((payment) => payment.status === 'paid');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const payout = await payoutSettings(organizationId);
  const wallet = await walletInfo(organizationId);
  return {
    total: paid.reduce((sum, payment) => sum + payment.amount, 0),
    thisMonth: paid.filter((payment) => new Date(payment.createdAt) >= monthStart).reduce((sum, payment) => sum + payment.amount, 0),
    payout,
    wallet: { balance: wallet.balance, processing: wallet.processing, minWithdrawal: wallet.minWithdrawal },
    viaUpi: wallet.viaUpi,
    viaWallet: wallet.credited,
  };
}

router.get('/revenue', requirePerm(PERMS.ORG_REVENUE_VIEW), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const { from, to, eventId, deviceId } = req.query;

  let payments = await Payment.find({ organizationId, status: { $in: ['paid', 'pending', 'created', 'failed'] } }).lean();
  if (from) payments = payments.filter((payment) => new Date(payment.createdAt) >= new Date(from));
  if (to) payments = payments.filter((payment) => new Date(payment.createdAt) <= new Date(`${to}T23:59:59`));
  if (eventId) payments = payments.filter((payment) => String(payment.eventId) === String(eventId));
  if (deviceId) payments = payments.filter((payment) => String(payment.deviceId) === String(deviceId));

  const paid = payments.filter((payment) => payment.status === 'paid');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const fyStart = new Date(new Date().getFullYear(), 3, 1); // Indian FY starts 1 April
  if (monthStart.getTime() > Date.now()) monthStart.setFullYear(monthStart.getFullYear() - 1);

  const [events, devices, wallet, payout, gallery] = await Promise.all([
    eventsFor(organizationId),
    devicesFor(organizationId),
    walletInfo(organizationId),
    payoutSettings(organizationId),
    getGallerySettings(),
  ]);

  const byEvent = events.map((event) => {
    const rows = paid.filter((payment) => String(payment.eventId) === String(event._id));
    return {
      id: String(event._id),
      name: event.name,
      status: computeEventStatus(event),
      total: rows.reduce((sum, row) => sum + row.amount, 0),
      prints: rows.reduce((sum, row) => sum + (row.printCount || 0), 0),
      transactions: rows.length,
    };
  }).sort((a, b) => b.total - a.total);

  const byDevice = devices.map((device) => {
    const rows = paid.filter((payment) => String(payment.deviceId) === String(device._id));
    return {
      id: String(device._id),
      name: device.deviceName,
      online: isDeviceOnline(device),
      total: rows.reduce((sum, row) => sum + row.amount, 0),
      prints: rows.reduce((sum, row) => sum + (row.printCount || 0), 0),
      transactions: rows.length,
    };
  }).sort((a, b) => b.total - a.total);

  const cellMap = new Map();
  for (const payment of paid) {
    const key = `${payment.eventId || 'none'}|${payment.deviceId || 'none'}`;
    const cell = cellMap.get(key) || {
      eventId: payment.eventId ? String(payment.eventId) : null,
      deviceId: payment.deviceId ? String(payment.deviceId) : null,
      total: 0, prints: 0, transactions: 0, viaUpi: 0, viaWallet: 0,
    };
    cell.total += payment.amount;
    cell.prints += payment.printCount || 0;
    cell.transactions += 1;
    if (payment.settlement === 'upi') cell.viaUpi += payment.amount;
    else cell.viaWallet += payment.amount;
    cellMap.set(key, cell);
  }
  const eventName = (id) => (events.find((event) => String(event._id) === String(id)) || {}).name || (id ? 'Deleted event' : 'No event (walk-in)');
  const deviceName = (id) => (devices.find((device) => String(device._id) === String(id)) || {}).deviceName || (id ? 'Removed booth' : 'Unknown booth');
  const matrix = [...cellMap.values()]
    .map((cell) => ({ ...cell, eventName: eventName(cell.eventId), deviceName: deviceName(cell.deviceId) }))
    .sort((a, b) => b.total - a.total);

  const monthSplit = monthsBack(8).map((month) => {
    const rows = paid.filter((payment) => {
      const at = new Date(payment.createdAt);
      return at >= month.start && at < month.end;
    });
    return {
      key: month.key,
      label: month.label,
      value: rows.reduce((sum, row) => sum + row.amount, 0),
      upi: rows.filter((row) => row.settlement === 'upi').reduce((sum, row) => sum + row.amount, 0),
      wallet: rows.filter((row) => row.settlement !== 'upi').reduce((sum, row) => sum + row.amount, 0),
    };
  });

  res.json({
    // Issue #47/#48: payout (UPI id + mode), wallet, settlement, totals.
    payout,
    wallet,
    settlement: {
      upi: paid.filter((payment) => payment.settlement === 'upi').reduce((sum, payment) => sum + payment.amount, 0),
      wallet: paid.filter((payment) => payment.settlement !== 'upi').reduce((sum, payment) => sum + payment.amount, 0),
    },
    matrix,
    monthSplit,
    monthWise: monthsBack(8).map((month) => ({
      key: month.key,
      label: month.label,
      value: paid
        .filter((payment) => {
          const at = new Date(payment.createdAt);
          return at >= month.start && at < month.end;
        })
        .reduce((sum, payment) => sum + payment.amount, 0),
    })),
    total: paid.reduce((sum, payment) => sum + payment.amount, 0),
    thisMonth: paid.filter((payment) => new Date(payment.createdAt) >= monthStart).reduce((sum, payment) => sum + payment.amount, 0),
    fy: paid.filter((payment) => new Date(payment.createdAt) >= fyStart).reduce((sum, payment) => sum + payment.amount, 0),
    byEvent,
    byDevice,
    byStatus: {
      paid: payments.filter((payment) => payment.status === 'paid').length,
      pending: payments.filter((payment) => payment.status === 'pending' || payment.status === 'created').length,
      failed: payments.filter((payment) => payment.status === 'failed').length,
    },
    transactions: payments.map(paymentView).slice(0, 200),
    events: events.map((event) => ({ id: String(event._id), name: event.name, status: computeEventStatus(event) })),
    devices: devices.map((device) => ({ id: String(device._id), name: device.deviceName, online: isDeviceOnline(device) })),
    gallery: { galleryEnabled: gallery.galleryEnabled, requireGuestConsent: gallery.requireGuestConsent },
    filters: { from: from || null, to: to || null, eventId: eventId || null, deviceId: deviceId || null },
  });
}));

router.get('/wallet', requirePerm(PERMS.ORG_REVENUE_VIEW), asyncRoute(async (req, res) => {
  res.json({ wallet: await walletInfo(orgId(req)), payout: await payoutSettings(orgId(req)) });
}));

router.post('/wallet/withdraw', requirePerm(PERMS.ORG_REVENUE_VIEW), requireWritableOrg, asyncRoute(async (req, res) => {
  const amount = Math.round(Number(req.body.amount));
  const payout = await payoutSettings(orgId(req));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    throw badRequest(`Minimum withdrawal is ₹${MIN_WITHDRAWAL}.`, 'MIN_WITHDRAWAL');
  }
  if (payout.payoutMode !== 'upi' || !payout.upiId) {
    throw conflict('Add a UPI ID in Organization Defaults before requesting a withdrawal.', 'UPI_REQUIRED');
  }
  const wallet = await walletInfo(orgId(req));
  if (amount > wallet.balance) throw conflict('Withdrawal exceeds the available wallet balance.', 'INSUFFICIENT_BALANCE');
  const withdrawal = await Withdrawal.create({
    organizationId: orgId(req),
    amount,
    upiId: payout.upiId,
    status: 'processing',
    requestedBy: req.user._id,
  });
  await orgAudit(req, 'organization.wallet.withdrawal_requested', 'withdrawal', `Withdrawal of ₹${amount} requested to ${payout.upiId}`, 'warn');
  res.status(201).json({
    withdrawal: { id: String(withdrawal._id), amount, status: withdrawal.status, upiId: withdrawal.upiId, requestedAt: withdrawal.requestedAt },
    wallet: await walletInfo(orgId(req)),
  });
}));

// ================================================================
// EVENTS  (#51–#55, #58/#59, #46)
// ================================================================

router.get('/events', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const [events, devices, gallery] = await Promise.all([
    eventsFor(organizationId), devicesFor(organizationId), getGallerySettings(),
  ]);
  res.json({
    events: events.map((event) => eventView(event, { devices, organization: req.organization, gallerySettings: gallery })),
    // Issue #55: the UI must know whether creating is allowed before it asks.
    canCreate: req.organization.status !== 'suspended',
    plan: await planFor(req),
    templates: await Template.find({ active: true }).sort({ createdAt: -1 }).lean().then((templates) =>
      templates.map((template) => ({
        id: String(template._id),
        name: template.name,
        category: template.category,
        layoutId: template.layoutId,
        layout: layoutMeta(template.layoutId),
        design: template.design || {},
        source: template.source || 'playground',
        active: template.active !== false,
      })),
    ),
  });
}));

router.post('/events', requirePerm(PERMS.EVENT_CREATE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  // Issue #5/#55: plan limit checked BEFORE creating an active event.
  const activeCount = await activeEventCount(organizationId);
  await assertEventLimit(req.organization, activeCount);

  const defaults = await orgDefaultsFor(organizationId);
  const patch = eventPatch(req.body, { organization: req.organization, defaults });
  patch.organizationId = organizationId;
  patch.createdBy = req.user._id;
  patch.status = 'live';
  patch.paused = false;
  if (!patch.startDate) patch.startDate = new Date();
  if (!patch.endDate) patch.endDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
  if (patch.branding === undefined) patch.branding = { logos: [], logoUrl: null, tagline: '' };
  if (patch.layoutPrices === undefined) {
    patch.layoutPrices = resolveLayoutPrices({ orgPrices: defaults.layoutPrices });
  }

  const event = await Event.create(patch);
  await touchAssignedDevices(organizationId);
  await orgAudit(req, 'event.created', 'event', `Event “${event.name}” created`);
  const devices = await devicesFor(organizationId);
  res.status(201).json({ event: eventView(event, { devices, organization: req.organization }) });
}));

router.get('/events/:id', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), asyncRoute(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  const devices = await devicesFor(orgId(req));
  res.json({ event: eventView(event, { devices, organization: req.organization }) });
}));

router.put('/events/:id', requirePerm(PERMS.EVENT_EDIT), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const event = await Event.findOne({ _id: req.params.id, organizationId });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');

  const defaults = await orgDefaultsFor(organizationId);
  const patch = eventPatch(req.body, { organization: req.organization, existing: event, defaults });
  Object.assign(event, patch);

  // Issue #52: editing an event may manage its assigned devices in the same call.
  if (Array.isArray(req.body.deviceIds)) {
    const wanted = req.body.deviceIds.map(String);
    const devices = await Device.find({ organizationId, _id: { $in: wanted } });
    if (devices.length !== new Set(wanted).size) throw badRequest('One or more selected devices do not belong to this organization.', 'BAD_DEVICE_SELECTION');
    await Device.updateMany({ organizationId, assignedEventId: event._id, _id: { $nin: wanted } }, { assignedEventId: null });
    await Device.updateMany({ organizationId, _id: { $in: wanted } }, { assignedEventId: event._id });
  }

  if (patch.templatePrices !== undefined) {
    event.markModified('templatePrices');
  }
  if (patch.layoutPrices !== undefined) {
    event.markModified('layoutPrices');
  }
  await event.save();
  await touchAssignedDevices(organizationId);
  await orgAudit(req, 'event.updated', 'event', `Event “${event.name}” updated`);
  const devices = await devicesFor(organizationId);
  res.json({ event: eventView(event, { devices, organization: req.organization }) });
}));

router.post('/events/:id/pause', requirePerm(PERMS.EVENT_EDIT), requireWritableOrg, asyncRoute(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  event.paused = true;
  event.status = 'live';
  await event.save();
  await orgAudit(req, 'event.paused', 'event', `Event “${event.name}” paused`);
  res.json({ ok: true, status: computeEventStatus(event) });
}));

router.post('/events/:id/resume', requirePerm(PERMS.EVENT_EDIT), requireWritableOrg, asyncRoute(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  event.paused = false;
  await event.save();
  await orgAudit(req, 'event.resumed', 'event', `Event “${event.name}” resumed`);
  res.json({ ok: true, status: computeEventStatus(event) });
}));

router.delete('/events/:id', requirePerm(PERMS.EVENT_EDIT), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const event = await Event.findOne({ _id: req.params.id, organizationId });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  if (isActiveEvent(event)) throw conflict('Pause the event before deleting it.', 'EVENT_ACTIVE');

  await Event.deleteOne({ _id: event._id });
  await Device.updateMany({ organizationId, assignedEventId: event._id }, { assignedEventId: null });
  await Coupon.updateMany({ organizationId }, { $pull: { eventIds: event._id } });
  await orgAudit(req, 'event.deleted', 'event', `Event “${event.name}” deleted`, 'warn');
  res.json({ ok: true });
}));

// ================================================================
// DEVICES  (#7, #51–#57)
// ================================================================

router.get('/devices', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const [devices, events, plan] = await Promise.all([
    devicesFor(organizationId), eventsFor(organizationId), planFor(req),
  ]);
  res.json({
    devices: devices.map((device) => deviceView(device, events)),
    // Issue #56: real usage against the assigned plan's device limit.
    limit: { used: devices.length, allowed: plan.deviceLimit },
    plan,
    canRegister: req.organization.status !== 'suspended'
      && plan.status !== 'expired'
      && devices.length < plan.deviceLimit,
  });
}));

/**
 * Register (create) a device from CRM. Issue #55: the plan limit is checked
 * before the device row exists — registration cannot exceed the plan.
 */
router.post('/devices', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const existing = await Device.countDocuments({ organizationId });
  await assertDeviceLimit(req.organization, existing);

  const deviceName = String(req.body.deviceName || '').trim();
  if (!deviceName) throw badRequest('A device name is required.', 'BAD_DEVICE');
  const deviceUuid = String(req.body.deviceUuid || '').trim() || `crm-${new mongoose.Types.ObjectId().toString()}`;
  if (await Device.findOne({ deviceUuid })) {
    throw conflict('A device with this installation id already exists.', 'DEVICE_EXISTS');
  }
  if (req.body.eventId) {
    const event = await Event.findOne({ _id: req.body.eventId, organizationId });
    if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  }

  const device = await Device.create({
    organizationId,
    deviceUuid,
    deviceName,
    location: String(req.body.location || '').trim(),
    // Hash only — `deviceToken` is not a schema path (models/Device.js).
    deviceTokenHash: Device.createToken().hash,
    operatorName: req.body.operatorName ? String(req.body.operatorName).trim() : null,
    operatorPhone: req.body.operatorPhone ? String(req.body.operatorPhone).trim() : null,
    assignedEventId: req.body.eventId || null,
    status: 'active',
  });

  await orgAudit(req, 'device.registered', 'device', `Device “${device.deviceName}” registered`);
  const events = await eventsFor(organizationId);
  const plan = await planFor(req);
  res.status(201).json({
    device: deviceView(device, events),
    limit: { used: existing + 1, allowed: plan.deviceLimit },
  });
}));

router.put('/devices/:id', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const device = await Device.findOne({ _id: req.params.id, organizationId });
  if (!device) throw notFound('Device not found.', 'DEVICE_NOT_FOUND');

  const changes = [];
  if (req.body.deviceName !== undefined) {
    const name = String(req.body.deviceName || '').trim();
    if (!name) throw badRequest('Device name cannot be empty.', 'BAD_DEVICE');
    if (name !== device.deviceName) { changes.push(`renamed “${device.deviceName}” → “${name}”`); device.deviceName = name; }
  }
  if (req.body.location !== undefined) device.location = String(req.body.location || '').trim();
  if (req.body.operatorName !== undefined) device.operatorName = String(req.body.operatorName || '').trim() || null;
  if (req.body.operatorPhone !== undefined) {
    const phone = String(req.body.operatorPhone || '').trim();
    if (phone.length > 20) throw badRequest('Phone number looks too long.', 'BAD_OPERATOR_PHONE');
    device.operatorPhone = phone || null;
  }
  if (req.body.status !== undefined) {
    if (!['active', 'inactive', 'blocked'].includes(req.body.status)) throw badRequest('Unknown device status.', 'BAD_DEVICE_STATUS');
    if (req.body.status !== device.status) {
      changes.push(`status → ${req.body.status}`);
      device.status = req.body.status;
    }
  }
  await device.save();

  if (changes.length) await orgAudit(req, 'device.updated', 'device', `${device.deviceName}: ${changes.join(', ')}`);
  const events = await eventsFor(organizationId);
  res.json({ device: deviceView(device, events) });
}));

router.post('/devices/:id/assign', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const existing = await Device.findOne({ _id: req.params.id, organizationId });
  if (!existing) throw notFound('Device not found.', 'DEVICE_NOT_FOUND');
  const event = await Event.findOne({ _id: req.body.eventId, organizationId });
  if (!event) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  const status = computeEventStatus(event);
  if (status === 'finished') throw conflict('Cannot assign a finished event to a device.', 'EVENT_FINISHED');

  const device = await Device.findOneAndUpdate(
    { _id: existing._id, organizationId },
    { $set: { assignedEventId: event._id } },
    { returnDocument: 'after' },
  );
  await orgAudit(req, 'event.assigned_to_device', 'event', `Event “${event.name}” assigned to ${device.deviceName}`);
  res.json({ ok: true, device: deviceView(device, await eventsFor(organizationId)) });
}));

router.post('/devices/:id/unassign', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const existing = await Device.findOne({ _id: req.params.id, organizationId });
  if (!existing) throw notFound('Device not found.', 'DEVICE_NOT_FOUND');
  const previousEvent = existing.assignedEventId
    ? await Event.findById(existing.assignedEventId).select('name')
    : null;
  const device = await Device.findOneAndUpdate(
    { _id: existing._id, organizationId },
    { $set: { assignedEventId: null } },
    { returnDocument: 'after' },
  );
  await orgAudit(req, 'event.unassigned_from_device', 'event', `Event ${previousEvent ? `“${previousEvent.name}”` : 'assignment'} removed from ${device.deviceName}`);
  res.json({ ok: true, device: deviceView(device, await eventsFor(organizationId)) });
}));

/**
 * Issue #57: deleting a device
 *   • removes it from saved data
 *   • blocks further authentication (token row gone → 410 DEVICE_DELETED)
 *   • invalidates the booth-side cached configuration (next heartbeat fails)
 *   • stops the deleted booth from continuing to operate offline because the
 *     client cannot refresh a snapshot that no longer exists
 */
router.delete('/devices/:id', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const device = await Device.findOne({ _id: req.params.id, organizationId });
  if (!device) throw notFound('Device not found.', 'DEVICE_NOT_FOUND');

  const snapshot = { id: String(device._id), name: device.deviceName };
  await Device.deleteOne({ _id: device._id });
  // Detach the booth's photos/payments history but keep the financial records.
  await Photo.updateMany({ deviceId: device._id }, { $set: { deviceId: null } }).catch(() => {});

  await orgAudit(req, 'device.removed', 'device', `Device “${snapshot.name}” removed — booth pairing invalidated`, 'warn');
  res.json({ ok: true, device: snapshot, invalidated: true });
}));

// ================================================================
// GUEST SUPPORT — tickets (#6, #39, #40)
// ================================================================

function ticketView(ticket, { events = [], devices = [] } = {}) {
  const event = events.find((row) => String(row._id) === String(ticket.eventId));
  const device = devices.find((row) => String(row._id) === String(ticket.deviceId));
  return {
    id: String(ticket._id),
    organizationId: ticket.organizationId ? String(ticket.organizationId) : null,
    subject: ticket.subject,
    category: ticket.category || 'general',
    priority: ticket.priority === 'normal' ? 'medium' : ticket.priority || 'medium',
    status: ticket.status === 'in-progress' ? 'in_progress' : ticket.status,
    guest: { name: ticket.name || 'Guest', contact: ticket.email || '' },
    event: event ? { id: String(event._id), name: event.name } : null,
    device: device ? { id: String(device._id), name: device.deviceName } : null,
    sessionId: ticket.sessionId || null,
    paymentReference: ticket.paymentReference || null,
    messages: (ticket.messages || ticket.adminNotes || []).map((message) => ({
      id: message._id ? String(message._id) : undefined,
      author: message.authorName || 'Guest (booth)',
      text: message.text,
      at: message.at ? new Date(message.at).toISOString() : null,
    })),
    resolution: ticket.resolution || null,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : null,
    updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : null,
  };
}

router.get('/tickets', requirePerm(PERMS.TICKETS_RESOLVE), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const query = { organizationId };
  if (req.query.status) query.status = req.query.status === 'in_progress' ? { $in: ['in-progress', 'in_progress'] } : req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  const tickets = await SupportTicket.find(query).sort({ updatedAt: -1 }).lean();
  const [events, devices] = await Promise.all([eventsFor(organizationId), devicesFor(organizationId)]);
  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  await SupportTicket.find({ organizationId }).lean().then((all) => {
    for (const ticket of all) {
      const key = ticket.status === 'in-progress' ? 'in_progress' : ticket.status;
      if (counts[key] !== undefined) counts[key] += 1;
    }
  });
  res.json({ tickets: tickets.map((ticket) => ticketView(ticket, { events, devices })), counts });
}));

router.get('/tickets/:id', requirePerm(PERMS.TICKETS_RESOLVE), asyncRoute(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, organizationId: orgId(req) }).lean();
  if (!ticket) throw notFound('Ticket not found.', 'TICKET_NOT_FOUND');
  const [events, devices] = await Promise.all([eventsFor(orgId(req)), devicesFor(orgId(req))]);
  res.json({ ticket: ticketView(ticket, { events, devices }) });
}));

router.post('/tickets/:id/reply', requirePerm(PERMS.TICKETS_RESOLVE), asyncRoute(async (req, res) => {
  const message = String(req.body.message || req.body.text || '').trim();
  if (!message) throw badRequest('Message cannot be empty.', 'EMPTY_MESSAGE');
  const ticket = await SupportTicket.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!ticket) throw notFound('Ticket not found.', 'TICKET_NOT_FOUND');
  ticket.adminNotes.push({ text: message, createdAt: new Date() });
  if (ticket.status === 'open') ticket.status = 'in-progress';
  await ticket.save();
  const [events, devices] = await Promise.all([eventsFor(orgId(req)), devicesFor(orgId(req))]);
  res.json({ ticket: ticketView(ticket.toObject(), { events, devices }) });
}));

router.post('/tickets/:id/resolve', requirePerm(PERMS.TICKETS_RESOLVE), asyncRoute(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!ticket) throw notFound('Ticket not found.', 'TICKET_NOT_FOUND');
  ticket.status = 'resolved';
  ticket.resolution = String(req.body.note || req.body.resolution || 'Resolved by the organization team.').trim();
  ticket.resolvedAt = new Date();
  await ticket.save();
  await orgAudit(req, 'ticket.resolved', 'ticket', `Ticket “${ticket.subject}” resolved`);
  const [events, devices] = await Promise.all([eventsFor(orgId(req)), devicesFor(orgId(req))]);
  res.json({ ticket: ticketView(ticket.toObject(), { events, devices }) });
}));

router.post('/tickets/:id/reopen', requirePerm(PERMS.TICKETS_RESOLVE), asyncRoute(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!ticket) throw notFound('Ticket not found.', 'TICKET_NOT_FOUND');
  if (!['resolved', 'closed'].includes(ticket.status)) throw conflict('Only a resolved ticket can be reopened.', 'TICKET_NOT_RESOLVED');
  ticket.status = 'open';
  ticket.resolvedAt = null;
  await ticket.save();
  await orgAudit(req, 'ticket.reopened', 'ticket', `Ticket “${ticket.subject}” reopened`, 'warn');
  const [events, devices] = await Promise.all([eventsFor(orgId(req)), devicesFor(orgId(req))]);
  res.json({ ticket: ticketView(ticket.toObject(), { events, devices }) });
}));

// ================================================================
// PLATFORM SUPPORT (#37–#40)
// ================================================================

function platformSupportView(request, { organization = null, creator = null } = {}) {
  const raw = typeof request.toObject === 'function' ? request.toObject() : request;
  const decisionBy = raw.decision && raw.decision.by ? raw.decision.by : null;
  return {
    id: String(raw._id || raw.id),
    ticketNo: raw.ticketNo || null,
    organizationId: raw.organizationId ? String(raw.organizationId) : null,
    organization: organization
      ? { id: String(organization._id), name: organization.name, email: organization.email }
      : null,
    subject: raw.subject,
    category: raw.category || 'other',
    priority: raw.priority || 'medium',
    status: raw.status,
    creator: creator
      ? { id: String(creator._id), name: creator.name, role: creator.role }
      : (raw.createdBy ? { id: String(raw.createdBy), name: 'Team member' } : null),
    messages: (raw.messages || []).map((message) => ({
      id: message._id ? String(message._id) : undefined,
      authorId: message.authorId ? String(message.authorId) : null,
      authorName: message.authorName,
      authorRole: message.authorRole,
      side: message.side,
      text: message.text,
      images: message.images || [],
      at: message.at ? new Date(message.at).toISOString() : null,
    })),
    decision: raw.decision && raw.decision.type
      ? {
          type: raw.decision.type,
          reason: raw.decision.reason || null,
          by: decisionBy ? String(decisionBy) : null,
          byName: raw.decision.byName || null,
          at: raw.decision.at ? new Date(raw.decision.at).toISOString() : null,
        }
      : null,
    lastReapplication: raw.lastReapplication && raw.lastReapplication.at
      ? {
          text: raw.lastReapplication.text || null,
          images: raw.lastReapplication.images || [],
          at: new Date(raw.lastReapplication.at).toISOString(),
        }
      : null,
    reapplyCount: Number(raw.reapplyCount) || 0,
    resolution: raw.resolution || null,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
  };
}

const SUPPORT_CATEGORIES = ['technical', 'billing', 'account', 'feature', 'other'];
const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const SUPPORT_STATUSES = ['new', 'denied', 'open', 'in_progress', 'resolved'];

function sanitizeSupportImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .filter((item) => item.startsWith('data:image/') || item.startsWith('http://') || item.startsWith('https://') || item.startsWith('/uploads/') || item.startsWith('/api/'))
    .slice(0, 6);
}

router.get('/platform-support', requirePerm(PERMS.ORG_PLATFORM_SUPPORT), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const query = { organizationId };
  if (req.query.status) query.status = req.query.status;
  const [requests, all, creator] = await Promise.all([
    PlatformSupportRequest.find(query).sort({ updatedAt: -1 }).lean(),
    PlatformSupportRequest.find({ organizationId }).select('status').lean(),
    User.findById(req.user._id).lean(),
  ]);
  const counts = Object.fromEntries(SUPPORT_STATUSES.map((status) => [status, 0]));
  for (const row of all) if (counts[row.status] !== undefined) counts[row.status] += 1;
  res.json({
    requests: requests.map((request) => platformSupportView(request, { organization: req.organization, creator })),
    counts,
  });
}));

/**
 * Issue #37: creating a platform support request used to 500. It now stores
 * subject, category, priority, organization, creator, the initial message and
 * a status, and returns the created ticket.
 */
router.post('/platform-support', requirePerm(PERMS.ORG_PLATFORM_SUPPORT), requireWritableOrg, asyncRoute(async (req, res) => {
  const subject = String(req.body.subject || '').trim().slice(0, 160);
  const message = String(req.body.message || req.body.text || '').trim().slice(0, 2000);
  const images = sanitizeSupportImages(req.body.images);
  if (!subject) throw badRequest('A subject is required.', 'SUBJECT_REQUIRED');

  const request = await PlatformSupportRequest.create({
    organizationId: orgId(req),
    createdBy: req.user._id,
    subject,
    category: SUPPORT_CATEGORIES.includes(req.body.category) ? req.body.category : 'other',
    priority: SUPPORT_PRIORITIES.includes(req.body.priority) ? req.body.priority : 'medium',
    status: 'new',
    ticketNo: null,
    messages: (message || images.length > 0)
      ? [{
          authorId: req.user._id,
          authorName: req.user.name,
          authorRole: req.user.role,
          side: 'org',
          text: message,
          images,
          at: new Date(),
        }]
      : [],
  });

  await orgAudit(req, 'organization.platform_support.requested', 'support_request', `Platform support requested: “${subject}”`);
  const creator = await User.findById(req.user._id).lean();
  res.status(201).json({ request: platformSupportView(request, { organization: req.organization, creator }) });
}));

router.get('/platform-support/:id', requirePerm(PERMS.ORG_PLATFORM_SUPPORT), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findOne({ _id: req.params.id, organizationId: orgId(req) }).lean();
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  const creator = request.createdBy ? await User.findById(request.createdBy).lean() : null;
  res.json({ request: platformSupportView(request, { organization: req.organization, creator }) });
}));

router.post('/platform-support/:id/reply', requirePerm(PERMS.ORG_PLATFORM_SUPPORT), requireWritableOrg, asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (!['open', 'in_progress'].includes(request.status)) {
    throw conflict('Messages can only be sent on an accepted, active ticket.', 'TICKET_NOT_OPEN');
  }
  const text = String(req.body.message || req.body.text || '').trim();
  const images = sanitizeSupportImages(req.body.images);
  if (!text && images.length === 0) throw badRequest('A message or image attachment is required.', 'EMPTY_MESSAGE');
  request.messages.push({
    authorId: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
    side: 'org',
    text,
    images,
    at: new Date(),
  });
  request.status = 'in_progress';
  await request.save();
  const creator = await User.findById(request.createdBy).lean();
  res.json({ request: platformSupportView(request, { organization: req.organization, creator }) });
}));

router.post('/platform-support/:id/reapply', requirePerm(PERMS.ORG_PLATFORM_SUPPORT), requireWritableOrg, asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (request.status !== 'denied') throw conflict('Only a denied request can be re-applied.', 'TICKET_NOT_DENIED');
  const text = String(req.body.message || req.body.text || '').trim();
  const images = sanitizeSupportImages(req.body.images);
  if (!text && images.length === 0) throw badRequest('Explain what changed since the last decision.', 'EMPTY_MESSAGE');

  const message = {
    authorId: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
    side: 'org',
    text,
    images,
    at: new Date(),
  };
  request.messages.push(message);
  if (request.decision && request.decision.type) {
    request.decision = { type: null, reason: null, by: null, at: null, byName: null };
  }
  request.status = 'new';
  request.ticketNo = null;
  request.reapplyCount = (Number(request.reapplyCount) || 0) + 1;
  request.lastReapplication = { text, images, authorId: req.user._id, at: new Date() };
  request.resolution = null;
  await request.save();
  await orgAudit(req, 'organization.platform_support.reapplied', 'support_request', `Re-applied platform support request “${request.subject}”`);
  const creator = await User.findById(request.createdBy).lean();
  res.json({ request: platformSupportView(request, { organization: req.organization, creator }) });
}));

// ================================================================
// DEFAULTS (#45–#50)
// ================================================================

function defaultsView(defaults, organization) {
  const raw = defaults.toObject ? defaults.toObject() : defaults;
  const layoutPrices = resolveLayoutPrices({ orgPrices: raw.layoutPrices });
  const planKey = String(organization?.plan || 'trial').toLowerCase();
  const canUseCustomGateways = ['premium', 'custom'].includes(planKey);
  return {
    id: String(raw._id),
    organizationId: String(raw.organizationId),
    name: raw.name || organization.name,
    logoUrl: raw.logoUrl || organization.logoUrl || null,
    plan: planKey,
    canUseCustomGateways,
    tagline: raw.tagline || '',
    boothTimeoutSec: raw.boothTimeoutSec || 60,
    upiId: raw.upiId || null,
    payoutMode: raw.payoutMode || 'wallet',
    // Payment Gateway Settings
    razorpayKeyId: raw.razorpayKeyId || '',
    hasRazorpaySecret: Boolean(raw.razorpayKeySecret),
    cashfreeAppId: raw.cashfreeAppId || '',
    hasCashfreeSecret: Boolean(raw.cashfreeSecretKey),
    cashfreeEnv: raw.cashfreeEnv || 'production',
    razorpayEnv: raw.razorpayEnv || (raw.razorpayKeyId && raw.razorpayKeyId.startsWith('rzp_test_') ? 'sandbox' : 'production'),
    gatewayPriority: raw.gatewayPriority || 'razorpay',
    paymentDisplayName: raw.paymentDisplayName || `${organization.name} · HappyPix`,
    maximumPrints: raw.maximumPrints || 10,
    printOptions: raw.printOptions && raw.printOptions.length ? raw.printOptions : [1, 2, 4, 6, 8, 10],
    // Issue #45/#46: overrides saved by the org, plus the full resolved map so
    // event creation, event editing and booth snapshots all agree.
    layoutPrices: Object.fromEntries(Object.entries(layoutPrices)),
    layoutPriceOverrides: raw.layoutPrices instanceof Map
      ? Object.fromEntries(raw.layoutPrices)
      : { ...(raw.layoutPrices || {}) },
    templatePrices: raw.templatePrices instanceof Map
      ? Object.fromEntries(raw.templatePrices)
      : { ...(raw.templatePrices || {}) },
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
  };
}

router.get('/defaults', requirePerm(PERMS.DEFAULTS_VIEW), asyncRoute(async (req, res) => {
  const defaults = await orgDefaultsFor(orgId(req));
  const setting = await Setting.findOne({ organizationId: orgId(req) }).lean();
  if (setting) {
    if (!defaults.razorpayKeyId && setting.razorpayKeyId) defaults.razorpayKeyId = setting.razorpayKeyId;
    if (!defaults.razorpayKeySecret && setting.razorpayKeySecret) defaults.razorpayKeySecret = setting.razorpayKeySecret;
    if (!defaults.cashfreeAppId && setting.cashfreeAppId) defaults.cashfreeAppId = setting.cashfreeAppId;
    if (!defaults.cashfreeSecretKey && setting.cashfreeSecretKey) defaults.cashfreeSecretKey = setting.cashfreeSecretKey;
    if (!defaults.cashfreeEnv && setting.cashfreeEnv) defaults.cashfreeEnv = setting.cashfreeEnv;
    if (!defaults.gatewayPriority && setting.gatewayPriority) defaults.gatewayPriority = setting.gatewayPriority;
  }
  res.json(defaultsView(defaults, req.organization));
}));

router.put('/defaults', requirePerm(PERMS.DEFAULTS_EDIT), requireWritableOrg, asyncRoute(async (req, res) => {
  const defaults = await orgDefaultsFor(orgId(req));
  const body = req.body;

  // Plan gate: custom gateways require Business (Premium) or Enterprise (Custom)
  const planKey = String(req.organization?.plan || '').toLowerCase();
  const canUseCustomGateways = ['premium', 'custom'].includes(planKey);
  const isSettingCustomGateway = (
    (body.razorpayKeyId !== undefined && String(body.razorpayKeyId).trim() !== '') ||
    (body.razorpayKeySecret !== undefined && String(body.razorpayKeySecret).trim() !== '' && body.razorpayKeySecret !== '********') ||
    (body.cashfreeAppId !== undefined && String(body.cashfreeAppId).trim() !== '') ||
    (body.cashfreeSecretKey !== undefined && String(body.cashfreeSecretKey).trim() !== '' && body.cashfreeSecretKey !== '********')
  );
  if (isSettingCustomGateway && !canUseCustomGateways) {
    throw badRequest(
      'Custom Payment Gateways (Razorpay / Cashfree) are exclusively available on Business (Premium) and Enterprise plans. Please upgrade your plan to connect your own gateways.',
      'PREMIUM_PLAN_REQUIRED'
    );
  }

  if (body.name !== undefined) {
    const orgName = String(body.name || '').trim().slice(0, 120);
    defaults.name = orgName;
    if (orgName && orgId(req)) {
      await Organization.findByIdAndUpdate(orgId(req), { name: orgName }).catch(() => {});
      if (req.organization) req.organization.name = orgName;
    }
  }
  if (body.logoUrl !== undefined) defaults.logoUrl = body.logoUrl || null;
  if (body.tagline !== undefined) defaults.tagline = String(body.tagline || '').trim().slice(0, 120);
  if (body.boothTimeoutSec !== undefined) {
    const timeout = Number(body.boothTimeoutSec);
    if (!Number.isFinite(timeout) || timeout < 10 || timeout > 86400) {
      throw badRequest('Booth timeout must be between 10 and 86400 seconds.', 'BAD_TIMEOUT');
    }
    defaults.boothTimeoutSec = Math.round(timeout);
  }
  if (body.upiId !== undefined) {
    const upiId = String(body.upiId || '').trim();
    if (upiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
      throw badRequest('Enter a valid UPI ID, e.g. business@okaxis.', 'BAD_UPI');
    }
    defaults.upiId = upiId || null;
  }
  if (body.payoutMode !== undefined) {
    if (!['upi', 'wallet'].includes(body.payoutMode)) throw badRequest('Payout mode must be upi or wallet.', 'BAD_PAYOUT_MODE');
    if (body.payoutMode === 'upi' && !(body.upiId || defaults.upiId)) {
      throw badRequest('Add a UPI ID before switching payouts to UPI.', 'UPI_REQUIRED');
    }
    defaults.payoutMode = body.payoutMode;
  }
  if (body.paymentDisplayName !== undefined) {
    defaults.paymentDisplayName = String(body.paymentDisplayName || '').trim().slice(0, 80);
  }
  if (body.razorpayKeyId !== undefined) {
    defaults.razorpayKeyId = String(body.razorpayKeyId || '').trim();
  }
  if (body.razorpayKeySecret !== undefined && body.razorpayKeySecret !== '********' && String(body.razorpayKeySecret).trim() !== '') {
    defaults.razorpayKeySecret = String(body.razorpayKeySecret).trim();
  }
  if (body.razorpayEnv !== undefined) {
    defaults.razorpayEnv = body.razorpayEnv === 'sandbox' ? 'sandbox' : 'production';
  }
  if (body.cashfreeAppId !== undefined) {
    defaults.cashfreeAppId = String(body.cashfreeAppId || '').trim();
  }
  if (body.cashfreeSecretKey !== undefined && body.cashfreeSecretKey !== '********' && String(body.cashfreeSecretKey).trim() !== '') {
    defaults.cashfreeSecretKey = String(body.cashfreeSecretKey).trim();
  }
  if (body.cashfreeEnv !== undefined) {
    defaults.cashfreeEnv = body.cashfreeEnv === 'sandbox' ? 'sandbox' : 'production';
  }
  if (body.gatewayPriority !== undefined) {
    defaults.gatewayPriority = body.gatewayPriority === 'cashfree' ? 'cashfree' : 'razorpay';
  }
  if (body.maximumPrints !== undefined) {
    const max = Number(body.maximumPrints);
    if (!Number.isInteger(max) || max < 1 || max > 50) throw badRequest('Maximum prints must be between 1 and 50.', 'BAD_PRINT_LIMIT');
    defaults.maximumPrints = max;
  }
  if (body.printOptions !== undefined) {
    defaults.printOptions = (Array.isArray(body.printOptions) ? body.printOptions : [])
      .map(Number).filter((value) => Number.isInteger(value) && value > 0).slice(0, 12);
  }
  // Issue #45: layout prices persist (validated against known iterations).
  if (body.layoutPriceOverrides !== undefined || body.layoutPrices !== undefined) {
    const incoming = body.layoutPriceOverrides !== undefined ? body.layoutPriceOverrides : body.layoutPrices;
    const current = defaults.layoutPrices instanceof Map ? Object.fromEntries(defaults.layoutPrices) : { ...(defaults.layoutPrices || {}) };
    defaults.layoutPrices = validateLayoutPrices(incoming, current);
    defaults.markModified('layoutPrices');
  }
  if (body.templatePrices !== undefined) {
    const rawTpl = typeof body.templatePrices === 'object' && body.templatePrices !== null ? body.templatePrices : {};
    const sanitized = {};
    for (const [tplId, pr] of Object.entries(rawTpl)) {
      const num = Number(pr);
      if (Number.isFinite(num) && num >= 0) {
        sanitized[tplId] = Math.round(num);
      }
    }
    defaults.templatePrices = sanitized;
    defaults.markModified('templatePrices');
  }

  await defaults.save();

  // Sync to Setting model so booth endpoints fetch identically
  await Setting.findOneAndUpdate(
    { organizationId: orgId(req) },
    {
      $set: {
        razorpayKeyId: defaults.razorpayKeyId,
        razorpayKeySecret: defaults.razorpayKeySecret,
        cashfreeAppId: defaults.cashfreeAppId,
        cashfreeSecretKey: defaults.cashfreeSecretKey,
        cashfreeEnv: defaults.cashfreeEnv,
        gatewayPriority: defaults.gatewayPriority,
        upiId: defaults.upiId || '',
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  ).catch((e) => console.warn('Sync Setting failed:', e.message));
  await orgAudit(req, 'organization.defaults.updated', 'organization_defaults', 'Organization defaults updated');

  // Issue #49/#72: booths must pick the change up — recompute their revision.
  await touchAssignedDevices(orgId(req));

  res.json(defaultsView(defaults, req.organization));
}));

/** Bump a device's snapshot revision so the booth refreshes on next heartbeat. */
async function touchAssignedDevices(organizationId) {
  await Device.updateMany({ organizationId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
}

// ================================================================
// COUPONS (#41–#44)
// ================================================================

router.get('/coupons', requirePerm(PERMS.COUPONS_MANAGE), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const [coupons, events] = await Promise.all([
    Coupon.find({ organizationId }).sort({ createdAt: -1 }),
    eventsFor(organizationId),
  ]);
  res.json({
    coupons: coupons.map((coupon) => couponView(coupon, { events })),
    events: events.map((event) => ({ id: String(event._id), name: event.name, status: computeEventStatus(event) })),
  });
}));

router.post('/coupons', requirePerm(PERMS.COUPONS_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const patch = validateCouponCreate(couponPatch(req.body));
  if (await Coupon.findOne({ organizationId, code: patch.code })) {
    throw conflict('A coupon with this code already exists.', 'COUPON_EXISTS');
  }
  if (patch.eventIds && patch.eventIds.length) {
    const owned = await Event.countDocuments({ organizationId, _id: { $in: patch.eventIds } });
    if (owned !== patch.eventIds.length) throw badRequest('One or more selected events do not belong to this organization.', 'BAD_COUPON_EVENTS');
  }
  const coupon = await Coupon.create({ ...patch, organizationId, usedCount: patch.usedCount || 0, status: 'active' });
  await orgAudit(req, 'coupon.created', 'coupon', `Coupon ${coupon.code} created (${coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`} off, ${coupon.quantity} uses)`);
  const events = await eventsFor(organizationId);
  res.status(201).json({ coupon: couponView(coupon, { events }) });
}));

router.put('/coupons/:id', requirePerm(PERMS.COUPONS_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const coupon = await Coupon.findOne({ _id: req.params.id, organizationId });
  if (!coupon) throw notFound('Coupon not found.', 'COUPON_NOT_FOUND');
  // Issues #41/#42: locked identity fields are rejected with a clear code.
  const patch = couponPatch(req.body, coupon);
  if (patch.code && patch.code !== coupon.code && await Coupon.findOne({ organizationId, code: patch.code, _id: { $ne: coupon._id } })) {
    throw conflict('A coupon with this code already exists.', 'COUPON_EXISTS');
  }
  Object.assign(coupon, patch);
  await coupon.save();
  await orgAudit(req, 'coupon.updated', 'coupon', `Coupon ${coupon.code} updated`);
  const events = await eventsFor(organizationId);
  res.json({ coupon: couponView(coupon, { events }) });
}));

router.post('/coupons/:id/pause', requirePerm(PERMS.COUPONS_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!coupon) throw notFound('Coupon not found.', 'COUPON_NOT_FOUND');
  coupon.status = 'paused';
  await coupon.save();
  await orgAudit(req, 'coupon.paused', 'coupon', `Coupon ${coupon.code} paused`);
  res.json({ ok: true, coupon: couponView(coupon) });
}));

router.post('/coupons/:id/activate', requirePerm(PERMS.COUPONS_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!coupon) throw notFound('Coupon not found.', 'COUPON_NOT_FOUND');
  coupon.status = 'active';
  await coupon.save();
  await orgAudit(req, 'coupon.updated', 'coupon', `Coupon ${coupon.code} re-activated`);
  res.json({ ok: true, coupon: couponView(coupon) });
}));

router.delete('/coupons/:id', requirePerm(PERMS.COUPONS_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!coupon) throw notFound('Coupon not found.', 'COUPON_NOT_FOUND');
  await Coupon.deleteOne({ _id: coupon._id });
  await orgAudit(req, 'coupon.deleted', 'coupon', `Coupon ${coupon.code} deleted`, 'warn');
  res.json({ ok: true });
}));

/** Booth-side validation (also used by the booth quote endpoint). */
router.post('/coupons/validate', requirePerm(PERMS.EVENTS_DEVICES_MANAGE), asyncRoute(async (req, res) => {
  const coupon = await findCouponForOrg(orgId(req), req.body.code);
  const result = applyCoupon(coupon, { gross: Number(req.body.gross) || 0, eventId: req.body.eventId });
  res.json(result);
}));

// ================================================================
// TEAM (#27, #28, #31–#36)
// ================================================================

function memberView(user) {
  const role = user.role;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    roleLabel: role,
    status: user.status,
    // Issue #27/#28: the ACTUAL stored lastLoginAt, ISO formatted.
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
  };
}

async function activeAdminCount(organizationId, excludeId = null) {
  const query = { organizationId, role: { $in: [ROLES.ORG_ADMIN, 'ORGANIZATION_ADMIN', 'ORGADMIN', 'org_admin'] }, status: 'active' };
  if (excludeId) query._id = { $ne: excludeId };
  return User.countDocuments(query);
}

router.get('/team', requirePerm(PERMS.ORG_TEAM_VIEW), asyncRoute(async (req, res) => {
  const members = await User.find({ organizationId: orgId(req) })
    .select('-password -forgotPasswordCodeHash -emailChangeCodeHash')
    .sort({ createdAt: 1 });
  const views = members.map(memberView);
  // Issue #31/#32/#33: the frontend reads `members`; older builds read `team`.
  // Both are returned so the page can never get stuck behind a loader.
  res.json({
    members: views,
    team: views,
    canManage: req.user.role === ROLES.ORG_ADMIN,
    readOnly: req.user.role !== ROLES.ORG_ADMIN,
    activeAdmins: views.filter((member) => member.role === ROLES.ORG_ADMIN && member.status === 'active').length,
  });
}));

router.post('/team', requirePerm(PERMS.ORG_TEAM_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const role = req.body.role === ROLES.ORG_ADMIN ? ROLES.ORG_ADMIN : ROLES.ORG_MANAGER;
  if (!name || !email || !password) throw badRequest('Name, email and password are required.', 'BAD_MEMBER');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.', 'BAD_EMAIL');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest('Password must be at least 8 characters and contain a letter and a number.', 'WEAK_PASSWORD');
  }
  if (await User.findOne({ email })) throw conflict('A user with this email already exists.', 'EMAIL_TAKEN');

  const member = await User.create({
    name,
    email,
    password,
    role,
    organizationId: orgId(req),
    status: 'active',
  });
  await orgAudit(req, 'organization.team.created', 'user', `${role === ROLES.ORG_ADMIN ? 'Organization Admin' : 'Organization Manager'} ${name} created`);
  res.status(201).json({ member: memberView(member), user: memberView(member) });
}));

router.put('/team/:id', requirePerm(PERMS.ORG_TEAM_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!member) throw notFound('Team member not found.', 'MEMBER_NOT_FOUND');
  const keys = Object.keys(req.body || {});
  if (keys.some((key) => key !== 'status')) {
    throw forbidden('Organization Admins cannot edit a team member’s name, email or role — only activation status.', 'IDENTITY_IMMUTABLE');
  }
  if (!['active', 'inactive'].includes(req.body.status)) throw badRequest('Status must be active or inactive.', 'BAD_STATUS');
  // Issue #36: the last active admin cannot be deactivated.
  if (member.role === ROLES.ORG_ADMIN && req.body.status !== 'active' && (await activeAdminCount(orgId(req), member._id)) === 0) {
    throw conflict('This is the last active Organization Admin — promote another admin first.', 'LAST_ADMIN');
  }
  if (String(member._id) === String(req.user._id) && req.body.status !== 'active') {
    throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  }
  member.status = req.body.status;
  if (member.status !== 'active') member.sessionVersion = (Number(member.sessionVersion) || 0) + 1; // sign the member out
  await member.save();
  await orgAudit(req, member.status === 'active' ? 'organization.team.reactivated' : 'organization.team.deactivated', 'user', `Team member ${member.name} ${member.status === 'active' ? 're-activated' : 'deactivated'}`, member.status === 'active' ? 'info' : 'warn');
  res.json({ member: memberView(member) });
}));

router.post('/team/:id/deactivate', requirePerm(PERMS.ORG_TEAM_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!member) throw notFound('Team member not found.', 'MEMBER_NOT_FOUND');
  if (String(member._id) === String(req.user._id)) throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  if (member.role === ROLES.ORG_ADMIN && (await activeAdminCount(orgId(req), member._id)) === 0) {
    throw conflict('This is the last active Organization Admin — promote another admin first.', 'LAST_ADMIN');
  }
  member.status = 'inactive';
  member.sessionVersion = (Number(member.sessionVersion) || 0) + 1;
  await member.save();
  await orgAudit(req, 'organization.team.deactivated', 'user', `Team member ${member.name} deactivated`, 'warn');
  res.json({ ok: true, member: memberView(member) });
}));

router.post('/team/:id/activate', requirePerm(PERMS.ORG_TEAM_MANAGE), requireWritableOrg, asyncRoute(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, organizationId: orgId(req) });
  if (!member) throw notFound('Team member not found.', 'MEMBER_NOT_FOUND');
  member.status = 'active';
  await member.save();
  await orgAudit(req, 'organization.team.reactivated', 'user', `Team member ${member.name} re-activated`);
  res.json({ ok: true, member: memberView(member) });
}));

// ================================================================
// GALLERY (#18, #60, #61)
// ================================================================

router.get('/gallery', requirePerm(PERMS.ORG_GALLERY_VIEW), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const settings = await getGallerySettings({ fresh: true });
  const [events, devices] = await Promise.all([eventsFor(organizationId), devicesFor(organizationId)]);
  const eventOptions = events.map((event) => ({ id: String(event._id), name: event.name }));
  const boothOptions = devices.map((device) => ({ id: String(device._id), name: device.deviceName }));

  if (!settings.galleryEnabled) {
    // Issue #16/#18: galleries off platform-wide → nothing is published.
    return res.json({
      enabled: false,
      requireGuestConsent: settings.requireGuestConsent,
      photos: [],
      events: eventOptions,
      booths: boothOptions,
    });
  }

  const query = { organizationId };
  // Ignore malformed filter ids instead of letting Mongoose throw a
  // CastError (which surfaced as an empty/broken gallery page).
  if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) query.eventId = req.query.eventId;
  if (req.query.boothId && mongoose.Types.ObjectId.isValid(req.query.boothId)) query.deviceId = req.query.boothId;
  let photos = await Photo.find(query).sort({ generatedAt: -1, createdAt: -1 }).limit(500).lean();

  // Auto-backfill: if an orphaned photo has a deviceId, attach it to device's current event
  const unlinkedPhotos = photos.filter((p) => !p.eventId && p.deviceId);
  if (unlinkedPhotos.length > 0) {
    for (const orphan of unlinkedPhotos) {
      const dev = devices.find((d) => String(d._id) === String(orphan.deviceId));
      if (dev && dev.assignedEventId) {
        orphan.eventId = dev.assignedEventId;
        Photo.updateOne({ _id: orphan._id }, { $set: { eventId: dev.assignedEventId } }).catch(() => {});
      }
    }
  }

  photos = photos.filter((photo) => photoVisibleInGallery(photo, settings));

  // Deduplicate by session so each booth session shows its single final
  // composited print image (compositeUrl preferred over raw frame url).
  const bySession = new Map();
  const standalone = [];
  for (const photo of photos) {
    const sid = photo.sessionId ? String(photo.sessionId).trim() : '';
    if (!sid) {
      standalone.push(photo);
      continue;
    }
    const existing = bySession.get(sid);
    const isThisComposite = Boolean(photo.compositeUrl && (photo.url === photo.compositeUrl || photo.isComposite || photo.type === 'composite'));
    const isExistingComposite = Boolean(existing && existing.compositeUrl && (existing.url === existing.compositeUrl || existing.isComposite || existing.type === 'composite'));

    if (!existing) {
      bySession.set(sid, photo);
    } else if (isThisComposite && !isExistingComposite) {
      bySession.set(sid, { ...photo, compositeUrl: photo.compositeUrl || existing.compositeUrl, finalised: true });
    } else if (!existing.compositeUrl && photo.compositeUrl) {
      bySession.set(sid, { ...existing, compositeUrl: photo.compositeUrl, finalised: true });
    } else if (!existing.finalised && photo.finalised) {
      bySession.set(sid, photo);
    }
  }
  const finalRecords = [...bySession.values(), ...standalone].sort((a, b) => {
    const ta = new Date(a.generatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.generatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  // The bucket is private: raw S3 URLs 403 in a browser. Hand the CRM
  // short-lived signed URLs (see services/photoUrlService.js). Signing is
  // local crypto, so doing it per-photo here is cheap.
  const signedPhotos = await Promise.all(finalRecords.map(async (photo) => {
    const finalTarget = photo.compositeUrl || photo.url;
    const finalImageUrl = await signedPhotoUrl({ ...photo, compositeUrl: finalTarget, url: finalTarget });
    const rawImageUrl = await signedPhotoUrl({ ...photo, compositeUrl: null });
    const eventObj = eventOptions.find((event) => event.id === String(photo.eventId));
    const eventName = eventObj ? eventObj.name : (photo.eventId ? 'Archived event' : 'General / Booth capture');
    return {
      id: String(photo._id),
      url: finalImageUrl || rawImageUrl,
      imageUrl: finalImageUrl,
      finalImageUrl,
      compositeUrl: finalImageUrl,
      proxyUrl: `/api/org/gallery/photo/${photo._id}/view`,
      hasComposite: Boolean(photo.compositeUrl || photo.finalised),
      eventId: photo.eventId ? String(photo.eventId) : null,
      eventName,
      boothId: photo.deviceId ? String(photo.deviceId) : null,
      boothName: boothOptions.find((booth) => booth.id === String(photo.deviceId))?.name || 'Booth station',
      guestConsent: photo.guestConsent === true,
      generatedAt: photo.generatedAt ? new Date(photo.generatedAt).toISOString() : null,
      capturedAt: photo.createdAt ? new Date(photo.createdAt).toISOString() : null,
      printStatus: photo.printStatus || 'printed',
      digitalStatus: photo.digitalStatus || 'delivered',
    };
  }));

  res.json({
    enabled: true,
    requireGuestConsent: settings.requireGuestConsent,
    photos: signedPhotos,
    events: eventOptions,
    booths: boothOptions,
  });
}));

// Direct streaming endpoint for gallery images (handles data: URLs and private S3 buckets securely)
router.get('/gallery/photo/:id/view', requirePerm(PERMS.ORG_GALLERY_VIEW), asyncRoute(async (req, res) => {
  const organizationId = orgId(req);
  const settings = await getGallerySettings();
  if (!settings.galleryEnabled) throw forbidden('Gallery is currently disabled by platform policy.', 'GALLERY_DISABLED');
  const photo = await Photo.findOne({ _id: req.params.id, organizationId }).lean();
  if (!photo) throw notFound('Photo not found.', 'PHOTO_NOT_FOUND');
  if (!photoVisibleInGallery(photo, settings)) {
    throw forbidden('This photo requires guest publishing consent.', 'CONSENT_REQUIRED');
  }

  const kind = req.query.kind || 'composite';
  const targetUrl = (kind === 'composite' && photo.compositeUrl) ? photo.compositeUrl : (photo.compositeUrl || photo.url);
  if (!targetUrl) throw notFound('Image content not available.', 'IMAGE_NOT_FOUND');

  // Case 1: Data URL stored directly in MongoDB
  if (targetUrl.startsWith('data:')) {
    const commaIndex = targetUrl.indexOf(',');
    if (commaIndex !== -1) {
      const header = targetUrl.slice(0, commaIndex);
      const base64Data = targetUrl.slice(commaIndex + 1);
      const mimeMatch = header.match(/^data:([^;]+);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(base64Data, 'base64'));
    }
  }

  // Case 2: S3 object stream
  const key = s3KeyFromUrl(targetUrl) || (kind !== 'composite' ? photo.s3Key : null) || photo.s3Key;
  if (key && process.env.S3_BUCKET_NAME) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      });
      const s3Response = await s3.send(command);
      res.setHeader('Content-Type', s3Response.ContentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const chunks = [];
      for await (const chunk of s3Response.Body) {
        chunks.push(chunk);
      }
      return res.send(Buffer.concat(chunks));
    } catch (err) {
      console.warn('⚠️ Direct S3 stream failed for photo:', err.message);
    }
  }

  // Fallback: Redirect to signed URL or stored URL
  const signed = await signedPhotoUrl({ compositeUrl: kind === 'composite' ? targetUrl : null, url: targetUrl });
  return res.redirect(signed || targetUrl);
}));

// ================================================================
// TEMPLATES (org view of the global library)
// ================================================================

router.get('/templates', requirePerm(PERMS.GLOBAL_TEMPLATES_USE), asyncRoute(async (req, res) => {
  const templates = await Template.find({ active: true }).sort({ createdAt: -1 }).lean();
  res.json({
    templates: templates.map((template) => ({
      id: String(template._id),
      name: template.name,
      category: template.category,
      description: template.description,
      price: Number(template.price) || 0,
      layoutId: template.layoutId,
      layout: layoutMeta(template.layoutId),
      design: template.design || {},
      source: template.source || 'playground',
      usage: template.usage || 0,
      active: template.active !== false,
      createdAt: template.createdAt,
    })),
  });
}));

// ================================================================
// AUDIT (#21–#25)
// ================================================================

router.get('/audit', requirePerm(PERMS.ORG_AUDIT_VIEW), asyncRoute(async (req, res) => {
  const query = { organizationId: orgId(req) };
  // Issue #24: filter and sort on `at`.
  if (req.query.from || req.query.to) {
    query.at = {};
    if (req.query.from) query.at.$gte = new Date(req.query.from);
    if (req.query.to) query.at.$lte = new Date(`${req.query.to}T23:59:59`);
  }
  if (req.query.action) {
    const safePattern = String(req.query.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.action = { $regex: safePattern, $options: 'i' };
  }
  if (req.query.severity) query.severity = req.query.severity;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [rows, total, actors] = await Promise.all([
    AuditLog.find(query).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
    User.find({ organizationId: orgId(req) }).select('name role').lean(),
  ]);
  res.json({
    items: rows.map(auditView).sort(byAtDesc),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    actors: actors.map((actor) => ({ id: String(actor._id), name: actor.name, role: actor.role })),
  });
}));

// ─── AI TEMPLATES ────────────────────────────────────────────────────────────

router.get('/template-layouts', async (req, res) => {
  try {
    const layouts = await TemplateLayout.find().sort({ createdAt: -1 });
    res.json({ layouts: layouts.map(l => ({ id: l._id.toString(), ...l._doc })) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global layouts' });
  }
});

async function uploadDataUrlAsset(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(0, commaIdx);
  const b64 = dataUrl.slice(commaIdx + 1).replace(/\s/g, '');
  const mimeMatch = header.match(/^data:([^;]+)/);
  const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';
  const ext = mimetype.includes('png') ? 'png' : mimetype.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(b64, 'base64');

  const uploaded = await uploadToS3({
    buffer,
    mimetype,
    folder: 'templates/assets',
    originalname: `ai-asset-${Date.now()}.${ext}`,
  });

  // If S3 was not available and uploadToS3 fell back to localhost disk URL,
  // keep the inline dataUrl so remote booths (Android/Vercel) can still render it.
  const isLocalhostFallback =
    typeof uploaded.url === 'string' &&
    (uploaded.url.startsWith('http://localhost') || uploaded.url.startsWith('http://127.0.0.1'));

  return {
    key: uploaded.key,
    url: isLocalhostFallback ? dataUrl : uploaded.url,
  };
}

async function processTempTemplateAssets(body) {
  if (!body.assets || !Array.isArray(body.assets)) body.assets = [];

  // Sync any updated decoration/background data URLs (e.g. from Cutout Studio or Remove BG) into body.assets
  if (body.design?.decorations && Array.isArray(body.design.decorations)) {
    for (const dec of body.design.decorations) {
      if (dec && typeof dec.url === 'string' && dec.url.startsWith('data:')) {
        const existing = dec.assetId ? body.assets.find((a) => a.assetId === dec.assetId) : null;
        if (existing) {
          existing.url = dec.url;
          existing.isTemp = true;
        } else {
          const tempId = dec.assetId || `temp-dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          dec.assetId = tempId;
          body.assets.push({
            assetId: tempId,
            url: dec.url,
            type: 'decoration',
            role: 'decoration',
            isTemp: true,
          });
        }
      }
    }
  }

  const rawBgUrl = body.design?.background?.url || body.design?.bg?.url;
  if (typeof rawBgUrl === 'string' && rawBgUrl.startsWith('data:')) {
    const bgAssetId = body.design?.background?.assetId || body.design?.bg?.assetId;
    const existingBg = (bgAssetId && body.assets.find((a) => a.assetId === bgAssetId)) ||
      body.assets.find((a) => a.role === 'background' || a.type === 'background');
    if (existingBg) {
      existingBg.url = rawBgUrl;
      existingBg.isTemp = true;
    } else {
      const tempId = bgAssetId || `temp-bg-${Date.now()}`;
      if (body.design?.background && typeof body.design.background === 'object') body.design.background.assetId = tempId;
      if (body.design?.bg && typeof body.design.bg === 'object') body.design.bg.assetId = tempId;
      body.assets.push({
        assetId: tempId,
        url: rawBgUrl,
        type: 'background',
        role: 'background',
        isTemp: true,
      });
    }
  }

  for (const asset of body.assets) {
    if (asset && asset.url && typeof asset.url === 'string' && asset.url.startsWith('data:')) {
      try {
        const uploaded = await uploadDataUrlAsset(asset.url);
        if (uploaded) {
          const oldId = asset.assetId;
          asset.assetId = uploaded.key;
          asset.url = uploaded.url;
          delete asset.isTemp;

          if (body.design?.background?.assetId === oldId) {
            body.design.background.assetId = uploaded.key;
            body.design.background.url = uploaded.url;
          }
          if (body.design?.bg?.assetId === oldId) {
            body.design.bg.assetId = uploaded.key;
            body.design.bg.url = uploaded.url;
          }
          if (body.design?.decorations && Array.isArray(body.design.decorations)) {
            body.design.decorations.forEach((d) => {
              if (d && d.assetId === oldId) {
                d.assetId = uploaded.key;
                d.url = uploaded.url;
              }
            });
          }
        }
      } catch (assetErr) {
        console.warn('⚠️ Asset upload processing error (keeping inline URL):', assetErr.message);
        delete asset.isTemp;
      }
    }
  }
}

router.get('/ai-templates', async (req, res) => {
  try {
    const filter = getOrgFilter(req.user);
    const [templates, defaults] = await Promise.all([
      OrgAiTemplate.find(filter).sort({ createdAt: -1 }).lean(),
      req.user.organizationId ? OrganizationDefaults.findOne({ organizationId: req.user.organizationId }).lean() : null,
    ]);
    const orgTplPrices = defaults?.templatePrices instanceof Map
      ? Object.fromEntries(defaults.templatePrices)
      : (defaults?.templatePrices || {});
    res.json({
      templates: templates.map((t) => {
        const id = t._id.toString();
        const storedPrice = orgTplPrices[id] != null && !isNaN(Number(orgTplPrices[id]))
          ? Number(orgTplPrices[id])
          : (t.price != null && !isNaN(Number(t.price)) ? Number(t.price) : 0);
        return {
          id,
          ...t,
          category: t.category || 'Custom',
          description: t.description || '',
          price: storedPrice,
        };
      }),
    });
  } catch (error) {
    console.error('GET /ai-templates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch templates' });
  }
});

router.post('/ai-generate', requireWritableOrg, aiLimiter, async (req, res) => {
  try {
    const { prompt, layout, currentDesign = {}, currentAssets = [] } = req.body;
    if (!prompt || !layout) {
      return res.status(400).json({ error: 'Prompt and layout are required' });
    }

    const org = await Organization.findById(req.organization._id);
    const balance = Number(org?.aiCredits) || 0;
    if (!org || balance < 5) {
      return res.status(403).json({
        error: `Insufficient AI Credits. Generating an AI template requires 5 credits (current balance: ${balance}). Please upgrade your plan or purchase an AI Credits pack.`,
        code: 'INSUFFICIENT_AI_CREDITS',
        balance,
        required: 5,
      });
    }

    const aiService = new TemplateGenerationService();

    // Generate/Patch design and create assets
    const { design, assets, layout: unchangedLayout } = await aiService.generate(prompt, {
      layout,
      currentDesign,
      currentAssets
    });

    // Deduct 5 AI credits
    const updatedOrg = await Organization.findByIdAndUpdate(
      req.organization._id,
      { $inc: { aiCredits: -5 } },
      { returnDocument: 'after' }
    );
    if (req.organization) req.organization.aiCredits = Math.max(0, Number(updatedOrg?.aiCredits) || 0);

    res.json({
      updatedDesign: design,
      newAssets: assets,
      layout: unchangedLayout,
      remainingCredits: Math.max(0, Number(updatedOrg?.aiCredits) || 0),
    });
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: error.message || 'Failed to generate AI template' });
  }
});

router.post('/ai-templates', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };

    // Ensure name is never empty (required field)
    if (!body.name || body.name.trim() === '') {
      body.name = 'AI Generated Template';
    } else {
      body.name = body.name.trim();
    }

    // Ensure layout.code exists (required field)
    if (!body.layout?.code) {
      return res.status(400).json({ error: 'layout.code is required to save template' });
    }

    await processTempTemplateAssets(body);

    const hasPriceInput = body.price !== undefined && body.price !== null && body.price !== '';
    const parsedPrice = hasPriceInput ? Math.max(0, Math.round(Number(body.price) || 0)) : 0;

    const template = await OrgAiTemplate.create({
      ...body,
      category: body.category ? String(body.category).trim() : 'Custom',
      description: body.description ? String(body.description).trim() : '',
      price: parsedPrice,
      organizationId: req.user.organizationId,
      createdBy: req.user._id
    });

    if (req.user.organizationId && hasPriceInput) {
      await OrganizationDefaults.findOneAndUpdate(
        { organizationId: req.user.organizationId },
        {
          $set: { [`templatePrices.${template._id.toString()}`]: parsedPrice },
          $setOnInsert: { organizationId: req.user.organizationId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      ).catch((err) => console.warn('⚠️ Failed to sync template price to OrganizationDefaults:', err.message));
    }

    await touchAssignedDevices(req.user.organizationId);
    await writeAudit({ req, action: 'organization.template.created', entity: 'OrgAiTemplate', summary: `Created template ${template.name}` });
    res.json({ template: { id: template._id.toString(), ...template.toObject(), price: parsedPrice } });
  } catch (error) {
    console.error('Save AI Template Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save template' });
  }
});

const updateOrgAiTemplateHandler = async (req, res) => {
  try {
    const template = await OrgAiTemplate.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const body = { ...(req.body || {}) };
    await processTempTemplateAssets(body);

    if (body.name !== undefined && String(body.name).trim()) {
      template.name = String(body.name).trim();
    }
    if (body.category !== undefined) {
      template.category = String(body.category || 'Custom').trim();
    }
    if (body.description !== undefined) {
      template.description = String(body.description || '').trim();
    }
    if (body.layout && body.layout.code) {
      template.layout = body.layout;
    }
    if (body.slots !== undefined && Array.isArray(body.slots)) {
      template.slots = body.slots;
    }
    if (body.design !== undefined) {
      template.design = body.design;
    }
    if (body.assets !== undefined && Array.isArray(body.assets)) {
      template.assets = body.assets;
    }
    if (body.versions !== undefined && Array.isArray(body.versions)) {
      template.versions = body.versions;
    }
    if (body.prompt !== undefined) {
      template.prompt = body.prompt;
    }
    if (body.source !== undefined) {
      template.source = body.source;
    }

    const hasPriceInput = body.price !== undefined && body.price !== null && body.price !== '';
    if (hasPriceInput) {
      const parsedPrice = Math.max(0, Math.round(Number(body.price) || 0));
      template.price = parsedPrice;
      if (req.user.organizationId) {
        await OrganizationDefaults.findOneAndUpdate(
          { organizationId: req.user.organizationId },
          {
            $set: { [`templatePrices.${template._id.toString()}`]: parsedPrice },
            $setOnInsert: { organizationId: req.user.organizationId },
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).catch((err) => console.warn('⚠️ Failed to sync updated template price to OrganizationDefaults:', err.message));
      }
    }

    await template.save();
    await touchAssignedDevices(req.user.organizationId);
    await writeAudit({ req, action: 'organization.template.updated', entity: 'OrgAiTemplate', summary: `Updated template ${template.name}` });
    res.json({ template: { id: template._id.toString(), ...template.toObject(), price: Number(template.price) || 0 } });
  } catch (error) {
    console.error('Update AI Template Error:', error);
    res.status(500).json({ error: error.message || 'Failed to update template' });
  }
};

router.put('/ai-templates/:id', updateOrgAiTemplateHandler);
router.patch('/ai-templates/:id', updateOrgAiTemplateHandler);

router.delete('/ai-templates/:id', async (req, res) => {
  try {
    const template = await OrgAiTemplate.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (req.user.organizationId) {
      await OrganizationDefaults.updateOne(
        { organizationId: req.user.organizationId },
        { $unset: { [`templatePrices.${req.params.id}`]: 1 } },
      ).catch(() => {});
    }
    await touchAssignedDevices(req.user.organizationId);
    await writeAudit({ req, action: 'organization.template.deleted', entity: 'OrgAiTemplate', summary: `Deleted AI template ${template.name}` });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete AI Template Error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete template' });
  }
});

router.post('/remove-bg', async (req, res) => {
  try {
    const { image, tolerance, feather, mode } = req.body;
    if (!image) return res.status(400).json({ error: 'Image data is required.' });

    const org = await Organization.findById(req.organization._id);
    const balance = Number(org?.aiCredits) || 0;
    if (!org || balance < 1) {
      return res.status(403).json({
        error: 'Insufficient AI Credits (0 credits left). Please upgrade your plan or purchase an AI Credits pack to use AI background removal.',
        code: 'INSUFFICIENT_AI_CREDITS',
        balance: 0,
        required: 1,
      });
    }

    const result = await removeBackground(image, { tolerance, feather, mode });

    // Deduct 1 credit
    const updatedOrg = await Organization.findByIdAndUpdate(
      req.organization._id,
      { $inc: { aiCredits: -1 } },
      { returnDocument: 'after' }
    );
    if (req.organization) req.organization.aiCredits = Math.max(0, Number(updatedOrg?.aiCredits) || 0);

    res.json({
      ...result,
      remainingCredits: Math.max(0, Number(updatedOrg?.aiCredits) || 0),
    });
  } catch (err) {
    console.error('[remove-bg error]:', err);
    res.status(500).json({ error: err.message || 'Background removal failed' });
  }
});

export default router;
