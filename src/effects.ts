// ── Particle system + screen shake ──

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

export interface ChainArc {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;
  color: string;
}

const MAX_PARTICLES = 200;

export class Effects {
  particles: Particle[] = [];
  rings: Ring[] = [];
  shake: ScreenShake | null = null;
  chainArcs: ChainArc[] = [];

  spawnDeathEffect(x: number, y: number, color: string): void {
    // Burst of particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.5,
        color,
        size: 2 + Math.random() * 2,
      });
    }
    // Expanding ring
    this.rings.push({
      x, y,
      radius: 4,
      maxRadius: 20,
      life: 0.3,
      maxLife: 0.3,
      color,
    });
    // Trim excess
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
  }

  spawnHitParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2,
        maxLife: 0.2,
        color,
        size: 1.5,
      });
    }
  }

  spawnChainArc(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.chainArcs.push({ x1, y1, x2, y2, life: 0.15, color });
  }

  triggerShake(intensity: number, duration: number): void {
    // Don't override a stronger shake
    if (this.shake && this.shake.intensity > intensity) return;
    this.shake = { intensity, duration, elapsed: 0 };
  }

  update(dt: number): void {
    // Particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.life -= dt;
      return p.life > 0;
    });

    // Rings
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      r.radius = r.maxRadius * (1 - r.life / r.maxLife);
      return r.life > 0;
    });

    // Chain arcs
    this.chainArcs = this.chainArcs.filter((a) => {
      a.life -= dt;
      return a.life > 0;
    });

    // Screen shake
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake = null;
      }
    }
  }

  getShakeOffset(): { x: number; y: number } {
    if (!this.shake) return { x: 0, y: 0 };
    const remaining = 1 - this.shake.elapsed / this.shake.duration;
    const i = this.shake.intensity * remaining;
    return {
      x: (Math.random() - 0.5) * 2 * i,
      y: (Math.random() - 0.5) * 2 * i,
    };
  }
}
