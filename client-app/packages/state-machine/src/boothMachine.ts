// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — XState v5 State Machine
//
//  RULE: Every booth action is state-driven. Never button-driven.
//
//  Flow:
//    BOOT → DEVICE_CHECK → EVENT_SYNC → READY
//    → COUNTDOWN → CAPTURE → FILTER → PREVIEW
//    → PAYMENT → PRINT → COMPLETE → (back to READY)
// ─────────────────────────────────────────────────────────────────

import { setup, assign, fromPromise } from 'xstate';
import type { ActiveEvent, CapturedPhoto, PrintTemplate, FilterType, GlobalSettings } from '../../types/src/index';

// ── Context ───────────────────────────────────────────────────────

export interface BoothContext {
  // Event
  activeEvent: ActiveEvent | null;
  isAdminAssigned: boolean;
  globalSettings: GlobalSettings;

  // Session
  selectedTemplate: PrintTemplate | null;
  orientation: 'vertical' | 'horizontal';
  frames: number;
  images: CapturedPhoto[];
  selectedImages: CapturedPhoto[];
  retakeIndex: number | null;
  activeFilter: FilterType;
  taglineText: string;
  optionalLogoUrl: string;

  // Payment
  prints: number;
  digitalCopy: boolean;
  couponCode: string;
  totalAmount: number;
  razorpayOrderId: string | null;
  downloadToken: string | null;

  // Device
  cameraReady: boolean;
  printerReady: boolean;

  // Errors
  error: string | null;

  // Countdown
  shotsLeft: number;
  countdown: number;
}

// ── Events ────────────────────────────────────────────────────────

export type BoothEvent =
  // Device check
  | { type: 'DEVICES_READY' }
  | { type: 'DEVICE_CHECK_FAILED'; error: string }
  // Event sync
  | { type: 'EVENT_LOADED'; event: ActiveEvent; settings?: GlobalSettings; isAdminAssigned: boolean }
  | { type: 'EVENT_JOINED'; event: ActiveEvent }
  | { type: 'EVENT_SYNC_FAILED'; error: string }
  // Ready → start
  | { type: 'START_SESSION' }
  | { type: 'TEMPLATE_SELECTED'; template: PrintTemplate }
  // Capture
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'PHOTO_TAKEN'; photo: CapturedPhoto }
  | { type: 'RETAKE'; index: number }
  | { type: 'ALL_SHOTS_DONE' }
  // Filter
  | { type: 'FILTER_SELECTED'; filter: FilterType }
  | { type: 'FILTER_CONFIRMED' }
  // Preview
  | { type: 'PREVIEW_CONFIRMED'; selectedImages: CapturedPhoto[] }
  | { type: 'BACK_TO_CAPTURE' }
  // Payment
  | { type: 'PAYMENT_INITIATED'; orderId: string; amount: number; prints: number; digitalCopy: boolean }
  | { type: 'PAYMENT_SUCCESS'; token: string }
  | { type: 'PAYMENT_FREE' }
  | { type: 'PAYMENT_CANCELLED' }
  // Print
  | { type: 'PRINT_DONE' }
  | { type: 'PRINT_FAILED'; error: string }
  // Reset
  | { type: 'RESET' }
  | { type: 'ADMIN_EVENT_CHANGED'; event: ActiveEvent }
  | { type: 'ADMIN_EVENT_CLEARED' }
  | { type: 'SET_TAGLINE'; tagline: string }
  | { type: 'SET_OPTIONAL_LOGO'; logoUrl: string }
  | { type: 'SWAP_IMAGES'; indexA: number; indexB: number };

// ── Initial Context ───────────────────────────────────────────────

export const initialContext: BoothContext = {
  activeEvent: null,
  isAdminAssigned: false,
  globalSettings: { printPrice: 100, taxRate: 0, boothTimeout: 30 },
  selectedTemplate: null,
  orientation: 'vertical',
  frames: 4,
  images: [],
  selectedImages: [],
  retakeIndex: null,
  activeFilter: 'none',
  taglineText: '',
  optionalLogoUrl: '',
  prints: 1,
  digitalCopy: false,
  couponCode: '',
  totalAmount: 0,
  razorpayOrderId: null,
  downloadToken: null,
  cameraReady: false,
  printerReady: false,
  error: null,
  shotsLeft: 5,
  countdown: 3,
};

// ── Machine ───────────────────────────────────────────────────────

export const boothMachine = setup({
  types: {
    context: {} as BoothContext,
    events: {} as BoothEvent,
  },
  delays: {
    boothTimeoutMs: ({ context }) => {
      const timeout = context.activeEvent?.boothTimeout ?? context.globalSettings?.boothTimeout ?? 30;
      return timeout * 1000;
    },
  },
  actions: {
    setDevicesReady: assign({
      cameraReady: true,
      printerReady: true,
      error: null,
    }),
    setDeviceError: assign({
      error: ({ event }) =>
        event.type === 'DEVICE_CHECK_FAILED' ? event.error : 'Device check failed',
    }),
    loadEvent: assign({
      activeEvent: ({ event }) =>
        event.type === 'EVENT_LOADED' ? event.event : null,
      isAdminAssigned: ({ event }) =>
        event.type === 'EVENT_LOADED' ? event.isAdminAssigned : false,
      globalSettings: ({ event, context }) =>
        event.type === 'EVENT_LOADED' && event.settings
          ? event.settings
          : context.globalSettings,
    }),
    joinEvent: assign({
      activeEvent: ({ event }) =>
        event.type === 'EVENT_JOINED' ? event.event : null,
      isAdminAssigned: false,
    }),
    selectTemplate: assign({
      selectedTemplate: ({ event, context }) => {
        if (event.type !== 'TEMPLATE_SELECTED') return null;
        
        const newTemplate = event.template;
        const currentTemplate = context.selectedTemplate;
        
        // If new template has no slots (universal background), preserve existing layout
        if (currentTemplate && (!newTemplate.photoSlots || newTemplate.photoSlots.length === 0)) {
           return {
             ...newTemplate,
             photoSlots: (currentTemplate as any).photoSlots || (currentTemplate as any).slots || [],
             slots: (currentTemplate as any).photoSlots || (currentTemplate as any).slots || [],
             canvas: currentTemplate.canvas || { width: 1200, height: 1800 },
             frames: currentTemplate.frames
           };
        }
        
        return newTemplate;
      },
      frames: ({ event, context }) => {
        if (event.type !== 'TEMPLATE_SELECTED') return 4;
        const currentTemplate = context.selectedTemplate;
        if (currentTemplate && (!event.template.photoSlots || event.template.photoSlots.length === 0)) {
          return currentTemplate.frames || 4;
        }
        return event.template.frames;
      },
      orientation: ({ event }) =>
        event.type === 'TEMPLATE_SELECTED'
          ? event.template.orientation === 'portrait'
            ? 'vertical'
            : 'horizontal'
          : 'vertical',
      shotsLeft: ({ event, context }) => {
        if (event.type !== 'TEMPLATE_SELECTED') return 5;
        let frames = event.template.frames;
        
        const currentTemplate = context.selectedTemplate;
        if (currentTemplate && (!event.template.photoSlots || event.template.photoSlots.length === 0)) {
          frames = currentTemplate.frames || 4;
        }
        
        const isPreviewEnabled = !context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('preview');
        
        if (!isPreviewEnabled) {
          return frames;
        }
        
        let shots = frames * 2;
        if (shots < 3) shots = 3;
        if (shots > 10) shots = 10;
        return shots;
      },
    }),
    addPhoto: assign({
      images: ({ context, event }) =>
        event.type === 'PHOTO_TAKEN'
          ? [...context.images, event.photo]
          : context.images,
      selectedImages: ({ context, event }) => {
        if (event.type !== 'PHOTO_TAKEN') return context.selectedImages;
        const newImages = [...context.images, event.photo];
        if (context.shotsLeft - 1 <= 0) {
          return newImages.slice(0, context.frames);
        }
        return context.selectedImages;
      },
      shotsLeft: ({ context }) => context.shotsLeft - 1,
    }),
    setRetake: assign({
      retakeIndex: ({ event }) =>
        event.type === 'RETAKE' ? event.index : null,
    }),
    selectFilter: assign({
      activeFilter: ({ event }) =>
        event.type === 'FILTER_SELECTED' ? event.filter : 'none',
    }),
    confirmPreview: assign({
      selectedImages: ({ event }) =>
        event.type === 'PREVIEW_CONFIRMED' ? event.selectedImages : [],
    }),
    initiatePayment: assign({
      razorpayOrderId: ({ event }) =>
        event.type === 'PAYMENT_INITIATED' ? event.orderId : null,
      totalAmount: ({ event }) =>
        event.type === 'PAYMENT_INITIATED' ? event.amount : 0,
      prints: ({ event }) =>
        event.type === 'PAYMENT_INITIATED' ? event.prints : 1,
      digitalCopy: ({ event }) =>
        event.type === 'PAYMENT_INITIATED' ? event.digitalCopy : false,
    }),
    paymentSuccess: assign({
      downloadToken: ({ event }) =>
        event.type === 'PAYMENT_SUCCESS' ? event.token : null,
    }),
    adminEventChanged: assign({
      activeEvent: ({ event }) =>
        event.type === 'ADMIN_EVENT_CHANGED' ? event.event : null,
      isAdminAssigned: true,
    }),
    adminEventCleared: assign({
      activeEvent: null,
      isAdminAssigned: false,
    }),
    setTagline: assign({
      taglineText: ({ event }) =>
        event.type === 'SET_TAGLINE' ? event.tagline : '',
    }),
    setOptionalLogo: assign({
      optionalLogoUrl: ({ event }) =>
        event.type === 'SET_OPTIONAL_LOGO' ? event.logoUrl : '',
    }),
    swapImages: assign({
      selectedImages: ({ context, event }) => {
        if (event.type !== 'SWAP_IMAGES') return context.selectedImages;
        const next = [...context.selectedImages];
        const temp = next[event.indexA];
        next[event.indexA] = next[event.indexB];
        next[event.indexB] = temp;
        return next;
      },
    }),
    resetSession: assign({
      images: [],
      selectedImages: [],
      retakeIndex: null,
      activeFilter: 'none',
      taglineText: '',
      optionalLogoUrl: '',
      prints: 1,
      digitalCopy: false,
      couponCode: '',
      totalAmount: 0,
      razorpayOrderId: null,
      downloadToken: null,
      shotsLeft: 5,
      countdown: 3,
      selectedTemplate: null,
      error: null,
    }),
  },
  guards: {
    hasActiveEvent: ({ context }) => context.activeEvent !== null,
    allShotsTaken: ({ context }) => context.shotsLeft <= 0,
    paymentRequired: ({ context }) => context.totalAmount > 0,
    shouldShowFilterAfterCapture: ({ context }) => 
      context.shotsLeft <= 0 && (!context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('filter')),
    shouldShowPreviewAfterCapture: ({ context }) => 
      context.shotsLeft <= 0 && (!context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('preview')),
    shouldShowPaymentAfterCapture: ({ context }) => 
      context.shotsLeft <= 0 && (!context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('payment')),
    shouldShowPrintAfterCapture: ({ context }) => 
      context.shotsLeft <= 0 && (!context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('print')),
    shouldShowPreview: ({ context }) => 
      !context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('preview'),
    shouldShowPayment: ({ context }) => 
      !context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('payment'),
    shouldShowPrint: ({ context }) => 
      !context.activeEvent?.selectedScreens || context.activeEvent.selectedScreens.includes('print'),
  },
}).createMachine({
  id: 'booth',
  initial: 'BOOT',
  context: initialContext,

  // Admin event changes can fire from any state
  on: {
    ADMIN_EVENT_CHANGED: {
      actions: 'adminEventChanged',
    },
    ADMIN_EVENT_CLEARED: {
      actions: 'adminEventCleared',
      target: '.EVENT_SYNC',
    },
    SET_TAGLINE: {
      actions: 'setTagline',
    },
    SET_OPTIONAL_LOGO: {
      actions: 'setOptionalLogo',
    },
    SWAP_IMAGES: {
      actions: 'swapImages',
    },
    RESET: {
      target: '.READY',
    },
    TEMPLATE_SELECTED: {
      actions: 'selectTemplate',
    },
  },

  states: {
    // ── BOOT: App just launched, checking cameras + printers ──────
    BOOT: {
      on: {
        DEVICES_READY: {
          target: 'DEVICE_CHECK',
          actions: 'setDevicesReady',
        },
        DEVICE_CHECK_FAILED: {
          target: 'BOOT',
          actions: 'setDeviceError',
        },
      },
    },

    // ── DEVICE_CHECK: Verify camera + printer found ───────────────
    DEVICE_CHECK: {
      always: [
        { target: 'EVENT_SYNC', guard: 'hasActiveEvent' },
        { target: 'EVENT_SYNC' },
      ],
    },

    // ── EVENT_SYNC: Load event from admin or passkey ──────────────
    EVENT_SYNC: {
      on: {
        EVENT_LOADED: {
          target: 'READY',
          actions: 'loadEvent',
        },
        EVENT_JOINED: {
          target: 'READY',
          actions: 'joinEvent',
        },
        EVENT_SYNC_FAILED: {
          target: 'EVENT_SYNC',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },

    // ── READY: Idle, waiting for customer ─────────────────────────
    READY: {
      entry: 'resetSession',
      on: {
        START_SESSION: { target: 'FRAME_SELECTION' },
      },
    },

    // ── FRAME_SELECTION: Customer picks template ──────────────────
    FRAME_SELECTION: {
      on: {
        TEMPLATE_SELECTED: {
          target: 'COUNTDOWN',
          actions: 'selectTemplate',
        },
      },
    },

    // ── COUNTDOWN: 3-2-1 before each shot ─────────────────────────
    COUNTDOWN: {
      on: {
        COUNTDOWN_TICK: { target: 'COUNTDOWN' },
        PHOTO_TAKEN: [
          {
            target: 'FILTER',
            actions: 'addPhoto',
            guard: 'shouldShowFilterAfterCapture',
          },
          {
            target: 'PREVIEW',
            actions: 'addPhoto',
            guard: 'shouldShowPreviewAfterCapture',
          },
          {
            target: 'PAYMENT',
            actions: 'addPhoto',
            guard: 'shouldShowPaymentAfterCapture',
          },
          {
            target: 'PRINT',
            actions: 'addPhoto',
            guard: 'shouldShowPrintAfterCapture',
          },
          {
            target: 'COMPLETE',
            actions: 'addPhoto',
            guard: 'allShotsTaken',
          },
          {
            target: 'COUNTDOWN',
            actions: 'addPhoto',
          },
        ],
        RETAKE: {
          target: 'COUNTDOWN',
          actions: 'setRetake',
        },
      },
    },

    // ── FILTER: Customer selects a filter ─────────────────────────
    FILTER: {
      on: {
        FILTER_SELECTED: {
          actions: 'selectFilter',
        },
        FILTER_CONFIRMED: [
          { target: 'PREVIEW', guard: 'shouldShowPreview' },
          { target: 'PAYMENT', guard: 'shouldShowPayment' },
          { target: 'PRINT', guard: 'shouldShowPrint' },
          { target: 'COMPLETE' },
        ],
      },
    },

    // ── PREVIEW: Customer reviews + arranges photos ───────────────
    PREVIEW: {
      on: {
        PREVIEW_CONFIRMED: [
          {
            target: 'PAYMENT',
            actions: 'confirmPreview',
            guard: 'shouldShowPayment'
          },
          {
            target: 'PRINT',
            actions: 'confirmPreview',
            guard: 'shouldShowPrint'
          },
          {
            target: 'COMPLETE',
            actions: 'confirmPreview'
          },
        ],
        BACK_TO_CAPTURE: { target: 'COUNTDOWN' },
      },
    },

    // ── PAYMENT: Razorpay ─────────────────────────────────────────
    PAYMENT: {
      on: {
        PAYMENT_INITIATED: {
          actions: 'initiatePayment',
        },
        PAYMENT_SUCCESS: [
          {
            target: 'PRINT',
            actions: 'paymentSuccess',
            guard: 'shouldShowPrint'
          },
          {
            target: 'COMPLETE',
            actions: 'paymentSuccess'
          }
        ],
        PAYMENT_FREE: [
          { target: 'PRINT', guard: 'shouldShowPrint' },
          { target: 'COMPLETE' }
        ],
        PAYMENT_CANCELLED: { target: 'READY' },
      },
    },

    // ── PRINT: Sending job to printer ─────────────────────────────
    PRINT: {
      on: {
        PRINT_DONE: { target: 'COMPLETE' },
        PRINT_FAILED: {
          target: 'COMPLETE',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },

    // ── COMPLETE: Show QR / success screen ───────────────────────
    COMPLETE: {
      after: {
        // Auto-reset to READY after boothTimeout seconds
        boothTimeoutMs: { target: 'READY' },
      },
      on: {
        RESET: { target: 'READY' },
      },
    },
  },
});

export { initialContext as boothInitialContext };
