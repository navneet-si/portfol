import { useRef, useState, useEffect, useCallback } from "react";
import {
  motion, useScroll, useTransform, useSpring,
  useMotionValue, useAnimationFrame, AnimatePresence,
} from "framer-motion";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
const T = {
  // Backgrounds — layered depth, not flat black
  bg0:  "#070b12",   // deepest
  bg1:  "#0a1018",   // main canvas
  bg2:  "#0e1520",   // surface
  bg3:  "#131d2e",   // raised card
  bg4:  "#192438",   // hover state

  // Accents
  cyan:    "#4dd9e8",
  cyanDim: "#1e6e79",
  violet:  "#8b6ef5",
  gold:    "#c8a84b",
  white:   "#f0f4f8",

  // Text hierarchy
  t1: "#e8eff6",  // primary
  t2: "#8899aa",  // secondary
  t3: "#445566",  // tertiary / dim

  // Borders
  b1: "rgba(77,217,232,0.10)",
  b2: "rgba(77,217,232,0.18)",
  b3: "rgba(77,217,232,0.04)",
};

/* ═══════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:${T.bg1};
  color:${T.t1};
  font-family:'DM Sans',sans-serif;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
  cursor:none;
}
::selection{background:${T.cyanDim};color:${T.white}}
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.cyanDim};border-radius:2px}
a{color:inherit;text-decoration:none}
.serif{font-family:'Cormorant Garamond',serif}
.mono{font-family:'DM Mono',monospace}

@keyframes pulse-slow{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes marquee-ltr{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes marquee-rtl{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes breath{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes scan{0%{top:-2px}100%{top:100%}}

/* Custom cursor */
#cursor{
  position:fixed;width:10px;height:10px;border-radius:50%;
  background:${T.cyan};pointer-events:none;z-index:9999;
  transform:translate(-50%,-50%);transition:width .15s,height .15s,background .15s;
  mix-blend-mode:difference;
}
#cursor-ring{
  position:fixed;width:36px;height:36px;border-radius:50%;
  border:1px solid ${T.cyan}55;pointer-events:none;z-index:9998;
  transform:translate(-50%,-50%);transition:all .2s ease;
}
body:has(a:hover) #cursor,body:has(button:hover) #cursor{width:20px;height:20px}
`;

/* ═══════════════════════════════════════════════════
   CUSTOM CURSOR
═══════════════════════════════════════════════════ */
function Cursor() {
  const dot  = useRef();
  const ring = useRef();

  useEffect(() => {
    const move = (e) => {
      if (dot.current)  { dot.current.style.left  = e.clientX+"px"; dot.current.style.top  = e.clientY+"px"; }
      if (ring.current) {
        setTimeout(() => {
          if (ring.current) { ring.current.style.left = e.clientX+"px"; ring.current.style.top = e.clientY+"px"; }
        }, 60);
      }
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <>
      <div id="cursor" ref={dot} />
      <div id="cursor-ring" ref={ring} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   PARTICLE CANVAS — Generative data-stream field
═══════════════════════════════════════════════════ */
function ParticleCanvas({ mouseX, mouseY }) {
  const canvasRef = useRef();
  const stateRef  = useRef({ particles: [], mouse: { x: -9999, y: -9999 }, frame: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Build particle set — two populations: nodes + streams
    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const buildParticles = () => {
      const arr = [];
      // Scattered glowing nodes
      for (let i = 0; i < 70; i++) {
        arr.push({
          kind: "node",
          x: Math.random() * W(), y: Math.random() * H(),
          ox: 0, oy: 0,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.12,
          r: Math.random() * 1.4 + 0.6,
          alpha: Math.random() * 0.5 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.008,
          connections: [],
        });
      }
      // Horizontal data-stream particles
      for (let i = 0; i < 35; i++) {
        arr.push({
          kind: "stream",
          x: Math.random() * W(), y: Math.random() * H(),
          vy: 0, vx: (Math.random() * 0.6 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
          len: Math.random() * 40 + 15,
          alpha: Math.random() * 0.25 + 0.05,
          speed: Math.random() * 0.015 + 0.005,
          phase: Math.random() * Math.PI * 2,
        });
      }
      return arr;
    };

    stateRef.current.particles = buildParticles();

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.mouse.x = e.clientX - rect.left;
      stateRef.current.mouse.y = e.clientY - rect.top;
    };
    canvas.parentElement?.addEventListener("mousemove", onMouseMove);

    let raf;
    const draw = () => {
      const { particles, mouse } = stateRef.current;
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);

      const t = Date.now() * 0.001;

      // Draw connection lines between nearby nodes
      const nodes = particles.filter(p => p.kind === "node");
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const lineAlpha = (1 - dist / 120) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(77,217,232,${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        // Mouse repulsion for nodes
        const mx = mouse.x, my = mouse.y;
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repulse = dist < 120 ? (1 - dist / 120) * 1.8 : 0;

        if (p.kind === "node") {
          p.x += p.vx + (dx / (dist + 1)) * repulse * 0.4;
          p.y += p.vy + (dy / (dist + 1)) * repulse * 0.4;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          p.x = Math.max(0, Math.min(w, p.x));
          p.y = Math.max(0, Math.min(h, p.y));

          const pulse = Math.sin(t * p.speed * 60 + p.phase) * 0.5 + 0.5;
          const glow = dist < 100 ? Math.max(0, 1 - dist / 100) : 0;
          const finalAlpha = p.alpha * (0.5 + pulse * 0.5) + glow * 0.6;
          const finalR = p.r * (1 + pulse * 0.4 + glow * 1.5);

          // Outer glow
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, finalR * 6);
          grad.addColorStop(0, `rgba(77,217,232,${finalAlpha * 0.5})`);
          grad.addColorStop(1, "rgba(77,217,232,0)");
          ctx.beginPath();
          ctx.arc(p.x, p.y, finalR * 6, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, finalR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(77,217,232,${Math.min(1, finalAlpha)})`;
          ctx.fill();

        } else if (p.kind === "stream") {
          p.x += p.vx;
          if (p.x > w + p.len) p.x = -p.len;
          if (p.x < -p.len) p.x = w + p.len;

          const pulse = Math.sin(t * p.speed * 60 + p.phase) * 0.5 + 0.5;
          const streamAlpha = p.alpha * (0.4 + pulse * 0.6);

          const grad = ctx.createLinearGradient(
            p.x - p.len * Math.sign(p.vx) * 0.5, p.y,
            p.x + p.len * Math.sign(p.vx) * 0.5, p.y
          );
          const dir = p.vx > 0;
          grad.addColorStop(0, `rgba(77,217,232,0)`);
          grad.addColorStop(0.5, `rgba(77,217,232,${streamAlpha})`);
          grad.addColorStop(1, `rgba(77,217,232,0)`);

          ctx.beginPath();
          ctx.moveTo(p.x - p.len / 2, p.y);
          ctx.lineTo(p.x + p.len / 2, p.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Subtle grid overlay
      ctx.strokeStyle = `rgba(77,217,232,0.025)`;
      ctx.lineWidth = 0.5;
      const gridSize = 80;
      for (let gx = 0; gx < w; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity: 0.85,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   REVEAL ANIMATIONS (scroll-triggered)
═══════════════════════════════════════════════════ */
const revealUp = {
  hidden: { opacity: 0, y: 36 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.75, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
  }),
};
const revealLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: (i = 0) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.75, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
  }),
};

function Reveal({ children, variants = revealUp, delay = 0, style = {} }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      custom={delay}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const s = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", s);
    return () => window.removeEventListener("scroll", s);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "0 clamp(1.5rem,5vw,5rem)", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? `rgba(7,11,18,0.85)` : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? `1px solid ${T.b1}` : "none",
        transition: "all 0.4s ease",
      }}
    >
      <a href="#hero" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="serif" style={{ fontSize: 22, fontWeight: 300, color: T.t1, letterSpacing: "0.06em" }}>
          N<span style={{ color: T.cyan }}>.</span>
        </span>
      </a>

      <nav style={{ display: "flex", gap: 36, alignItems: "center" }}>
        {["About","Projects","Skills","Contact"].map(s => (
          <a key={s} href={`#${s.toLowerCase()}`} style={{
            fontSize: 12, fontWeight: 500, color: T.t2,
            letterSpacing: "0.12em", textTransform: "uppercase",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => e.target.style.color = T.cyan}
          onMouseLeave={e => e.target.style.color = T.t2}
          >{s}</a>
        ))}
        <a href="#contact" style={{
          padding: "7px 20px", borderRadius: 2,
          border: `1px solid ${T.cyan}44`,
          fontSize: 11, fontWeight: 500, color: T.cyan,
          letterSpacing: "0.15em", textTransform: "uppercase",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${T.cyan}12`; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >Hire Me</a>
      </nav>
    </motion.header>
  );
}
/* ═══════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════ */
function Hero() {
  const ref = useRef();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y  = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const op = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section id="hero" ref={ref} style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", alignItems: "center" }}>

      {/* Particle field - full bleed */}
      <ParticleCanvas />

      {/* Deep radial gradient base */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 70% 60% at 70% 50%, ${T.cyanDim}14 0%, transparent 65%),
                     radial-gradient(ellipse 40% 50% at 20% 80%, ${T.violet}0a 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      {/* Left edge fade */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(90deg, ${T.bg1} 0%, ${T.bg1}cc 28%, transparent 55%)`,
        pointerEvents: "none",
      }} />

      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 200,
        background: `linear-gradient(0deg, ${T.bg1} 0%, transparent 100%)`,
        pointerEvents: "none",
      }} />

      {/* Hero Content Wrapper (Two-Column Layout) */}
      <motion.div 
        style={{ 
          y, opacity: op, position: "relative", zIndex: 2, 
          width: "100%", maxWidth: 1300, margin: "0 auto",
          padding: "0 clamp(1.5rem,6vw,6rem)", paddingTop: 80,
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "4rem"
        }}
      >
        
        {/* LEFT COLUMN: Text & CTAs */}
        <div style={{ flex: "1 1 min(100%, 600px)" }}>
          {/* Label */}
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mono"
            style={{ fontSize: 11, letterSpacing: "0.25em", color: T.cyan, textTransform: "uppercase", marginBottom: 28, opacity: 0.9 }}
          >
            ◈ &nbsp;Available for work &nbsp;·&nbsp; India
          </motion.p>

          {/* Headline — large serif with gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22,1,0.36,1] }}
            className="serif"
            style={{
              fontSize: "clamp(4.5rem,9vw,8.5rem)",
              fontWeight: 300,
              letterSpacing: "-0.025em",
              lineHeight: 0.92,
              marginBottom: 32,
              background: `linear-gradient(135deg, ${T.white} 0%, ${T.cyan} 40%, ${T.t2} 80%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Navneet.
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            style={{ fontSize: "clamp(.95rem,1.4vw,1.15rem)", color: T.t2, letterSpacing: "0.04em", marginBottom: 16, fontWeight: 300 }}
          >
            Computer Science Engineer &nbsp;·&nbsp; Full-Stack Developer &nbsp;·&nbsp; AI Enthusiast
          </motion.p>

          {/* Focus text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.72 }}
            style={{
              fontSize: "clamp(1rem,1.5vw,1.2rem)", fontWeight: 300, lineHeight: 1.75,
              color: T.t1, maxWidth: 520, marginBottom: 44, opacity: 0.85,
            }}
          >
            Bridging complex full-stack architecture, DevOps pipelines, and
            cutting-edge local AI solutions into cohesive systems.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 52 }}
          >
            <a href="#projects" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "13px 32px", borderRadius: 2,
              background: T.cyan, color: T.bg0,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase",
              transition: "all 0.25s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#7ee8f3"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.cyan; e.currentTarget.style.transform = "none"; }}
            >
              Explore Portfolio &rarr;
            </a>
            <a href="#contact" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 32px", borderRadius: 2,
              background: "transparent", color: T.t2,
              border: `1px solid ${T.b2}`,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase",
              transition: "all 0.25s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.t1; e.currentTarget.style.borderColor = `${T.cyan}44`; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.t2; e.currentTarget.style.borderColor = T.b2; }}
            >
              Contact Me
            </a>
            {/* Main Resume Drive Link Button */}
            <a href="https://drive.google.com/file/d/1NIUIZJkhwVYV20FBTXZupc1468hM9ucN/view?usp=sharing" target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 32px", borderRadius: 2,
              background: `${T.cyan}11`, color: T.cyan, border: `1px solid ${T.cyan}55`, fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", transition: "all 0.25s",
            }} onMouseEnter={e => { e.currentTarget.style.background = `${T.cyan}22`; e.currentTarget.style.borderColor = T.cyan; }} onMouseLeave={e => { e.currentTarget.style.background = `${T.cyan}11`; e.currentTarget.style.borderColor = `${T.cyan}55`; }}>
              View Resume 📄
            </a>
          </motion.div>

          {/* Socials */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            style={{ display: "flex", gap: 20, alignItems: "center" }}
          >
            <span className="mono" style={{ fontSize: 10, color: T.t3, letterSpacing: "0.18em" }}>
              FIND ME ON
            </span>
            <SocialLink href="https://github.com/navneet-si" label="GitHub">
              <GithubIcon size={14} />
            </SocialLink>
            <SocialLink href="https://linkedin.com/in/navneet-singh-710291289" label="LinkedIn">
              <LinkedinIcon size={14} />
            </SocialLink>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Photo with animations */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ flex: "1 1 min(100%, 380px)", display: "flex", justifyContent: "center", position: "relative" }}
        >
          {/* Subtle glow behind the photo */}
          <div style={{
            position: "absolute", inset: "-10%", background: `radial-gradient(circle, ${T.cyan}22 0%, transparent 60%)`,
            filter: "blur(40px)", pointerEvents: "none", zIndex: 0
          }} />

          <div style={{
            width: "100%", maxWidth: 380, aspectRatio: "4/5",
            borderRadius: 6, border: `1px solid ${T.b1}`,
            background: `linear-gradient(135deg, ${T.bg3}, ${T.bg2})`,
            position: "relative", overflow: "hidden", zIndex: 1,
            boxShadow: `0 24px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px ${T.b2}`
          }}>
            <img 
              src="/photo.png" 
              alt="Navneet Singh" 
              style={{
                width: "100%", height: "100%", 
                objectFit: "cover", objectPosition: "center 20%", /* Keeps face perfectly framed */
                position: "relative", zIndex: 1,
                filter: "grayscale(20%) contrast(1.1)" /* Slight editorial color grade */
              }} 
            />
            {/* Scanline effect over photo */}
            <div style={{
              position: "absolute", left: 0, right: 0, height: 1,
              background: `rgba(77,217,232,0.2)`,
              animation: "scan 3.5s linear infinite",
              pointerEvents: "none", zIndex: 2
            }} />
          </div>
        </motion.div>

      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        style={{
          position: "absolute", bottom: 36, left: "50%",
          transform: "translateX(-50%)", display: "flex",
          flexDirection: "column", alignItems: "center", gap: 8, zIndex: 3,
        }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 1, height: 48, background: `linear-gradient(180deg, ${T.cyan}55, transparent)` }}
        />
        <span className="mono" style={{ fontSize: 9, letterSpacing: "0.22em", color: T.t3 }}>SCROLL</span>
      </motion.div>
    </section>
  );
}

function SocialLink({ href, label, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 12px", borderRadius: 2,
        border: `1px solid ${T.b1}`,
        color: T.t3, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = T.cyan; e.currentTarget.style.borderColor = `${T.cyan}33`; }}
      onMouseLeave={e => { e.currentTarget.style.color = T.t3; e.currentTarget.style.borderColor = T.b1; }}
    >
      {children}
      {label}
    </a>
  );
}
/* ═══════════════════════════════════════════════════
   ABOUT
═══════════════════════════════════════════════════ */
const skillBars = [
  { label: "Full-Stack (MERN)", pct: 82, color: T.cyan },
  { label: "DevOps & CI/CD",    pct: 74, color: T.violet },
  { label: "AI / ML (Local)",   pct: 70, color: T.gold },
  { label: "Competitive Prog.", pct: 65, color: `#4de8a8` },
];

function SkillBar({ label, pct, color, delay }) {
  return (
    <Reveal delay={delay}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span className="mono" style={{ fontSize: 11, color: T.t2, letterSpacing: "0.08em" }}>{label}</span>
          <span className="mono" style={{ fontSize: 11, color }}>{pct}%</span>
        </div>
        <div style={{ height: 2, background: T.bg4, borderRadius: 1, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: delay * 0.1 + 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: "100%", background: color, borderRadius: 1 }}
          />
        </div>
      </div>
    </Reveal>
  );
}

function About() {
  const stats = [
    { label: "LeetCode / CF",   value: "200+", sub: "Problems Solved", color: T.cyan },
    { label: "CGPA",            value: "7.91", sub: "at LPU",          color: T.gold },
    { label: "Projects",        value: "10+", sub: "Shipped",          color: T.violet },
    { label: "Focus",           value: "Development",  sub: "Full stack", color: "#4de8a8" },
  ];

  return (
    <section id="about" style={{ padding: "9rem clamp(1.5rem,6vw,6rem)", position: "relative", overflow: "hidden" }}>
      {/* Section accent */}
      <div style={{
        position: "absolute", left: -300, top: "50%", transform: "translateY(-50%)",
        width: 700, height: 700, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.violet}07 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14 }}>
            <div style={{ width: 32, height: 1, background: T.cyan }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.26em", color: T.cyan, textTransform: "uppercase" }}>
              About Me
            </span>
          </div>
          <h2 className="serif" style={{
            fontSize: "clamp(2.2rem,4vw,3.6rem)", fontWeight: 300,
            letterSpacing: "-0.01em", lineHeight: 1.15, marginBottom: "3.5rem", color: T.t1,
          }}>
            Engineering software at the<br />
            <em style={{ color: T.cyan, fontStyle: "italic" }}>edge of intelligence.</em>
          </h2>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "start" }}>
          {/* Left: narrative + skill bars */}
          <div>
            <Reveal delay={0}>
              <p style={{ fontSize: "1.05rem", color: T.t2, lineHeight: 1.9, marginBottom: 22, fontWeight: 300 }}>
                I'm a <span style={{ color: T.t1 }}>B.Tech Computer Science student at Lovely Professional University</span>, building full-stack applications that span the entire modern web stack — from React interfaces and Node.js APIs to Dockerized deployments and automated CI/CD pipelines.
              </p>
            </Reveal>
            <Reveal delay={1}>
              <p style={{ fontSize: "1.05rem", color: T.t2, lineHeight: 1.9, marginBottom: 36, fontWeight: 300 }}>
                My deepest current obsession is <span style={{ color: T.cyan }}>local AI systems</span> — RAG pipelines, multimodal LLMs, and voice interfaces that run entirely on-device. I believe the next wave of developer tools will be autonomous, contextual, and private.
              </p>
            </Reveal>

            <div style={{ marginBottom: 0 }}>
              {skillBars.map((s, i) => <SkillBar key={s.label} {...s} delay={i + 2} />)}
            </div>
          </div>

          {/* Right: stats data card + photo area */}
          <div>
            {/* Stats grid */}
            <Reveal delay={2}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
                border: `1px solid ${T.b1}`, borderRadius: 4, overflow: "hidden",
                marginBottom: 24,
                background: T.b1,
              }}>
                {stats.map((s, i) => (
                  <div key={s.label} style={{
                    background: T.bg2, padding: "22px 24px",
                    borderRadius: i === 0 ? "3px 0 0 0" : i === 1 ? "0 3px 0 0" : i === 2 ? "0 0 0 3px" : "0 0 3px 0",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, ${s.color}66, transparent)`,
                    }} />
                    <p className="serif" style={{
                      fontSize: "2.4rem", fontWeight: 300, lineHeight: 1,
                      color: s.color, marginBottom: 6,
                    }}>
                      {s.value}
                    </p>
                    <p className="mono" style={{ fontSize: 10, color: T.t3, letterSpacing: "0.1em" }}>
                      {s.label.toUpperCase()}
                    </p>
                    <p style={{ fontSize: 12, color: T.t2, marginTop: 3 }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PROJECT MOCKUP COMPONENTS — Coded UI Illustrations
═══════════════════════════════════════════════════ */
/** Video Sync Extension Mockup: Browser extension popup UI */
function SyncExtensionMockup() {
  return (
    <div style={{
      background: "#0d1117", borderRadius: 6, overflow: "hidden",
      border: `1px solid rgba(255,255,255,0.06)`, height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative"
    }}>
      {/* Fake Browser Video Background */}
      <div style={{
        position: "absolute", inset: 0, background: "#0a0a0a",
        backgroundImage: "radial-gradient(circle at 50% 40%, #1e6e79 0%, transparent 60%)",
        opacity: 0.4
      }} />
      
      {/* Browser Window Dots */}
      <div style={{ position: "absolute", top: 12, left: 16, display: "flex", gap: 6 }}>
         <div style={{width: 9, height: 9, borderRadius: "50%", background: "#ff5f56", opacity: 0.7}}/>
         <div style={{width: 9, height: 9, borderRadius: "50%", background: "#ffbd2e", opacity: 0.7}}/>
         <div style={{width: 9, height: 9, borderRadius: "50%", background: "#27c93f", opacity: 0.7}}/>
      </div>

      {/* Extension Popup Interface */}
      <div style={{
        width: 250, background: "#161b22", borderRadius: 8,
        border: `1px solid rgba(77,217,232,0.15)`, zIndex: 2,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 12, color: T.cyan, fontWeight: 600, letterSpacing: "0.1em" }}>SYNC<span style={{color:T.white}}>PARTY</span></span>
          <span style={{ fontSize: 8, padding: "3px 8px", borderRadius: 4, background: "rgba(77,232,168,0.1)", color: "#4de8a8", border: "1px solid rgba(77,232,168,0.2)", letterSpacing: "0.1em" }}>● LIVE</span>
        </div>
        
        {/* Room Info */}
        <div style={{ padding: "18px" }}>
          <p className="mono" style={{ fontSize: 9, color: T.t3, marginBottom: 6, letterSpacing: "0.1em" }}>CURRENT ROOM</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
             <div style={{ flex: 1, background: "#0d1117", border: `1px solid ${T.b1}`, borderRadius: 4, padding: "8px 10px", fontSize: 11, color: T.t1, fontFamily: "'DM Mono', monospace", letterSpacing: "2px", textAlign: "center" }}>
               X7F9A-2B
             </div>
             <div style={{ background: T.cyan, color: T.bg0, borderRadius: 4, padding: "0 12px", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", textTransform: "uppercase" }}>
               Copy
             </div>
          </div>

          {/* Users Connected */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
             <span style={{ fontSize: 11, color: T.t2 }}>Connected Peers</span>
             <span className="mono" style={{ fontSize: 11, color: T.cyan }}>3 / 8</span>
          </div>

          {/* Event Log (WebSockets in action) */}
          <div style={{ background: "#0d1117", borderRadius: 4, border: `1px solid ${T.b1}`, padding: "10px", height: 76, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
               <span style={{ color: "#4de8a8", fontSize: 10 }}>▶</span>
               <span style={{ fontSize: 10, color: T.t2 }}>Navneet <span style={{color: T.t1}}>played</span> video</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
               <span style={{ color: T.gold, fontSize: 10 }}>⏸</span>
               <span style={{ fontSize: 10, color: T.t2 }}>Guest_02 <span style={{color: T.t1}}>paused</span></span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
               <span style={{ color: T.cyan, fontSize: 10 }}>⟳</span>
               <span style={{ fontSize: 10, color: T.t2 }}>Navneet <span style={{color: T.t1}}>seeked to 12:04</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** RAG System dashboard mockup */
function RAGMockup() {
  const bars = [42, 78, 55, 91, 63, 48, 82, 70];
  return (
    <div style={{
      background: "#080e16", borderRadius: 6,
      border: `1px solid ${T.b1}`, height: "100%",
      padding: "18px", fontFamily: "'DM Mono', monospace",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: T.cyan, letterSpacing: "0.15em" }}>RAG SYSTEM · LIVE</span>
        <span style={{ fontSize: 8, padding: "3px 8px", borderRadius: 1, background: `${T.cyan}18`, color: T.cyan, border: `1px solid ${T.cyan}33` }}>● OLLAMA CONNECTED</span>
      </div>
      {/* Query input */}
      <div style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 3, padding: "8px 12px", display: "flex", gap: 8 }}>
        <span style={{ color: T.cyan, fontSize: 9 }}>▸</span>
        <span style={{ fontSize: 9, color: T.t2 }}>Query: college timetable for CSE-3B section...</span>
        <span style={{ marginLeft: "auto", fontSize: 8, color: T.cyan, animation: "pulse-slow 1.5s infinite" }}>▌</span>
      </div>
      {/* Retrieval stats */}
      <div style={{ display: "flex", gap: 10 }}>
        {[["Chunks", "128"], ["Score", "0.94"], ["Latency", "312ms"]].map(([l, v]) => (
          <div key={l} style={{ flex: 1, background: T.bg3, borderRadius: 3, padding: "8px 10px", border: `1px solid ${T.b3}` }}>
            <p style={{ fontSize: 14, color: T.cyan, fontWeight: 500, lineHeight: 1, marginBottom: 3 }}>{v}</p>
            <p style={{ fontSize: 8, color: T.t3, letterSpacing: "0.1em" }}>{l.toUpperCase()}</p>
          </div>
        ))}
      </div>
      {/* Vector similarity bars */}
      <div>
        <p style={{ fontSize: 8, color: T.t3, letterSpacing: "0.12em", marginBottom: 8 }}>WEAVIATE SIMILARITY SCORES</p>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
          {bars.map((h, i) => (
            <div key={i} style={{
              flex: 1, background: i === 3 ? T.cyan : `${T.cyan}33`,
              height: `${h}%`, borderRadius: "2px 2px 0 0",
              transition: "height 0.5s",
            }} />
          ))}
        </div>
      </div>
      {/* Response stream */}
      <div style={{ fontSize: 9, color: T.t2, lineHeight: 1.7, background: T.bg3, borderRadius: 3, padding: "10px 12px", border: `1px solid ${T.b3}` }}>
        <span style={{ color: T.cyan }}>AI:</span> Based on the retrieved documents, the CSE-3B timetable for Monday includes Data Structures at 9am...
        <span style={{ color: T.cyan, animation: "pulse-slow 1s infinite" }}>▌</span>
      </div>
    </div>
  );
}

/** Full-Stack Suite mockup: three mini UI panels */
function WebSuiteMockup() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 6, height: "100%" }}>
      {/* Chat app */}
      <div style={{ background: "#0c1420", borderRadius: 4, border: `1px solid ${T.b1}`, padding: 10, gridRow: "span 2" }}>
        <p className="mono" style={{ fontSize: 8, color: T.cyan, letterSpacing: "0.12em", marginBottom: 8 }}>CHAT · SOCKET.IO</p>
        {[
          { from: true, msg: "Hey! New update is live 🚀", c: T.cyan },
          { from: false, msg: "Awesome! Is the Stripe integration done?", c: T.t2 },
          { from: true, msg: "Yes, payments are working ✓", c: T.cyan },
          { from: false, msg: "Ship it!", c: T.t2 },
        ].map((m, i) => (
          <div key={i} style={{
            marginBottom: 6, display: "flex",
            justifyContent: m.from ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "80%", padding: "5px 8px", borderRadius: 3,
              background: m.from ? `${T.cyan}18` : T.bg3,
              border: `1px solid ${m.from ? T.cyan + "33" : T.b1}`,
              fontSize: 8, color: m.c, lineHeight: 1.5,
            }}>{m.msg}</div>
          </div>
        ))}
        <div style={{
          marginTop: 8, background: T.bg3, borderRadius: 3, padding: "5px 8px",
          display: "flex", gap: 6, border: `1px solid ${T.b1}`,
        }}>
          <span style={{ fontSize: 8, color: T.t3, flex: 1 }}>Type a message...</span>
          <span style={{ fontSize: 8, color: T.cyan }}>↑</span>
        </div>
      </div>

      {/* E-commerce */}
      <div style={{ background: "#0c1420", borderRadius: 4, border: `1px solid ${T.b1}`, padding: 10 }}>
        <p className="mono" style={{ fontSize: 8, color: T.gold, letterSpacing: "0.12em", marginBottom: 7 }}>STORE · STRIPE</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[["Dev Course", "₹1,299"], ["API Kit", "₹499"]].map(([n, p]) => (
            <div key={n} style={{ flex: 1, background: T.bg3, borderRadius: 3, padding: "6px 7px", border: `1px solid ${T.b1}` }}>
              <div style={{ height: 20, background: `${T.gold}18`, borderRadius: 2, marginBottom: 5 }} />
              <p style={{ fontSize: 8, color: T.t1, marginBottom: 2 }}>{n}</p>
              <p style={{ fontSize: 9, color: T.gold, fontWeight: 600 }}>{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Map app */}
      <div style={{ background: "#080e16", borderRadius: 4, border: `1px solid ${T.b1}`, padding: 10, overflow: "hidden", position: "relative" }}>
        <p className="mono" style={{ fontSize: 8, color: "#4de8a8", letterSpacing: "0.12em", marginBottom: 6, position: "relative", zIndex: 1 }}>MAP · OSM / NOMINATIM</p>
        {/* Mini map grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(77,217,232,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(77,217,232,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "14px 14px",
        }} />
        {/* Pin */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)", background: "#4de8a8",
            boxShadow: "0 0 8px #4de8a844",
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: 24, height: 24, borderRadius: "50%",
            border: "1px solid #4de8a833", animation: "breath 2s ease-in-out infinite",
          }} />
        </div>
        <p style={{ position: "absolute", bottom: 8, left: 10, fontSize: 8, color: "#4de8a8", opacity: 0.7 }} className="mono">
          Ludhiana, Punjab ●
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PROJECTS
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   CERTIFICATIONS DATA
═══════════════════════════════════════════════════ */
const certifications = [
  { 
    id: 1, 
    title: "Cloud Computing", 
    issuer: "Nptel", 
    date: "Oct 2025", 
    link: "https://drive.google.com/file/d/1MzZk_xveltN0rSbcmbCa2ppLCjLM2n2t/view?usp=drive_link" 
  },
  { 
    id: 2, 
    title: "Full-Stack Web Development", 
    issuer: "freeCodeCamp", 
    date: "Jan 2024", 
    link: "https://drive.google.com/file/d/1MzZk_xveltN0rSbcmbCa2ppLCjLM2n2t/view?usp=drive_link" 
  },
  { 
    id: 3, 
    title: "MongoDB Basics for Students", 
    issuer: "Mongo University", 
    date: "June 2025", 
    link: "https://drive.google.com/file/d/1MzZk_xveltN0rSbcmbCa2ppLCjLM2n2t/view?usp=drive_link" 
  }
];

/* ═══════════════════════════════════════════════════
   PROJECTS
═══════════════════════════════════════════════════ */
const projects = [
  {
   id: 1,
    index: "01",
    title: "Video Sync Extension",
    subtitle: "Real-Time Browser Video Synchronizer",
    desc: "A browser extension to synchronize video playback across multiple users for platforms like YouTube and Hotstar. Features real-time pause, play, and seek event handling via Socket.io, auto-join via deep links, and robust iframe manipulation.",
    tech: ["Chrome Extension API", "Socket.IO", "Node.js", "AWS EC2", "Docker"],
    accent: T.cyan,
    Mockup: SyncExtensionMockup, // Updated Mockup
    github: "https://github.com/navneet-si",
    badge: "WebSockets / Extension",
  },
  {
    id: 2,
    index: "02",
    title: "RAG System & Voice AI",
    subtitle: "Local Retrieval-Augmented Generation",
    desc: "A fully local RAG pipeline using Weaviate vector database and Ollama. Paired with a speech-to-speech voice assistant for college infrastructure queries — zero cloud dependency, complete data sovereignty.",
    tech: ["Weaviate", "Ollama", "Python", "Vector DB", "STT / TTS"],
    accent: T.violet,
    Mockup: RAGMockup,
    github: "https://github.com/navneet-si",
    badge: "AI / DevOps",
  },
  {
    id: 3,
    index: "03",
    title: "Full-Stack Web Suite",
    subtitle: "Three Production-Grade Applications",
    desc: "A collection of advanced web apps: Real-time Chat with Socket.IO, an E-commerce platform with Stripe API, and a Georeferenced Map using OpenStreetMap & Nominatim. Each is fully deployed with CI/CD.",
    tech: ["MERN", "Socket.IO", "Stripe API", "OpenStreetMap", "REST APIs"],
    accent: T.gold,
    Mockup: WebSuiteMockup,
    github: "https://github.com/navneet-si",
    badge: "Multi-Project",
  },
];

function ProjectCard({ project, index }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <motion.article
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={revealUp}
      custom={index * 0.5}
      style={{
        display: "grid",
        gridTemplateColumns: index % 2 === 0 ? "1fr 1.1fr" : "1.1fr 1fr",
        gap: "4rem",
        alignItems: "center",
        padding: "4rem 0",
        borderTop: `1px solid ${T.b1}`,
        position: "relative",
      }}
    >
      {/* Text side */}
      <div style={{ order: index % 2 === 0 ? 1 : 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 10, color: T.t3, letterSpacing: "0.18em" }}>
            {project.index}
          </span>
          <div style={{ flex: 1, height: 1, background: T.b1 }} />
          <span style={{
            padding: "4px 10px", borderRadius: 2,
            background: `${project.accent}15`,
            border: `1px solid ${project.accent}33`,
            fontSize: 9, fontWeight: 500,
            color: project.accent, letterSpacing: "0.12em",
          }} className="mono">
            {project.badge}
          </span>
        </div>

        <h3 className="serif" style={{
          fontSize: "clamp(1.8rem,3vw,2.8rem)", fontWeight: 300,
          color: T.t1, lineHeight: 1.15, marginBottom: 8,
          letterSpacing: "-0.01em",
        }}>
          {project.title}
        </h3>
        <p style={{ fontSize: "0.95rem", color: project.accent, marginBottom: 18, fontWeight: 400, letterSpacing: "0.04em" }}>
          {project.subtitle}
        </p>
        <p style={{ fontSize: "0.95rem", color: T.t2, lineHeight: 1.8, marginBottom: 28, fontWeight: 300 }}>
          {project.desc}
        </p>

        {/* Tech tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          {project.tech.map(t => (
            <span key={t} className="mono" style={{
              fontSize: 10, letterSpacing: "0.08em",
              padding: "4px 10px", borderRadius: 2,
              background: T.bg3, border: `1px solid ${T.b1}`,
              color: T.t2,
            }}>
              {t}
            </span>
          ))}
        </div>

        <a href={project.github} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 500, color: project.accent,
            letterSpacing: "0.1em", textTransform: "uppercase",
            borderBottom: `1px solid ${project.accent}44`,
            paddingBottom: 3, transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.gap = "14px"; }}
          onMouseLeave={e => { e.currentTarget.style.gap = "8px"; }}
        >
          View Source <span>→</span>
        </a>
      </div>

      {/* Mockup side with parallax */}
      <motion.div
        style={{ y, order: index % 2 === 0 ? 2 : 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          height: 320,
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${hovered ? project.accent + "44" : T.b1}`,
          transition: "border-color 0.4s, box-shadow 0.4s",
          boxShadow: hovered ? `0 24px 60px ${project.accent}12, 0 0 0 1px ${project.accent}18` : "none",
          position: "relative",
        }}>
          {/* Reflection overlay on hover */}
          <motion.div
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
              background: `linear-gradient(135deg, ${project.accent}06 0%, transparent 50%)`,
            }}
          />
          <project.Mockup />
        </div>
      </motion.div>
    </motion.article>
  );
}

function Projects() {
  const [activeTab, setActiveTab] = useState("projects");

  return (
    <section id="projects" style={{ padding: "7rem clamp(1.5rem,6vw,6rem)", position: "relative" }}>
      <div style={{
        position: "absolute", right: -300, top: "40%",
        width: 700, height: 700, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.cyan}05 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14 }}>
            <div style={{ width: 32, height: 1, background: T.cyan }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.26em", color: T.cyan, textTransform: "uppercase" }}>
              Featured Work
            </span>
          </div>
          
          {/* Header & Toggle Container */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24, marginBottom: "3.5rem" }}>
            <h2 className="serif" style={{
              fontSize: "clamp(2.2rem,4vw,3.6rem)", fontWeight: 300,
              letterSpacing: "-0.01em", lineHeight: 1.15, margin: 0,
            }}>
              Work I'm <em style={{ color: T.cyan, fontStyle: "italic" }}>proud of.</em>
            </h2>

            {/* View Toggle */}
            <div style={{ display: "flex", background: T.bg2, padding: 6, borderRadius: 6, border: `1px solid ${T.b1}` }}>
              <button onClick={() => setActiveTab("projects")} style={{
                padding: "10px 24px", borderRadius: 4, border: "none", cursor: "pointer",
                fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em",
                background: activeTab === "projects" ? T.cyan : "transparent",
                color: activeTab === "projects" ? T.bg0 : T.t2,
                transition: "all 0.3s"
              }}>PROJECTS</button>
              <button onClick={() => setActiveTab("certs")} style={{
                padding: "10px 24px", borderRadius: 4, border: "none", cursor: "pointer",
                fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em",
                background: activeTab === "certs" ? T.cyan : "transparent",
                color: activeTab === "certs" ? T.bg0 : T.t2,
                transition: "all 0.3s"
              }}>CERTIFICATIONS</button>
            </div>
          </div>
        </Reveal>

        {/* Animated Content Switcher */}
        <AnimatePresence mode="wait">
          {activeTab === "projects" ? (
            <motion.div
              key="projects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
            </motion.div>
          ) : (
            <motion.div
              key="certs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "2rem", paddingTop: "1rem"
              }}
            >
              {certifications.map(c => (
                <div key={c.id} style={{
                  background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 6, padding: "2.5rem 2rem", position: "relative", overflow: "hidden"
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${T.cyan}, transparent)` }} />
                  <p className="mono" style={{ fontSize: 10, color: T.t3, letterSpacing: "0.1em", marginBottom: 16 }}>{c.date}</p>
                  <h4 className="serif" style={{ fontSize: "1.6rem", fontWeight: 400, color: T.t1, marginBottom: 8, lineHeight: 1.2 }}>{c.title}</h4>
                  <p style={{ fontSize: "0.95rem", color: T.t2, marginBottom: 32 }}>{c.issuer}</p>
                  <a href={c.link} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px",
                    background: `${T.cyan}11`, border: `1px solid ${T.cyan}44`,
                    color: T.cyan, fontSize: 10, fontWeight: 600, borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.15em", transition: "all 0.2s"
                  }} onMouseEnter={e => { e.currentTarget.style.background = `${T.cyan}22`; e.currentTarget.style.borderColor = T.cyan; }} onMouseLeave={e => { e.currentTarget.style.background = `${T.cyan}11`; e.currentTarget.style.borderColor = `${T.cyan}44`; }}>
                    View Credential ↗
                  </a>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   SKILLS MARQUEE
═══════════════════════════════════════════════════ */
const techStack = [
  { name: "React",      sym: "⬡" },
  { name: "Node.js",    sym: "◈" },
  { name: "Express",    sym: "◉" },
  { name: "MongoDB",    sym: "⬢" },
  { name: "Linux Mint", sym: "◫" },
  { name: "Git",        sym: "⌥" },
  { name: "Docker",     sym: "⬛" },
  { name: "Socket.IO",  sym: "⚡" },
  { name: "Weaviate",   sym: "◈" },
  { name: "Ollama",     sym: "◉" },
  { name: "Python",     sym: "⬡" },
  { name: "C++",        sym: "⌬" },
  { name: "TypeScript", sym: "◫" },
  { name: "CI / CD",    sym: "⬢" },
  { name: "REST APIs",  sym: "⌥" },
  { name: "Tailwind",   sym: "⬡" },
];

function MarqueeRow({ reverse = false, opacity = 0.6, scale = 1 }) {
  const doubled = [...techStack, ...techStack];
  return (
    <div style={{ overflow: "hidden", padding: "14px 0" }}>
      <div style={{
        display: "flex", gap: 0,
        animation: `${reverse ? "marquee-rtl" : "marquee-ltr"} ${reverse ? 26 : 32}s linear infinite`,
        width: "max-content",
      }}>
        {doubled.map((t, i) => (
          <div key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "0 32px",
            borderRight: `1px solid ${T.b1}`,
          }}>
            <span style={{ color: T.cyan, fontSize: 11 * scale, opacity: 0.5 }}>{t.sym}</span>
            <span style={{
              fontSize: 13 * scale, fontWeight: 300, letterSpacing: "0.1em",
              color: T.t2, opacity,
              textTransform: "uppercase",
              fontFamily: "'DM Mono', monospace",
            }}>
              {t.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Skills() {
  return (
    <section id="skills" style={{ position: "relative", padding: "0" }}>
      <div style={{
        borderTop: `1px solid ${T.b1}`,
        borderBottom: `1px solid ${T.b1}`,
        background: T.bg2,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Blurred edges */}
        {["left","right"].map(side => (
          <div key={side} style={{
            position: "absolute", top: 0, bottom: 0,
            [side]: 0, width: 140, zIndex: 2,
            background: `linear-gradient(${side === "left" ? "90deg" : "-90deg"}, ${T.bg2}, transparent)`,
            pointerEvents: "none",
          }} />
        ))}

        <MarqueeRow opacity={0.55} />
        <div style={{ height: 1, background: T.b1 }} />
        <MarqueeRow reverse opacity={0.35} scale={0.9} />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   CONTACT
═══════════════════════════════════════════════════ */
function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null); // null | "sending" | "sent"

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    // ↓ REPLACE: wire to EmailJS, Resend, Formspree, etc.
    await new Promise(r => setTimeout(r, 1400));
    setStatus("sent");
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setStatus(null), 5000);
  };

  const Field = ({ label, type = "text", rows, value, onChange, placeholder }) => {
    const [focused, setFocused] = useState(false);
    const Tag = rows ? "textarea" : "input";
    return (
      <div style={{ position: "relative", marginBottom: 24 }}>
        <label className="mono" style={{
          display: "block", marginBottom: 8,
          fontSize: 10, letterSpacing: "0.18em",
          color: focused ? T.cyan : T.t3,
          textTransform: "uppercase",
          transition: "color 0.2s",
        }}>
          {label}
        </label>
        <Tag
          type={type}
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: T.bg3,
            border: `1px solid ${focused ? T.cyan + "55" : T.b1}`,
            borderRadius: 3,
            color: T.t1,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            resize: rows ? "vertical" : undefined,
            minHeight: rows ? 120 : undefined,
            transition: "border-color 0.2s",
          }}
        />
      </div>
    );
  };

  return (
    <section id="contact" style={{ padding: "9rem clamp(1.5rem,6vw,6rem)", position: "relative" }}>
      {/* Soft glow */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 700, height: 400,
        background: `radial-gradient(ellipse at bottom, ${T.cyan}07 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14 }}>
            <div style={{ width: 32, height: 1, background: T.cyan }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.26em", color: T.cyan, textTransform: "uppercase" }}>
              Get in Touch
            </span>
          </div>
          <h2 className="serif" style={{
            fontSize: "clamp(2.2rem,4vw,3.6rem)", fontWeight: 300,
            letterSpacing: "-0.01em", lineHeight: 1.15, marginBottom: 16,
          }}>
            Let's build something<br />
            <em style={{ color: T.cyan, fontStyle: "italic" }}>remarkable together.</em>
          </h2>
          <p style={{ fontSize: "1rem", color: T.t2, lineHeight: 1.8, marginBottom: "3rem", fontWeight: 300 }}>
            Open to internships, full-time roles, and freelance projects — especially in full-stack, DevOps, or AI-adjacent work. Reach out and I'll respond within 24 hours.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div style={{
            background: "rgba(10,20,32,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${T.b1}`,
            borderRadius: 6,
            padding: "clamp(1.5rem,4vw,2.5rem)",
          }}>
            <form onSubmit={submit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <Field
                  label="Name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                />
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
              <Field
                label="Message"
                rows={5}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Tell me about your project or opportunity..."
              />

              <AnimatePresence mode="wait">
                {status === "sent" ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      padding: "13px 24px", borderRadius: 3,
                      background: `rgba(77,232,168,0.1)`,
                      border: `1px solid rgba(77,232,168,0.3)`,
                      color: "#4de8a8", fontSize: 13, fontWeight: 500,
                      textAlign: "center",
                    }}
                  >
                    ✓ &nbsp; Message sent — I'll be in touch soon.
                  </motion.div>
                ) : (
                  <motion.button
                    key="btn"
                    type="submit"
                    disabled={status === "sending"}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: "100%", padding: "14px", borderRadius: 3,
                      background: status === "sending" ? T.bg4 : T.cyan,
                      border: "none", color: T.bg0,
                      fontSize: 11, fontWeight: 600,
                      letterSpacing: "0.2em", textTransform: "uppercase",
                      cursor: status === "sending" ? "not-allowed" : "pointer",
                      fontFamily: "'DM Mono', monospace",
                      transition: "background 0.3s",
                    }}
                  >
                    {status === "sending" ? "Sending..." : "Send Message →"}
                  </motion.button>
                )}
              </AnimatePresence>
            </form>
          </div>
        </Reveal>

        {/* Direct contacts */}
        <Reveal delay={2}>
          <div style={{ display: "flex", gap: 28, justifyContent: "center", marginTop: "2.5rem", flexWrap: "wrap" }}>
            {[
              { href: "mailto:navneet04080@gmail.com", label: "navneet04080@gmail.com", color: T.cyan },
              // ↑ REPLACE with your actual email
              { href: "https://github.com/navneet-si", label: "github/navneet-si", color: T.t2 },
              { href: "https://linkedin.com/in/navneet-singh-710291289", label: "linkedin/navneet-singh", color: T.t2 },
            ].map((c) => (
              <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: c.color, letterSpacing: "0.06em", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = T.cyan}
                onMouseLeave={e => e.currentTarget.style.color = c.color}
              >
                {c.label}
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${T.b1}`,
      padding: "2rem clamp(1.5rem,6vw,6rem)",
      display: "flex", justifyContent: "space-between",
      alignItems: "center", flexWrap: "wrap", gap: 14,
      position: "relative",
    }}>
      {/* Glow on top rule */}
      <div style={{
        position: "absolute", top: -1, left: "30%", right: "30%", height: 1,
        background: `linear-gradient(90deg, transparent, ${T.cyan}44, transparent)`,
        filter: "blur(1px)",
      }} />

      <span className="serif" style={{ fontSize: 20, fontWeight: 300, color: T.t3 }}>
        N<span style={{ color: T.cyan }}>.</span>
      </span>

      <p className="mono" style={{ fontSize: 10, color: T.t3, letterSpacing: "0.12em" }}>
        © {new Date().getFullYear()} Navneet Singh &nbsp;·&nbsp; Built with React & Framer Motion
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        {[
          { href: "https://github.com/navneet-si", Icon: GithubIcon },
          { href: "https://linkedin.com/in/navneet-singh-710291289", Icon: LinkedinIcon },
        ].map(({ href, Icon }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer"
            style={{ color: T.t3, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = T.cyan}
            onMouseLeave={e => e.currentTarget.style.color = T.t3}
          >
            <Icon size={15} />
          </a>
        ))}
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════ */
function GithubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}
function LinkedinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════ */
export default function App() {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <About />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
