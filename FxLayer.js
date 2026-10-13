// FxLayer.js — DOM floating popups (damage numbers, big banners) + canvas-side
// hit flash state. Lives alongside the UI, not inside the canvas, so popups
// stay crisp regardless of DPR.

class FxLayer {
  constructor(root) {
    this.root = root;
  }

  popup(screenX, screenY, text, variant) {
    const el = document.createElement('div');
    el.className = 'damage-pop' + (variant ? ' ' + variant : '');
    el.textContent = text;
    el.style.left = screenX + 'px';
    el.style.top = screenY + 'px';
    this.root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  }

  flash() {
    const el = document.createElement('div');
    el.className = 'flash-screen';
    this.root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }
}
