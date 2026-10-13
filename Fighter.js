// Fighter.js — the on-canvas combatant. Draws a stylized robed philosopher
// figure in the color of its primary philosopher. Supports:
//   • idle sway, hurt, attack (lunge), ultimate (big surge), KO (fall)
//   • facing (+1 right, -1 left)
//   • HP (0..100) tracked here (Game.js is authoritative, but we mirror it
//     for visual effects)
// All ink is sized from this.width / this.height so the editor could resize
// if we wired it; positions use this.x / this.y (top-left).

class Fighter extends GameObject {
  constructor(x, y, philosopher, facing) {
    super(x, y, 160, 260);
    this.philosopher = philosopher || PHILOSOPHERS[0];
    this.color = this.philosopher.color;
    this.accent = this.philosopher.accent;
    this.facing = facing || 1; // +1 right, -1 left
    this.anchorX = x; this.anchorY = y;
    this.hp = 100;
    this.state = 'idle'; // idle | attack | hurt | ult | ko | victory
    this.stateT = 0;
    this.stateDur = 0;
    this.t = Math.random() * 10;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.aura = 0; // 0..1 ultimate glow
    this.flashT = 0; // white hit-flash
  }

  setFacing(dir) { this.facing = dir >= 0 ? 1 : -1; }

  playAttack(power) {
    // power 0..1 scales lunge distance + duration
    this.state = 'attack';
    this.stateT = 0;
    this.stateDur = 0.5 + power * 0.3;
    this._attackPower = power;
  }

  playUlt() {
    this.state = 'ult';
    this.stateT = 0;
    this.stateDur = 1.4;
    this.aura = 1;
  }

  takeHit(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state = 'ko';
      this.stateT = 0;
      this.stateDur = 9999;
    } else {
      this.state = 'hurt';
      this.stateT = 0;
      this.stateDur = 0.4;
    }
    this.shakeT = 0.35;
    this.shakeMag = 6 + amount * 0.25;
    this.flashT = 0.25;
  }

  victory() {
    this.state = 'victory';
    this.stateT = 0;
    this.stateDur = 9999;
  }

  update(dt) {
    this.t += dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.aura > 0) this.aura = Math.max(0, this.aura - dt * 0.6);
    if (this.state !== 'idle' && this.state !== 'ko' && this.state !== 'victory') {
      this.stateT += dt;
      if (this.stateT >= this.stateDur) {
        this.state = 'idle';
        this.stateT = 0;
      }
    }
  }

  draw(ctx) {
    const w = this.width, h = this.height;
    let drawX = this.x, drawY = this.y;

    // Attack lunge: push toward facing
    if (this.state === 'attack') {
      const p = this.stateT / this.stateDur; // 0..1
      // lunge curve: forward-then-back
      const lunge = Math.sin(p * Math.PI);
      drawX += this.facing * lunge * (30 + (this._attackPower || 0.5) * 40);
      drawY -= lunge * 10;
    } else if (this.state === 'ult') {
      const p = this.stateT / this.stateDur;
      drawY -= Math.sin(p * Math.PI) * 25;
    } else if (this.state === 'hurt') {
      const p = this.stateT / this.stateDur;
      drawX -= this.facing * (1 - p) * 20;
    } else if (this.state === 'ko') {
      drawY += Math.min(60, this.stateT * 120);
    }

    // Shake
    if (this.shakeT > 0) {
      const s = this.shakeMag * (this.shakeT / 0.35);
      drawX += (Math.random() - 0.5) * s;
      drawY += (Math.random() - 0.5) * s;
    }

    // Idle sway
    const sway = Math.sin(this.t * 1.4) * (this.state === 'idle' ? 2.5 : 1);

    ctx.save();
    ctx.translate(drawX + w / 2, drawY + h);
    ctx.scale(this.facing, 1);

    // Aura (ultimate / strong attack glow)
    if (this.aura > 0.01) {
      const grd = ctx.createRadialGradient(0, -h * 0.55, 0, 0, -h * 0.55, w * 1.1);
      grd.addColorStop(0, this._hexA(this.color, 0.6 * this.aura));
      grd.addColorStop(0.5, this._hexA(this.color, 0.25 * this.aura));
      grd.addColorStop(1, this._hexA(this.color, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, w * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, -2, w * 0.3, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw robe body (gradient)
    const bodyGrad = ctx.createLinearGradient(0, -h, 0, 0);
    bodyGrad.addColorStop(0, this.color);
    bodyGrad.addColorStop(1, this.accent);
    ctx.fillStyle = bodyGrad;

    // Robe silhouette: tapered trapezoid flaring outward at the hem
    const hipHalf = w * 0.42;
    const shoulderHalf = w * 0.3;
    const neckY = -h * 0.78;
    const hemY = -h * 0.02;
    ctx.beginPath();
    ctx.moveTo(-shoulderHalf, neckY + 8);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.4, -hipHalf, hemY);
    ctx.lineTo(hipHalf, hemY);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.4, shoulderHalf, neckY + 8);
    ctx.closePath();
    ctx.fill();

    // Robe trim
    ctx.strokeStyle = this._hexA('#ffffff', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, neckY + 12);
    ctx.lineTo(0, hemY - 4);
    ctx.stroke();

    // Belt / sash
    ctx.fillStyle = this._hexA(this.accent, 0.9);
    ctx.fillRect(-w * 0.38, -h * 0.42, w * 0.76, h * 0.045);

    // Arms (behind body - draw simple)
    ctx.fillStyle = this.color;
    // back arm (slightly tucked)
    ctx.save();
    ctx.translate(-w * 0.22, -h * 0.6);
    let armSway = sway * 0.5;
    if (this.state === 'attack') armSway += Math.sin((this.stateT / this.stateDur) * Math.PI) * 20;
    ctx.rotate((-10 + armSway) * Math.PI / 180);
    this._armShape(ctx, w, h, this.color, this.accent);
    ctx.restore();
    // front arm (the striking arm)
    ctx.save();
    ctx.translate(w * 0.22, -h * 0.6);
    let fArm = -5 + sway * 0.6;
    if (this.state === 'attack') fArm = -5 - Math.sin((this.stateT / this.stateDur) * Math.PI) * 55;
    if (this.state === 'ult') fArm = -5 - Math.sin((this.stateT / this.stateDur) * Math.PI) * 70;
    ctx.rotate(fArm * Math.PI / 180);
    this._armShape(ctx, w, h, this.color, this.accent);
    // in attack / ult, show a tiny energy spark at the hand
    if (this.state === 'attack' || this.state === 'ult') {
      ctx.fillStyle = this._hexA(this.color, 0.9);
      ctx.beginPath();
      ctx.arc(0, h * 0.32, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this._hexA('#ffffff', 0.8);
      ctx.beginPath();
      ctx.arc(0, h * 0.32, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Head
    const headCy = neckY - h * 0.08;
    const headR = w * 0.19;
    // neck
    ctx.fillStyle = this._hexA(this.accent, 1);
    ctx.fillRect(-w * 0.08, neckY - 4, w * 0.16, 12);
    // skin
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(0, headCy, headR, 0, Math.PI * 2);
    ctx.fill();
    // hair / cap / beard based on philosopher id — just stylistic hints
    this._drawHair(ctx, headCy, headR);

    // Eyes
    const eyeY = headCy;
    const eyeOff = headR * 0.42;
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.arc(-eyeOff, eyeY, 2.5, 0, Math.PI * 2);
    ctx.arc(eyeOff, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // small mouth
    ctx.strokeStyle = '#5a3020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.state === 'ko') {
      ctx.moveTo(-6, headCy + headR * 0.5);
      ctx.lineTo(6, headCy + headR * 0.5);
    } else if (this.state === 'hurt') {
      ctx.arc(0, headCy + headR * 0.55, 5, 0, Math.PI, true);
    } else {
      ctx.moveTo(-5, headCy + headR * 0.5);
      ctx.quadraticCurveTo(0, headCy + headR * 0.55, 5, headCy + headR * 0.5);
    }
    ctx.stroke();

    // Hit flash
    if (this.flashT > 0) {
      const a = this.flashT / 0.25;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`;
      ctx.beginPath();
      ctx.moveTo(-shoulderHalf, neckY + 8);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.4, -hipHalf, hemY);
      ctx.lineTo(hipHalf, hemY);
      ctx.quadraticCurveTo(w * 0.5, -h * 0.4, shoulderHalf, neckY + 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _armShape(ctx, w, h, col, acc) {
    const grd = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    grd.addColorStop(0, col);
    grd.addColorStop(1, acc);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(14, h * 0.3);
    ctx.lineTo(-6, h * 0.3);
    ctx.closePath();
    ctx.fill();
    // hand
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(4, h * 0.32, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawHair(ctx, cy, r) {
    const id = this.philosopher.id;
    ctx.fillStyle = '#2a1808';
    if (id === 'socrates' || id === 'plato' || id === 'aristotle' || id === 'confucius' || id === 'laotzu') {
      // bald/receded + beard
      // beard
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.ellipse(0, cy + r * 0.6, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // skin re-overlap for mouth zone
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath();
      ctx.ellipse(0, cy + r * 0.2, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // ring of hair
      ctx.fillStyle = id === 'socrates' ? '#5a4028' : '#2a1808';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.1, r * 1.05, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.1, r * 0.95, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (id === 'nietzsche') {
      // signature huge moustache + hair
      ctx.fillStyle = '#3a1a08';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.6, r * 0.95, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      // moustache
      ctx.fillStyle = '#3a1a08';
      ctx.beginPath();
      ctx.ellipse(0, cy + r * 0.3, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'kant') {
      // powdered wig
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.2, r * 1.15, Math.PI, Math.PI * 2);
      ctx.ellipse(-r * 0.9, cy, r * 0.4, r * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.9, cy, r * 0.4, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'descartes') {
      // long dark hair
      ctx.fillStyle = '#1a0808';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.1, r * 1.08, Math.PI, Math.PI * 2);
      ctx.ellipse(-r * 0.8, cy + r * 0.2, r * 0.3, r * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.8, cy + r * 0.2, r * 0.3, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'camus') {
      // slick dark hair, modern
      ctx.fillStyle = '#1a0a06';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.3, r * 0.95, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    } else if (id === 'kierkegaard') {
      // tall curly dark hair
      ctx.fillStyle = '#2a1a08';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.5, r * 0.9, 0, Math.PI * 2);
      ctx.arc(-r * 0.5, cy - r * 0.4, r * 0.5, 0, Math.PI * 2);
      ctx.arc(r * 0.5, cy - r * 0.4, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'spinoza') {
      // dark long hair + goatee
      ctx.fillStyle = '#1a0a06';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.1, r * 1.05, Math.PI, Math.PI * 2);
      ctx.ellipse(-r * 0.75, cy + r * 0.3, r * 0.25, r * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.75, cy + r * 0.3, r * 0.25, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // goatee
      ctx.beginPath();
      ctx.ellipse(0, cy + r * 0.7, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'hume') {
      // light wig
      ctx.fillStyle = '#d8c89a';
      ctx.beginPath();
      ctx.arc(0, cy - r * 0.2, r * 1.1, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }

  _hexA(hex, a) {
    // #rrggbb -> rgba
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
