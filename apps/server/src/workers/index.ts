import { logger } from '../utils/logger.js';
import { refreshTick } from './refresh.js';
import { probeTick } from './probe.js';

const REFRESH_INTERVAL_MS = 60 * 1000; // 1 min
const PROBE_INTERVAL_MS = 10 * 60 * 1000; // 10 min

interface Worker {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  timer?: NodeJS.Timeout;
}

const workers: Worker[] = [
  { name: 'refresh', intervalMs: REFRESH_INTERVAL_MS, run: refreshTick },
  { name: 'probe', intervalMs: PROBE_INTERVAL_MS, run: probeTick },
];

async function tick(w: Worker): Promise<void> {
  try {
    await w.run();
  } catch (err) {
    logger.error({ err, worker: w.name }, 'worker tick unhandled error');
  }
}

export function startWorkers(): void {
  if (process.env.DISABLE_WORKERS === '1') {
    logger.warn('workers disabled via DISABLE_WORKERS=1');
    return;
  }
  for (const w of workers) {
    // Defer the first tick briefly so migrations + boot finish.
    w.timer = setTimeout(() => {
      void tick(w);
      w.timer = setInterval(() => void tick(w), w.intervalMs);
    }, 5_000);
    logger.info({ worker: w.name, intervalMs: w.intervalMs }, 'worker scheduled');
  }
}

export function stopWorkers(): void {
  for (const w of workers) {
    if (w.timer) {
      clearTimeout(w.timer);
      clearInterval(w.timer);
      w.timer = undefined;
    }
  }
}
