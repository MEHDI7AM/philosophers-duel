// assets.js — scenery/decor sprites. Each is a pure paint function run once
// at load; drawn via lib.sprite(id). Keep ids short — users can replace them
// with uploaded art in the Assets panel.

Assets.sprite('column', 60, 240, (ctx, w, h) => {
  // Classical column
  const base = h * 0.08;
  // capital
  ctx.fillStyle = '#d8c69a';
  ctx.fillRect(w * 0.05, 0, w * 0.9, base);
  // shaft gradient
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#8a7a52');
  g.addColorStop(0.5, '#e8d8a8');
  g.addColorStop(1, '#8a7a52');
  ctx.fillStyle = g;
  ctx.fillRect(w * 0.18, base, w * 0.64, h - 2 * base);
  // fluting lines
  ctx.strokeStyle = 'rgba(80,60,30,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const x = w * 0.18 + (w * 0.64) * (i / 5);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, h - base);
    ctx.stroke();
  }
  // base
  ctx.fillStyle = '#d8c69a';
  ctx.fillRect(w * 0.05, h - base, w * 0.9, base);
});

Assets.sprite('brazier', 60, 90, (ctx, w, h) => {
  // bowl
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.4, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a20';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.55);
  ctx.lineTo(w * 0.3, h * 0.9);
  ctx.lineTo(w * 0.7, h * 0.9);
  ctx.lineTo(w * 0.85, h * 0.55);
  ctx.closePath();
  ctx.fill();
  // flame
  ctx.fillStyle = 'rgba(255,180,60,0.9)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.05);
  ctx.quadraticCurveTo(w * 0.2, h * 0.3, w * 0.3, h * 0.5);
  ctx.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.7, h * 0.5);
  ctx.quadraticCurveTo(w * 0.8, h * 0.3, w * 0.5, h * 0.05);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,160,0.85)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.2);
  ctx.quadraticCurveTo(w * 0.35, h * 0.4, w * 0.5, h * 0.5);
  ctx.quadraticCurveTo(w * 0.65, h * 0.4, w * 0.5, h * 0.2);
  ctx.fill();
});

Assets.sprite('moon', 160, 160, (ctx, w, h) => {
  const grd = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.1, w * 0.5, h * 0.5, w * 0.5);
  grd.addColorStop(0, 'rgba(255,240,200,0.9)');
  grd.addColorStop(0.4, 'rgba(255,230,170,0.4)');
  grd.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, w * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8ecc0';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, w * 0.28, 0, Math.PI * 2);
  ctx.fill();
});

Assets.sprite('cloud', 220, 90, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(50,35,60,0.5)';
  ctx.beginPath();
  ctx.ellipse(w * 0.25, h * 0.55, w * 0.22, h * 0.35, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.5, h * 0.45, w * 0.28, h * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.75, h * 0.55, w * 0.22, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
});

Assets.sprite('mountains', 1280, 300, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1f3a');
  g.addColorStop(1, '#0f0a18');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.6);
  const peaks = [0.1, 0.22, 0.33, 0.45, 0.58, 0.7, 0.82, 0.95];
  const heights = [0.3, 0.15, 0.4, 0.2, 0.35, 0.1, 0.3, 0.25];
  for (let i = 0; i < peaks.length; i++) {
    ctx.lineTo(w * peaks[i], h * heights[i]);
  }
  ctx.lineTo(w, h * 0.6);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
});
