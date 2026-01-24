import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Heart, Target, Users, Lightbulb, MapPin, Mail, Music, Calendar, PoundSterling, Sparkles, ArrowRight, Clock, Zap, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const values = [
  {
    icon: Heart,
    title: "Educator-First",
    description: "We build for music teachers, not against them. Every feature solves a real problem faced by real educators.",
    color: "from-coral to-coral-dark",
  },
  {
    icon: Target,
    title: "Simplicity",
    description: "Powerful doesn't mean complicated. We obsess over making complex tasks feel effortless.",
    color: "from-teal to-teal-dark",
  },
  {
    icon: Users,
    title: "Community",
    description: "We're building alongside our users, not for them. Your feedback shapes our roadmap.",
    color: "from-ink to-ink-light",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description: "We embrace new technology to solve old problems. AI assistance that actually helps.",
    color: "from-amber-500 to-orange-600",
  },
];

const milestones = [
  { year: "2021", title: "The Idea", description: "Frustrated with spreadsheets and sticky notes, our founder sketches the first wireframes." },
  { year: "2022", title: "Beta Launch", description: "First 50 teachers sign up. Feedback shapes every feature we build." },
  { year: "2023", title: "1,000 Teachers", description: "Word spreads. Music educators across the UK discover a better way." },
  { year: "2024", title: "LoopAssist AI", description: "We introduce AI-powered assistance, saving teachers hours every week." },
  { year: "2025", title: "2,000+ & Growing", description: "Multi-location academies join. Enterprise features launch." },
];

const team = [
  { name: "Alex Turner", role: "Co-Founder & CEO", initials: "AT", bio: "Former piano teacher turned product builder. 15 years teaching experience.", gradient: "from-teal to-teal-dark" },
  { name: "Sophie Chen", role: "Co-Founder & CTO", initials: "SC", bio: "Engineering leader with a decade in EdTech. Stanford CS graduate.", gradient: "from-coral to-coral-dark" },
  { name: "James Williams", role: "Head of Product", initials: "JW", bio: "10 years crafting SaaS products. Former Notion and Calendly.", gradient: "from-ink to-ink-light" },
  { name: "Emma Richards", role: "Head of Customer Success", initials: "ER", bio: "Passionate about educator support. Ex-music academy manager.", gradient: "from-amber-500 to-orange-600" },
];

const stats = [
  { value: 2000, suffix: "+", label: "Music Educators", icon: Users },
  { value: 150, suffix: "K+", label: "Lessons Scheduled", icon: Calendar },
  { value: 2.5, suffix: "M", label: "Invoices Processed (£)", icon: PoundSterling },
  { value: 4.9, suffix: "/5", label: "Customer Rating", icon: Award },
];

function AnimatedCounter({ value, suffix, duration = 2 }: { value: number; suffix: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * value * 10) / 10);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };
    requestAnimationFrame(step);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {count % 1 === 0 ? count : count.toFixed(1)}{suffix}
    </span>
  );
}

export default function About() {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-coral/5 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6"
            >
              <Music className="w-4 h-4" />
              Our Story
            </motion.span>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-6">
              Built by educators,
              <br />
              <span className="bg-gradient-to-r from-teal via-teal-dark to-ink bg-clip-text text-transparent">
                for educators
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              We started LessonLoop because we lived the problem. 
              Now we're solving it for thousands of music teachers across the UK.
            </p>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="relative group"
                >
                  <div className="p-4 lg:p-6 rounded-2xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-all hover:border-primary/20">
                    <stat.icon className="w-5 h-5 text-primary mb-2 mx-auto lg:mx-0" />
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story Section with Image */}
      <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <span className="inline-block text-sm font-semibold text-primary mb-4">THE BEGINNING</span>
              <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                From frustration
                <br />to innovation
              </h2>
              <div className="space-y-4 text-muted-foreground text-lg">
                <p>
                  LessonLoop was born from <span className="text-foreground font-medium">15 years of frustration</span>. Our founder, a piano teacher, 
                  spent countless hours juggling spreadsheets, chasing invoices, and answering 
                  repetitive parent emails.
                </p>
                <p className="text-xl font-medium text-foreground">
                  There had to be a better way. So we built it.
                </p>
                <p>
                  Today, LessonLoop serves over 2,000 music educators across the United Kingdom, 
                  from solo piano teachers to large multi-location academies.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-8">
                <Link to="/features">
                  <Button size="lg" className="group">
                    See How It Works
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline">
                    Talk to Us
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative order-1 lg:order-2"
            >
              {/* Decorative grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--muted)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted)/0.5)_1px,transparent_1px)] bg-[size:24px_24px] rounded-3xl" />
              
              {/* Main card */}
              <div className="relative bg-gradient-to-br from-teal via-teal-dark to-ink rounded-3xl p-8 lg:p-12 shadow-xl overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-coral/20 rounded-full blur-2xl" />
                
                <div className="relative text-center text-white space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm">
                    <Sparkles className="w-4 h-4" />
                    Trusted Platform
                  </div>
                  
                  <div className="text-6xl lg:text-8xl font-bold">2,000+</div>
                  <div className="text-xl lg:text-2xl text-white/80">Music Educators</div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                    <div>
                      <div className="text-2xl lg:text-3xl font-bold">£2.5M+</div>
                      <div className="text-sm text-white/60">Invoiced</div>
                    </div>
                    <div>
                      <div className="text-2xl lg:text-3xl font-bold">150K+</div>
                      <div className="text-sm text-white/60">Lessons</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating accent cards */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute -bottom-4 -left-4 lg:-left-8 p-4 rounded-2xl bg-background border border-border shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">10+ hours saved</div>
                    <div className="text-xs text-muted-foreground">per teacher, per week</div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="absolute -top-4 -right-4 lg:-right-8 p-4 rounded-2xl bg-background border border-border shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">4.9/5 Rating</div>
                    <div className="text-xs text-muted-foreground">from 500+ reviews</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 lg:py-28 bg-muted/30 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block text-sm font-semibold text-primary mb-4">OUR JOURNEY</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
              Milestones along the way
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From a solo founder's frustration to a platform trusted by thousands.
            </p>
          </motion.div>

          {/* Desktop Timeline */}
          <div className="hidden md:block relative">
            {/* Timeline Line */}
            <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />
            
            <div className="grid grid-cols-5 gap-4">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative pt-12"
                >
                  {/* Dot */}
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-md" />
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{milestone.year}</div>
                    <h3 className="font-semibold text-foreground mb-2">{milestone.title}</h3>
                    <p className="text-sm text-muted-foreground">{milestone.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile Timeline */}
          <div className="md:hidden space-y-6">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  {index < milestones.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  )}
                </div>
                <div className="pb-6">
                  <div className="text-lg font-bold text-primary">{milestone.year}</div>
                  <h3 className="font-semibold text-foreground">{milestone.title}</h3>
                  <p className="text-sm text-muted-foreground">{milestone.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block text-sm font-semibold text-primary mb-4">WHAT DRIVES US</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we build.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full p-6 lg:p-8 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${value.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <value.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block text-sm font-semibold text-primary mb-4">THE PEOPLE</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
              Meet the Team
            </h2>
            <p className="text-lg text-muted-foreground">
              A small team with a big mission.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="relative p-6 lg:p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 text-center">
                  {/* Avatar */}
                  <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl lg:text-3xl group-hover:scale-105 transition-transform shadow-lg`}>
                    {member.initials}
                  </div>
                  
                  <h3 className="font-bold text-foreground text-lg">{member.name}</h3>
                  <p className="text-sm text-primary font-medium mb-3">{member.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-ink via-ink to-ink-light text-white relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-teal/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-coral/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-sm font-semibold text-teal-light mb-4">GET IN TOUCH</span>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 leading-tight">
                Have questions?
                <br />
                <span className="text-white/70">We'd love to hear from you.</span>
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Whether you're a solo teacher or running a multi-location academy, 
                our team is here to help you get started.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-teal/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-teal-light" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Email us anytime</div>
                    <div className="font-semibold">hello@lessonloop.com</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-teal/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-teal-light" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Based in</div>
                    <div className="font-semibold">London, United Kingdom</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-teal/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-teal-light" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Response time</div>
                    <div className="font-semibold">Within 24 hours</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="p-6 lg:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-6">Send us a message</h3>
                <form className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white/80">First name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent transition-all"
                        placeholder="Alex"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white/80">Last name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent transition-all"
                        placeholder="Turner"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/80">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/80">How can we help?</label>
                    <textarea 
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent resize-none transition-all"
                      placeholder="Tell us about your music teaching business..."
                    />
                  </div>
                  <Button 
                    type="submit"
                    size="lg"
                    className="w-full bg-teal hover:bg-teal-dark text-white"
                  >
                    Send Message
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
