import { motion, useInView, useSpring, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Calendar, Receipt, Users, TrendingUp } from "lucide-react";

const stats = [
  { 
    value: 50000, 
    suffix: "+", 
    label: "Lessons Scheduled Monthly",
    icon: Calendar,
    color: "from-teal to-teal-dark"
  },
  { 
    value: 2, 
    prefix: "£", 
    suffix: "M+", 
    label: "Invoices Processed",
    icon: Receipt,
    color: "from-coral to-coral-dark"
  },
  { 
    value: 2000, 
    suffix: "+", 
    label: "UK Educators",
    icon: Users,
    color: "from-violet-500 to-violet-600"
  },
  { 
    value: 99.9, 
    suffix: "%", 
    label: "Uptime Guarantee",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-600"
  },
];

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [displayValue, setDisplayValue] = useState(0);

  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 30,
  });

  const rounded = useTransform(springValue, (latest) => {
    if (value >= 1000) {
      return Math.round(latest).toLocaleString();
    }
    return Number(latest.toFixed(1));
  });

  useEffect(() => {
    if (isInView) {
      springValue.set(value);
    }
  }, [isInView, value, springValue]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      setDisplayValue(v as unknown as number);
    });
    return unsubscribe;
  }, [rounded]);

  return (
    <span ref={ref}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}

export function StatsCounter() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-r from-ink to-ink-light relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-coral/10 rounded-full blur-3xl" />
      
      {/* Floating Music Notes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {["♪", "♫", "♩", "♬"].map((note, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1, y: "100%" }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              y: [100, -20, 100],
              x: [0, 20, 0],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              delay: i * 2,
              ease: "easeInOut",
            }}
            className="absolute text-4xl text-white/10"
            style={{
              left: `${15 + i * 25}%`,
              top: "50%",
            }}
          >
            {note}
          </motion.div>
        ))}
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} mx-auto mb-4 flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="w-7 h-7 text-white" />
              </motion.div>

              {/* Number */}
              <div className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white mb-2 font-mono tracking-tight">
                <AnimatedNumber 
                  value={stat.value} 
                  prefix={stat.prefix} 
                  suffix={stat.suffix} 
                />
              </div>

              {/* Label */}
              <div className="text-white/60 text-sm lg:text-base">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
