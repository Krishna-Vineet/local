import AsyncStorage from '@react-native-async-storage/async-storage';
import { boothApi, type Installation, type CompleteSessionInput } from '@happypix/api';

const OFFLINE_QUEUE_KEY = '@happypix_offline_sync_queue';
const MAX_QUEUE_SIZE = 50;
const MAX_ATTEMPTS = 8;

export interface QueuedSession {
  id: string;
  payload: CompleteSessionInput;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

let isProcessing = false;

/**
 * Enqueue a session payload for background retry when offline or slow network.
 */
export async function enqueueOfflineSession(payload: CompleteSessionInput): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedSession[] = raw ? JSON.parse(raw) : [];

    // Avoid duplicate queuing for the same session
    const existingIndex = queue.findIndex((q) => q.id === payload.sessionId);
    const item: QueuedSession = {
      id: payload.sessionId,
      payload,
      queuedAt: Date.now(),
      attempts: existingIndex >= 0 ? queue[existingIndex].attempts : 0,
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = item;
    } else {
      queue.push(item);
    }

    // Cap maximum queue length (keeps the newest sessions)
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
    console.log(`[OfflineSync] Queued session ${payload.sessionId} for background sync (queue length: ${trimmed.length})`);
  } catch (err) {
    console.warn('[OfflineSync] Failed to enqueue session:', err);
  }
}

/**
 * Process all pending offline sessions in the background when connectivity is healthy.
 */
export async function processOfflineSyncQueue(
  installation: Installation | null
): Promise<{ processed: number; remaining: number }> {
  if (!installation || isProcessing) {
    return { processed: 0, remaining: 0 };
  }

  isProcessing = true;
  let processed = 0;

  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      isProcessing = false;
      return { processed: 0, remaining: 0 };
    }

    const queue: QueuedSession[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) {
      isProcessing = false;
      return { processed: 0, remaining: 0 };
    }

    const remainingQueue: QueuedSession[] = [];

    for (const item of queue) {
      try {
        console.log(`[OfflineSync] Syncing queued session ${item.id} (attempt ${item.attempts + 1})...`);
        await boothApi.completeSession(installation, item.payload);
        processed++;
        console.log(`[OfflineSync] ✅ Session ${item.id} synced successfully!`);
      } catch (err: any) {
        console.warn(`[OfflineSync] Failed to sync session ${item.id}:`, err?.message || err);
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = err?.message || 'Sync failed';

        // Keep session in queue if it hasn't exceeded maximum attempts
        if (item.attempts < MAX_ATTEMPTS) {
          remainingQueue.push(item);
        } else {
          console.error(`[OfflineSync] Dropping session ${item.id} after ${MAX_ATTEMPTS} failed attempts.`);
        }
      }
    }

    if (remainingQueue.length > 0) {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    } else {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    }

    return { processed, remaining: remainingQueue.length };
  } catch (err) {
    console.warn('[OfflineSync] Error processing queue:', err);
    return { processed, remaining: 0 };
  } finally {
    isProcessing = false;
  }
}

/**
 * Get count of pending offline sessions.
 */
export async function getPendingOfflineCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
}
