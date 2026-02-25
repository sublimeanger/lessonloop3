import { motion } from "framer-motion";

interface Step {
  step: string;
  title: string;
  description: string;
}

interface FeaturePageHowItWorksProps {
  eyebrow?: string;
  headline: string;
  subtitle?: string;
  steps: Step[];
}

export default function FeaturePageHowItWorks({ eyebrow = "HOW IT WORKS", headline, subtitle, steps }: FeaturePageHowItWorksProps) {
  return (
    <section className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block text-sm font-semibold text-primary mb-4 uppercase tracking-wide">{eyebrow}</span>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">{headline}</h2>
          {subtitle && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-5 text-xl font-bold">
                {step.step}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
