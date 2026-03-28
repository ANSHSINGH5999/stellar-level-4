import React, { useEffect, useState } from "react";

const BALLS = [
  { color: "#FF3B30", delay: "0s",    angle: 0   },  // Red
  { color: "#FF9500", delay: "0.15s", angle: 60  },  // Orange
  { color: "#FFCC00", delay: "0.3s",  angle: 120 },  // Yellow
  { color: "#34C759", delay: "0.45s", angle: 180 },  // Green
  { color: "#007AFF", delay: "0.6s",  angle: 240 },  // Blue
  { color: "#AF52DE", delay: "0.75s", angle: 300 },  // Purple
];

const LETTERS = ["R", "I", "S", "E", "I", "N"];

export function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("enter"); // enter → text → exit
  const [visibleLetters, setVisibleLetters] = useState(0);

  useEffect(() => {
    // Reveal letters one by one
    let i = 0;
    const reveal = setInterval(() => {
      i++;
      setVisibleLetters(i);
      if (i >= LETTERS.length) clearInterval(reveal);
    }, 140);

    // Hold then exit
    const exitTimer = setTimeout(() => setPhase("exit"), 2800);
    const doneTimer = setTimeout(() => onDone(), 3600);

    return () => {
      clearInterval(reveal);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
      style={{
        transition: "opacity 0.8s ease, transform 0.8s ease",
        opacity: phase === "exit" ? 0 : 1,
        transform: phase === "exit" ? "scale(1.04)" : "scale(1)",
        pointerEvents: phase === "exit" ? "none" : "all",
      }}
    >
      {/* Orbital ring with colorful balls */}
      <div className="relative w-48 h-48 mb-10">
        {BALLS.map((ball, i) => {
          const rad = (ball.angle * Math.PI) / 180;
          const r = 72; // orbit radius px
          const cx = 96 + r * Math.cos(rad);
          const cy = 96 + r * Math.sin(rad);

          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: cx - 10,
                top: cy - 10,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${ball.color}ee, ${ball.color}66)`,
                boxShadow: `0 0 18px 4px ${ball.color}55`,
                animation: `bounceBall 1.4s ease-in-out ${ball.delay} infinite`,
              }}
            />
          );
        })}

        {/* Center glowing dot */}
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 0 24px 6px rgba(255,255,255,0.5)",
          }}
        />
      </div>

      {/* RISEIN text */}
      <div className="flex items-end gap-1" aria-label="RISEIN">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5rem)",
              fontWeight: 900,
              letterSpacing: "0.18em",
              color: "white",
              fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
              display: "inline-block",
              opacity: visibleLetters > i ? 1 : 0,
              transform: visibleLetters > i ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
              transition: "opacity 0.35s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              textShadow: "0 0 40px rgba(255,255,255,0.25)",
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Subtle tagline */}
      <p
        style={{
          marginTop: "1.25rem",
          fontSize: "0.75rem",
          letterSpacing: "0.35em",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          opacity: visibleLetters >= LETTERS.length ? 1 : 0,
          transition: "opacity 0.6s ease 0.3s",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Stellar DeFi Platform
      </p>
    </div>
  );
}
