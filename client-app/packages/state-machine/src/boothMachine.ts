// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — XState v5 State Machine
//  Models the complete guest flow and kiosk lifecycle.
// ─────────────────────────────────────────────────────────────────

import { setup, assign } from 'xstate';
import type {
  BoothEvent as BoothEventType,
  BoothSession,
  BoothSnapshot,
  BoothTemplate,
  CapturedPhoto,
  CheckoutQuote,
  Customization,
  Installation,
  Orientation,
  PaymentOrder,
  PrintOutcome,
} from '@happypix/types';

export interface MachineContext {
  installation: Installation | null;
  snapshot: BoothSnapshot | null;
  session: BoothSession;
  outcome: PrintOutcome | null;
  error: string | null;
}

export type MachineEvent =
  | { type: 'BOOT_RESOLVED'; installation: Installation; snapshot: BoothSnapshot }
  | { type: 'BOOT_UNPAIRED' }
  | { type: 'LOGIN_SUCCESS'; installation: Installation; snapshot: BoothSnapshot }
  | { type: 'SNAPSHOT_UPDATED'; snapshot: BoothSnapshot }
  | { type: 'START_SESSION' }
  | { type: 'SELECT_ORIENTATION'; orientation: Orientation }
  | { type: 'SELECT_TEMPLATE'; template: BoothTemplate }
  | { type: 'UPDATE_PRINTS'; prints: number; digitalCopy: boolean }
  | { type: 'QUOTE_OBTAINED'; quote: CheckoutQuote }
  | { type: 'PAYMENT_COMPLETED'; quote: CheckoutQuote; payment: PaymentOrder | null }
  | { type: 'PHOTOS_CAPTURED'; photos: CapturedPhoto[] }
  | { type: 'PHOTOS_SELECTED'; selectedPhotos: CapturedPhoto[] }
  | { type: 'CUSTOMIZATION_UPDATED'; customization: Customization }
  | { type: 'FINISH_AND_PRINT'; outcome: PrintOutcome }
  | { type: 'RESET_SESSION' }
  | { type: 'LOGOUT' };

export const defaultCustomization = (): Customization => ({
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
});

export const freshSession = (): BoothSession => ({
  id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  startedAt: new Date().toISOString(),
  orientation: null,
  template: null,
  prints: 1,
  digitalCopy: true,
  quote: null,
  payment: null,
  photos: [],
  selectedPhotos: [],
  customization: defaultCustomization(),
});

export const initialContext: MachineContext = {
  installation: null,
  snapshot: null,
  session: freshSession(),
  outcome: null,
  error: null,
};

export const boothMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
  },
  guards: {
    isLiveEvent: ({ context }) => context.snapshot?.event?.status === 'live',
  },
}).createMachine({
  id: 'booth',
  initial: 'boot',
  context: initialContext,
  states: {
    boot: {
      on: {
        BOOT_RESOLVED: {
          target: 'evaluatingEvent',
          actions: assign({
            installation: ({ event }) => event.installation,
            snapshot: ({ event }) => event.snapshot,
          }),
        },
        BOOT_UNPAIRED: { target: 'login' },
      },
    },

    login: {
      on: {
        LOGIN_SUCCESS: {
          target: 'evaluatingEvent',
          actions: assign({
            installation: ({ event }) => event.installation,
            snapshot: ({ event }) => event.snapshot,
          }),
        },
      },
    },

    evaluatingEvent: {
      always: [
        { target: 'start', guard: 'isLiveEvent' },
        { target: 'waiting' },
      ],
    },

    waiting: {
      on: {
        SNAPSHOT_UPDATED: [
          {
            target: 'start',
            guard: 'isLiveEvent',
            actions: assign({ snapshot: ({ event }) => event.snapshot }),
          },
          {
            actions: assign({ snapshot: ({ event }) => event.snapshot }),
          },
        ],
        LOGOUT: {
          target: 'login',
          actions: assign({ installation: null, snapshot: null }),
        },
      },
    },

    start: {
      on: {
        START_SESSION: {
          target: 'orientation',
          actions: assign({
            session: () => freshSession(),
            outcome: null,
          }),
        },
        SNAPSHOT_UPDATED: [
          {
            target: 'waiting',
            guard: ({ event }) => event.snapshot.event?.status !== 'live',
            actions: assign({ snapshot: ({ event }) => event.snapshot }),
          },
          {
            actions: assign({ snapshot: ({ event }) => event.snapshot }),
          },
        ],
        LOGOUT: {
          target: 'login',
          actions: assign({ installation: null, snapshot: null }),
        },
      },
    },

    orientation: {
      on: {
        SELECT_ORIENTATION: {
          target: 'templates',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              orientation: event.orientation,
              template: null,
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    templates: {
      on: {
        SELECT_TEMPLATE: {
          target: 'prints',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              template: event.template,
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    prints: {
      on: {
        UPDATE_PRINTS: {
          target: 'payment',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              prints: event.prints,
              digitalCopy: event.digitalCopy,
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    payment: {
      on: {
        PAYMENT_COMPLETED: {
          target: 'camera',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              quote: event.quote,
              payment: event.payment,
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    camera: {
      on: {
        PHOTOS_CAPTURED: {
          target: 'photos',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              photos: event.photos,
              selectedPhotos: event.photos.slice(
                0,
                context.session.template?.layout.slots ?? 1
              ),
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    photos: {
      on: {
        PHOTOS_SELECTED: {
          target: 'customize',
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              selectedPhotos: event.selectedPhotos,
            }),
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    customize: {
      on: {
        CUSTOMIZATION_UPDATED: {
          actions: assign({
            session: ({ context, event }) => ({
              ...context.session,
              customization: event.customization,
            }),
          }),
        },
        FINISH_AND_PRINT: {
          target: 'success',
          actions: assign({
            outcome: ({ event }) => event.outcome,
          }),
        },
        RESET_SESSION: { target: 'start' },
      },
    },

    success: {
      on: {
        RESET_SESSION: {
          target: 'evaluatingEvent',
          actions: assign({
            session: () => freshSession(),
            outcome: null,
          }),
        },
      },
    },
  },
});
