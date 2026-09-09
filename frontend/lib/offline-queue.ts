import Dexie, { type Table } from "dexie";

export interface QueuedOp {
  id?: number;
  key: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
}

class OfflineDB extends Dexie {
  queue!: Table<QueuedOp, number>;

  constructor() {
    super("krishimarket-offline");
    this.version(1).stores({
      queue: "++id, key, createdAt, attempts",
    });
  }
}

export const db = new OfflineDB();

export function enqueueOp(key: string, payload: unknown): Promise<number> {
  return db.queue.add({ key, payload, createdAt: Date.now(), attempts: 0 });
}

export function pendingCount(): Promise<number> {
  return db.queue.count();
}

export async function clearQueue(): Promise<number> {
  const count = await db.queue.count();
  await db.queue.clear();
  return count;
}

export async function pendingOps(): Promise<QueuedOp[]> {
  return db.queue.orderBy("createdAt").toArray();
}

export async function syncQueue(
  send: (op: QueuedOp) => Promise<unknown>
): Promise<{ synced: number; failed: number }> {
  const ops = await pendingOps();
  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    if (!navigator.onLine) break;
    try {
      await send(op);
      await db.queue.delete(op.id!);
      synced++;
    } catch {
      await db.queue.update(op.id!, { attempts: op.attempts + 1 });
      failed++;
    }
  }

  return { synced, failed };
}

export async function subscribeOffline(
  onChange: (online: boolean, pending: number) => void
): Promise<() => void> {
  const listener = async () => {
    onChange(navigator.onLine, await pendingCount());
  };
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  await listener();
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}