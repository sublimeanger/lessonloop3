import { motion } from "framer-motion";

const logos = [
  { name: "ABRSM", fullName: "Associated Board of the Royal Schools of Music" },
  { name: "Trinity", fullName: "Trinity College London" },
  { name: "Rockschool", fullName: "RSL Awards" },
  { name: "MTB", fullName: "Music Teachers Board" },
  { name: "LCM", fullName: "London College of Music" },
  { name: "ISM", fullName: "Incorporated Society of Musicians" },
  { name: "MU", fullName: "Musicians' Union" },
  { name: "EPTA", fullName: "European Piano Teachers Association" },
];

const integrations = [
  { name: "Stripe", color: "#635BFF" },
  { name: "Google Calendar", color: "#4285F4" },
  { name: "Zoom", color: "#2D8CFF" },
  { name: "Outlook", color: "#0078D4" },
];

function MarqueeRow({ items, reverse = false, speed = 30 }: { 
  items: { name: string; fullName?: string; color?: string }[]; 
  reverse?: boolean;
  speed?: number;
}) {
  const duplicatedItems = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden py-4">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
      
      <motion.div
        animate={{ x: reverse ? ["-33.33%", "0%"] : ["0%", "-33.33%"] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: speed,
            ease: "linear",
          },
        }}
        className="flex gap-8"
      >
        {duplicatedItems.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="flex-shrink-0 group"
            role="img"
            aria-label={item.fullName || item.name}
          >
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-muted/50 border border-border hover:border-primary/20 transition-all hover:bg-muted">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ 
                  backgroundColor: item.color ? `${item.color}20` : 'hsl(var(--muted))',
                  color: item.color || 'hsl(var(--muted-foreground))'
                }}
                aria-hidden="true"
              >
                {item.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm whitespace-nowrap">
                  {item.name}
                </div>
                {item.fullName && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                    {item.fullName}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function LogoMarquee() {
  return (
    <section className="py-20 bg-background overflow-hidden">
      <div className="container mx-auto px-6 lg:px-8 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Trusted by educators preparing students for
          </p>
          <h3 className="text-xl font-semibold text-foreground">
            Leading examination boards & seamless integrations
          </h3>
        </motion.div>
      </div>

      {/* Exam Boards Row */}
      <MarqueeRow items={logos} speed={40} />
      
      {/* Integrations Row (Reverse) */}
      <MarqueeRow items={integrations} reverse speed={30} />
    </section>
  );
}
