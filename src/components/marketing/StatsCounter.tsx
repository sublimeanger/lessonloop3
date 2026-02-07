import { motion } from "framer-motion";
import { Calendar, Receipt, Users, Shield } from "lucide-react";

const stats = [
  { 
    label: "Unlimited Students",
    sublabel: "On every plan",
    icon: Users,
    color: "from-teal to-teal-dark"
  },
  { 
    label: "Automated Billing",
    sublabel: "Invoice runs in clicks",
    icon: Receipt,
    color: "from-coral to-coral-dark"
  },
  { 
    label: "Purpose-Built",
    sublabel: "For UK music teachers",
    icon: Calendar,
    color: "from-violet-500 to-violet-600"
  },
  { 
    label: "GDPR Compliant",
    sublabel: "Secure by design",
    icon: Shield,
    color: "from-emerald-500 to-emerald-600"
  },
];

export function StatsCounter() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-r from-ink to-ink-light relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-coral/10 rounded-full blur-3xl" />
      
      {/* Floating Music Notes — desktop only for performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
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

              {/* Label */}
              <div className="text-xl lg:text-2xl font-bold text-white mb-1">
                {stat.label}
              </div>

              {/* Sublabel */}
              <div className="text-white/60 text-sm lg:text-base">
                {stat.sublabel}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
