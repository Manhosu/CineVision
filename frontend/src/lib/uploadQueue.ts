/**
 * Upload Queue Manager
 * Manages concurrent uploads with a maximum concurrency limit
 */

export interface QueueItem {
  id: string;
  execute: () => Promise<void>;
  priority?: number;
}

export interface QueueStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  active: number;
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private active: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: Set<string> = new Set();
  private maxConcurrency: number;
  private onStatsChange?: (stats: QueueStats) => void;

  constructor(maxConcurrency: number = 2, onStatsChange?: (stats: QueueStats) => void) {
    this.maxConcurrency = maxConcurrency;
    this.onStatsChange = onStatsChange;
  }

  /**
   * Add an item to the queue
   */
  add(item: QueueItem) {
    this.queue.push(item);
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.emitStats();
    this.processNext();
  }

  /**
   * Add multiple items to the queue
   */
  addBatch(items: QueueItem[]) {
    this.queue.push(...items);
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.emitStats();
    this.processNext();
  }

  /**
   * Process the next item in the queue if capacity allows
   */
  private async processNext() {
    // Check if we can process more items
    if (this.active.size >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    // Get the next item
    const item = this.queue.shift();
    if (!item) return;

    // Mark as active
    this.active.add(item.id);
    this.emitStats();

    try {
      // Execute the upload
      await item.execute();

      // Mark as completed
      this.active.delete(item.id);
      this.completed.add(item.id);
    } catch (error) {
      // Mark as failed
      this.active.delete(item.id);
      this.failed.add(item.id);
      console.error(`[UploadQueue] Upload failed for ${item.id}:`, error);
    }

    this.emitStats();

    // Process next items
    this.processNext();
    if (this.active.size < this.maxConcurrency) {
      this.processNext();
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return {
      total: this.completed.size + this.failed.size + this.active.size + this.queue.length,
      completed: this.completed.size,
      failed: this.failed.size,
      pending: this.queue.length,
      active: this.active.size,
    };
  }

  /**
   * Emit stats change event
   */
  private emitStats() {
    if (this.onStatsChange) {
      this.onStatsChange(this.getStats());
    }
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.active.clear();
    this.completed.clear();
    this.failed.clear();
    this.emitStats();
  }

  /**
   * Check if queue is idle (no active or pending items)
   */
  isIdle(): boolean {
    return this.active.size === 0 && this.queue.length === 0;
  }

  /**
   * Wait for all uploads to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.isIdle()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }
}
