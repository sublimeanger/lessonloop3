import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Heart, Target, Users, Lightbulb, MapPin, Mail } from "lucide-react";

const values = [
  {
    icon: Heart,
    title: "Educator-First",
    description: "We build for music teachers, not against them. Every feature solves a real problem faced by real educators.",
  },
  {
    icon: Target,
    title: "Simplicity",
    description: "Powerful doesn't mean complicated. We obsess over making complex tasks feel effortless.",
  },
  {
    icon: Users,
    title: "Community",
    description: "We're building alongside our users, not for them. Your feedback shapes our roadmap.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description: "We embrace new technology to solve old problems. AI assistance that actually helps.",
  },
];

const team = [
  { name: "Alex Turner", role: "Co-Founder & CEO", initials: "AT", bio: "Former music teacher turned product builder" },
  { name: "Sophie Chen", role: "Co-Founder & CTO", initials: "SC", bio: "Engineering leader with EdTech background" },
  { name: "James Williams", role: "Head of Product", initials: "JW", bio: "10 years in SaaS product management" },
  { name: "Emma Richards", role: "Head of Customer Success", initials: "ER", bio: "Passionate about educator support" },
];

export default function About() {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-teal/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              About Us
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Built by educators,
              <br />
              <span className="text-muted-foreground">for educators</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              We started LessonLoop because we lived the problem. 
              Now we're solving it for thousands of music teachers across the UK.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  LessonLoop was born from frustration. Our founder, a piano teacher for 15 years, 
                  spent countless hours juggling spreadsheets, chasing invoices, and answering 
                  repetitive parent emails.
                </p>
                <p>
                  There had to be a better way. So we built it.
                </p>
                <p>
                  Today, LessonLoop serves over 2,000 music educators across the United Kingdom, 
                  from solo piano teachers to large multi-location academies. We've processed 
                  millions of pounds in invoices and scheduled hundreds of thousands of lessons.
                </p>
                <p>
                  But we're just getting started.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-teal to-ink overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white p-8">
                    <div className="text-7xl font-bold mb-4">2,000+</div>
                    <div className="text-xl text-white/80">Music Educators</div>
                    <div className="text-white/60 mt-2">trust LessonLoop</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we build.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {value.title}
                </h3>
                <p className="text-muted-foreground">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Meet the Team
            </h2>
            <p className="text-lg text-muted-foreground">
              A small team with a big mission.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl">
                  {member.initials}
                </div>
                <h3 className="font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-primary font-medium mb-2">{member.role}</p>
                <p className="text-sm text-muted-foreground">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 lg:py-28 bg-ink text-white">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Get in Touch
              </h2>
              <p className="text-white/70 mb-8">
                Have questions? We'd love to hear from you. 
                Our team is here to help.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-teal-light" />
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Email us</div>
                    <div className="font-medium">hello@lessonloop.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-teal-light" />
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Based in</div>
                    <div className="font-medium">London, United Kingdom</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-3xl bg-white/5 border border-white/10"
            >
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea 
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal resize-none"
                    placeholder="How can we help?"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 rounded-xl bg-teal text-white font-semibold hover:bg-teal-dark transition-colors"
                >
                  Send Message
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
