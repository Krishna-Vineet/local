import { UploadAPI } from '../../../../packages/api/src/index';

interface UploadTask {
  id: string;
  uri: string;
  eventId?: string;
  isComposite?: boolean;
  retries: number;
}

class UploadQueue {
  private queue: UploadTask[] = [];
  private isProcessing = false;
  private maxRetries = 5;

  public addTask(uri: string, eventId?: string, isComposite: boolean = false) {
    const task: UploadTask = {
      id: Date.now().toString() + Math.random().toString(),
      uri,
      eventId,
      isComposite,
      retries: 0,
    };
    this.queue.push(task);
    console.log(`[UploadQueue] Added task. Queue length: ${this.queue.length}`);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue[0];
      try {
        console.log(`[UploadQueue] Uploading task ${task.id}... Attempt ${task.retries + 1}`);
        await UploadAPI.uploadPhoto(task.uri, task.eventId, task.isComposite);
        console.log(`[UploadQueue] Task ${task.id} uploaded successfully.`);
        // Remove from queue on success
        this.queue.shift();
      } catch (err) {
        console.error(`[UploadQueue] Task ${task.id} failed:`, err);
        task.retries += 1;
        
        if (task.retries >= this.maxRetries) {
          console.error(`[UploadQueue] Task ${task.id} reached max retries. Dropping.`);
          this.queue.shift();
        } else {
          // Move to the back of the queue and wait a bit before retrying
          this.queue.shift();
          this.queue.push(task);
          // Wait 3 seconds before continuing to prevent spamming failing requests
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    this.isProcessing = false;
    console.log(`[UploadQueue] Queue processing finished.`);
  }
}

export const uploadQueue = new UploadQueue();
