export class FeedClient {
  url = localStorage.getItem('feedurl') || 'http://127.0.0.1:7878/feed'
  body: string | undefined
  arrived = 0
  private job = -1
  private lastRequest = -5000

  poll(now: number): void {
    if (this.job !== -1) {
      try {
        if (fetchReady(this.job)) {
          const result = fetchResult(this.job)
          if (result.ok) { this.body = result.text(); this.arrived = now }
          fetchRelease(this.job)
          this.job = -1
        }
      } catch {
        try { fetchRelease(this.job) } catch {}
        this.job = -1
      }
    }
    if (this.job === -1 && now - this.lastRequest >= 5000) {
      this.lastRequest = now
      try { this.job = fetchAsync(this.url) } catch {}
    }
  }
}
