import { motion } from "framer-motion";

const logos = [
  { name: "ABRSM", initials: "ABRSM" },
  { name: "Trinity College", initials: "TCL" },
  { name: "Rockschool", initials: "RSL" },
  { name: "MTB", initials: "MTB" },
  { name: "LCM", initials: "LCM" },
  { name: "ISM", initials: "ISM" },
];

export function LogoCloud() {
  return (
    <section className="py-16 bg-background border-y border-border">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            Trusted by educators preparing students for
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
        >
          {logos.map((logo, index) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * index }}
              className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                {logo.initials}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{logo.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
