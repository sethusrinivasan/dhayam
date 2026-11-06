/**
 * site/js/confetti.js
 *
 * Lightweight, zero-dependency high-performance canvas confetti & fireworks engine
 * for spectacular game-ending victory celebrations in Dhayam.
 */

(function (window) {
  "use strict";

  let animFrameId = null;
  let particles = [];
  let stopTimeoutId = null;
  let canvas = null;
  let ctx = null;

  const COLORS = [
    "#f59e0b", // Golden Amber
    "#e11d48", // Crimson Ruby
    "#10b981", // Emerald Green
    "#3b82f6", // Royal Blue
    "#8b5cf6", // Festive Purple
    "#ec4899", // Coral Pink
    "#facc15"  // Bright Gold
  ];

  function createParticle(w, h, isFirework = false) {
    const x = isFirework ? w * (0.2 + Math.random() * 0.6) : Math.random() * w;
    const y = isFirework ? h * (0.3 + Math.random() * 0.4) : -20;
    const size = Math.random() * 8 + 4;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const angle = isFirework ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 0.8;
    const speed = isFirework ? Math.random() * 8 + 3 : Math.random() * 3 + 2;

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: isFirework ? Math.sin(angle) * speed : speed,
      size,
      color,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
      decay: isFirework ? Math.random() * 0.02 + 0.015 : 0.005,
      gravity: isFirework ? 0.12 : 0.08,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.random() * 0.1 + 0.05,
      shape: Math.random() > 0.3 ? "rect" : "diya" // mix ribbons and glowing diya stars
    };
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    if (ctx) ctx.scale(dpr, dpr);
  }

  function loop() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx + Math.sin(p.wobble) * 1.5;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.wobble += p.wobbleSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > window.innerHeight + 40) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        // Glowing star / Diya burst
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      animFrameId = requestAnimationFrame(loop);
    } else {
      stopCelebration();
    }
  }

  /**
   * Launch a spectacular victory confetti & fireworks celebration
   */
  function launchConfettiCelebration(durationMs = 6000) {
    // Respect user's reduced motion preferences
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    canvas = document.getElementById("celebrationCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "celebrationCanvas";
      canvas.className = "celebration-canvas";
      document.body.appendChild(canvas);
    }

    canvas.hidden = false;
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    particles = [];

    // 1. Initial burst of confetti ribbons
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < 120; i++) {
      particles.push(createParticle(w, h, false));
    }

    // 2. Fireworks bursts at intervals
    for (let f = 0; f < 3; f++) {
      setTimeout(() => {
        if (!canvas || canvas.hidden) return;
        for (let j = 0; j < 40; j++) {
          particles.push(createParticle(w, h, true));
        }
      }, f * 700);
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(loop);

    if (stopTimeoutId) clearTimeout(stopTimeoutId);
    stopTimeoutId = setTimeout(() => {
      stopCelebration();
    }, durationMs);
  }

  /**
   * Immediately cease particle animation and hide canvas
   */
  function stopCelebration() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (stopTimeoutId) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    particles = [];
    if (canvas) {
      canvas.hidden = true;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    window.removeEventListener("resize", resizeCanvas);
  }

  window.launchConfettiCelebration = launchConfettiCelebration;
  window.stopCelebration = stopCelebration;

})(typeof window !== "undefined" ? window : globalThis);
