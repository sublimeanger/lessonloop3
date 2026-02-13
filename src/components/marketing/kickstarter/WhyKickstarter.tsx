import { motion } from "framer-motion";
import { Server, Smartphone, Sparkles } from "lucide-react";

const pillars = [
  {
    icon: Server,
    title: "Infrastructure",
    body: "Scale our servers and database to handle thousands of teachers and their students reliably, with enterprise-grade uptime.",
  },
  {
    icon: Smartphone,
    title: "Mobile App",
    body: "Build native iOS and Android apps so teachers can manage lessons on the go and parents can check schedules from anywhere.",
  },
  {
    icon: Sparkles,
    title: "AI Enhancement",
    body: "Expand LoopAssist with smarter scheduling suggestions, automated invoice generation, and predictive analytics for your teaching business.",
  },
];

export function WhyKickstarter() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Why Kickstarter?
          </h2>
          <p className="text-lg text-muted-foreground">
            The core platform is <strong className="text-foreground">already built and functional</strong>. 
            Your backing funds the next phase — scaling infrastructure, launching mobile apps, and supercharging our AI assistant.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-8 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal/20 to-teal/5 flex items-center justify-center mx-auto mb-5">
                <p.icon className="w-7 h-7 text-teal" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{p.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
