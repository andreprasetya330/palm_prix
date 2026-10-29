/** Sustained rendering cost, including slow frames, drives the 3D resolution. */
export class RenderBudget {
  scale=1
  private warmup=0
  private elapsed=0
  private frames=0
  sample(dt:number,hidden=false):number|null {
    // Ignore a suspended tab or compilation stall; ordinary 5–10fps frames
    // must still lower the budget rather than being excluded as outliers.
    if(hidden||!Number.isFinite(dt)||dt<=0||dt>.5)return null
    this.warmup+=dt
    if(this.warmup<4)return null
    this.elapsed+=dt;this.frames++
    if(this.elapsed<2)return null
    const average=this.elapsed/this.frames
    const next=average>1/50?Math.max(.65,this.scale-.1):average<1/65?Math.min(1,this.scale+.05):this.scale
    this.elapsed=0;this.frames=0
    if(next===this.scale)return null
    this.scale=next
    return next
  }
}
