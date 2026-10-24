/** Deadline-based capture pacing; a 1ms tolerance avoids floating-point RAF misses. */
export class FrameCadence {
  private nextDue = -Infinity
  private interval = 0
  private lastSent = -Infinity
  consume(now: number, intervalMs: number): boolean {
    if (!Number.isFinite(now) || !Number.isFinite(intervalMs) || intervalMs <= 0) return false
    if (intervalMs !== this.interval) {
      this.nextDue = this.lastSent + intervalMs
      this.interval = intervalMs
    }
    if (now + 1 < this.nextDue) return false
    // Keep the original phase through ordinary RAF jitter. Never catch up a
    // backlog after suspension or a slow inference: only capture a fresh frame.
    this.nextDue = Number.isFinite(this.nextDue) && now - this.nextDue < intervalMs
      ? this.nextDue + intervalMs
      : now + intervalMs
    this.lastSent = now
    return true
  }
}
