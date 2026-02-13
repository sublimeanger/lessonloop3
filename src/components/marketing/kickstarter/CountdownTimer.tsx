import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const TARGET_DATE = new Date("2026-06-01T09:00:00Z");

function calcTimeLeft() {
  const diff = TARGET_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  compact?: boolean;
}

export function CountdownTimer({ compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {units.map((u, i) => (
          <div key={u.label} className="flex items-center gap-1">
            <span className="text-xl font-bold text-white tabular-nums">
              {String(u.value).padStart(2, "0")}
            </span>
            <span className="text-xs text-white/50 uppercase">{u.label[0]}</span>
            {i < units.length - 1 && (
              <span className="text-white/30 ml-1">:</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5">
      {units.map((u, i) => (
        <motion.div
          key={u.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i, type: "spring", stiffness: 200 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
              {String(u.value).padStart(2, "0")}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs text-white/50 uppercase tracking-widest font-medium">
            {u.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
