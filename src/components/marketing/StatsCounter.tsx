import { motion } from "framer-motion";


const stats = [
  { 
    value: "50+",
    label: "Features built for music teaching",
    color: "from-teal to-teal-dark"
  },
  { 
    value: "< 2 min",
    label: "To generate a full invoice run",
    color: "from-coral to-coral-dark"
  },
  { 
    value: "24/7",
    label: "Parent portal access for families",
    color: "from-violet to-violet"
  },
  { 
    value: "Zero",
    label: "Spreadsheets needed",
    color: "from-emerald to-emerald"
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

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
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
              {/* Value */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                className={`text-4xl lg:text-5xl font-extrabold mb-3 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}
              >
                {stat.value}
              </motion.div>

              {/* Label */}
              <div className="text-white/70 text-sm lg:text-base">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
