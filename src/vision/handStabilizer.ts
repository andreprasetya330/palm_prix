import type { HandSample } from './landmarks'

type Track = { id: number; sample: HandSample; seen: number; candidateSince: number; lastFist: number }
/** Match spatial identities before smoothing, because detector array order can swap. */
export class HandStabilizer {
  private tracks: Track[] = []
  private nextId = 1
  update(samples: HandSample[], now: number): HandSample[] {
    this.tracks = this.tracks.filter((track) => now-track.seen < 350)
    const available = new Set(this.tracks)
    const output: HandSample[] = []
    for (const sample of samples) {
      const distance = (track: Track) => Math.hypot(track.sample.grip.x-sample.grip.x, track.sample.grip.y-sample.grip.y)
      const nearest = [...available].sort((a,b) => distance(a)-distance(b))[0]
      let track = nearest && distance(nearest) < 0.3 ? nearest : undefined
      if (!track) {
        track = { id: this.nextId++, sample: { ...sample, pose: 'uncertain', isFist: false }, seen: now, candidateSince: now, lastFist: -Infinity }
        this.tracks.push(track)
      }
      available.delete(track)
      const raw = sample.pose ?? (sample.isFist ? 'fist' : 'open')
      if (raw !== 'fist') track.candidateSince = now
      let pose = raw
      if (raw === 'fist') {
        if (now-track.candidateSince >= 30 || track.sample.pose === 'fist') track.lastFist = now
        else pose = 'uncertain'
      } else if (raw === 'uncertain' && now-track.lastFist < 100) pose = 'fist'
      // Definite open hands brake immediately, never held as fists by hysteresis.
      const stable = { ...sample, pose, isFist: pose === 'fist', trackingId: track.id }
      track.sample = stable
      track.seen = now
      output.push(stable)
    }
    return output
  }
}


