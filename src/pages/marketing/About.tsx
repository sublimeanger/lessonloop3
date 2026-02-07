import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Heart, Target, Users, Lightbulb, MapPin, Mail, Music, Calendar, Receipt, MessageSquare, ArrowRight, Clock, ExternalLink, Quote, Repeat, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const values = [
  {
    icon: Heart,
    title: "Educator-First",
    description: "Every feature exists because a real music teacher needed it. We don't build for boardrooms — we build for teaching studios.",
    color: "from-coral to-coral-dark",
  },
  {
    icon: Target,
    title: "Simplicity",
    description: "Powerful doesn't mean complicated. If it takes more than a few clicks, we haven't finished designing it.",
    color: "from-teal to-teal-dark",
  },
  {
    icon: Users,
    title: "Community",
    description: "We're building alongside our users. Your feedback shapes our roadmap — because you know teaching better than anyone.",
    color: "from-ink to-ink-light",
  },
  {
    icon: Lightbulb,
    title: "Honesty",
    description: "No fake metrics, no inflated claims. We'd rather under-promise and over-deliver than the other way around.",
    color: "from-amber-500 to-orange-600",
  },
];

const painPoints = [
  {
    icon: Calendar,
    title: "Scheduling that makes sense",
    description: "Recurring lessons, term-time teaching, real-world availability — not a generic calendar forced into a music teacher's life.",
  },
  {
    icon: Repeat,
    title: "Rescheduling without the friction",
    description: "Reduce the back-and-forth and protect your time. No more endless message chains just to move a lesson.",
  },
  {
    icon: MessageSquare,
    title: "Clear communication",
    description: "Keep students and parents in the loop without chasing. Professional, simple, and automatic.",
  },
  {
    icon: Receipt,
    title: "Billing that just works",
    description: "Professional invoicing, payment tracking, and automated reminders. Built for GBP, VAT, and how UK teachers actually bill.",
  },
  {
    icon: Scale,
    title: "A system that scales",
    description: "Whether you teach solo or manage a growing team across multiple locations, LessonLoop grows with you.",
  },
];

export default function About() {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 relative overflow-hidden">
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
              Built by a music teacher,
              <br />
              <span className="bg-gradient-to-r from-teal via-teal-dark to-ink bg-clip-text text-transparent">
                for music teachers
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              LessonLoop was created from 20 years of lived experience in music teaching — 
              not dreamed up in a boardroom.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Lauren's Story */}
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
                  LessonLoop was created by <span className="text-foreground font-medium">Lauren Twilley</span> — a piano teacher who's spent the last 20 years doing what music teachers do best: helping students grow in confidence, skill, and love for music.
                </p>
                <p>
                  But behind the lessons, Lauren also lived the side of teaching that no one talks about enough: the constant admin. The back-and-forth over lesson times. Last-minute changes. Missed messages. Chasing payments. Trying to keep everything organised across multiple students, parents, locations, and policies.
                </p>
                <p>
                  As her teaching grew into something bigger, those challenges grew too. Today, Lauren runs{" "}
                  <a 
                    href="https://ltpmusic.co.uk" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    LTP Music
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  , a thriving music school with around 300 students and a team of around 10 teachers working with her as an agency.
                </p>
                <p className="text-xl font-medium text-foreground">
                  That's when it became crystal clear: most scheduling tools weren't built for the reality of music teaching.
                </p>
                <p>
                  So Lauren did what teachers do when something isn't working. She fixed it.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-8">
                <Link to="/features">
                  <Button size="lg" className="group">
                    See How It Works
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="https://ltpmusic.co.uk" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="group">
                    Visit LTP Music
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative order-1 lg:order-2"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--muted)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted)/0.5)_1px,transparent_1px)] bg-[size:16px_16px] sm:bg-[size:24px_24px] rounded-3xl" />
              
              {/* Founder quote card */}
              <div className="relative bg-gradient-to-br from-teal via-teal-dark to-ink rounded-3xl p-8 lg:p-12 shadow-xl overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-coral/20 rounded-full blur-2xl" />
                
                <div className="relative text-white space-y-6">
                  <Quote className="w-10 h-10 text-white/30" />
                  
                  <p className="text-xl lg:text-2xl font-medium leading-relaxed text-white/90">
                    "Behind the lessons, I lived the side of teaching that no one talks about enough: the constant admin. The back-and-forth. The chasing. I built LessonLoop so other teachers wouldn't have to."
                  </p>
                  
                  <div className="pt-6 border-t border-white/10">
                    <div className="font-semibold text-lg">Lauren Twilley</div>
                    <div className="text-white/60">Founder, LessonLoop</div>
                    <div className="text-white/40 text-sm mt-1">
                      Piano teacher · Founder of{" "}
                      <a href="https://ltpmusic.co.uk" target="_blank" rel="noopener noreferrer" className="text-teal-light hover:underline">
                        LTP Music
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What LessonLoop Solves */}
      <section className="py-20 lg:py-28 bg-muted/30 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block text-sm font-semibold text-primary mb-4">WHAT WE SOLVE</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
              Designed to reduce friction
              <br />and restore flow
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every part of LessonLoop was built from the daily reality of running a music teaching business.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {painPoints.map((point, index) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full p-6 lg:p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <point.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <span className="inline-block text-sm font-semibold text-primary mb-4">OUR MISSION</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-8 leading-tight">
              We believe music teachers shouldn't have to sacrifice their evenings, weekends, or peace of mind just to stay organised.
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              LessonLoop exists to give you back time — so you can focus on what matters most: teaching, inspiring, and building something you're proud of.
            </p>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed mt-6">
              Whether you're a solo teacher looking for calm and structure, or a school owner managing dozens (or hundreds) of students, LessonLoop is here to support you with a platform that genuinely understands the job — because it was built by someone who's lived it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 lg:py-28 bg-muted/30">
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
                <div className="h-full p-6 lg:p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
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

      {/* A Note from Lauren */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="relative p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-ink to-ink-light overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-coral/10 rounded-full blur-2xl" />
              
              <div className="relative">
                <Quote className="w-12 h-12 text-teal-light/30 mb-6" />
                
                <p className="text-xl lg:text-2xl text-white leading-relaxed mb-8">
                  "We believe music teachers shouldn't have to sacrifice their evenings, weekends, or peace of mind just to stay organised. LessonLoop exists to give you back time — so you can focus on what matters most: teaching, inspiring, and building something you're proud of."
                </p>
                
                <div className="flex items-center gap-4 pt-6 border-t border-white/10">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-lg">
                    LT
                  </div>
                  <div>
                    <div className="font-semibold text-white text-lg">Lauren Twilley</div>
                    <div className="text-white/60">Founder · Piano Teacher · 20 Years in Music Education</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-ink via-ink to-ink-light text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-teal/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-coral/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-sm font-semibold text-teal-light mb-4">GET IN TOUCH</span>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 leading-tight">
                Have questions?
                <br />
                <span className="text-white/70">We'd love to hear from you.</span>
              </h2>
              <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
                Whether you're a solo teacher or running a multi-location academy, 
                we're here to help you get started.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
                <Link to="/contact">
                  <Button size="lg" className="bg-teal hover:bg-teal-dark text-white h-14 px-8 text-lg">
                    Get in Touch
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="lg" className="border border-white/30 bg-transparent text-white hover:bg-white/10 h-14 px-8 text-lg">
                    Start Free Trial
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-8 text-white/50">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-teal-light" />
                  <span>hello@lessonloop.net</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-teal-light" />
                  <span>United Kingdom</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-teal-light" />
                  <span>Response within 24 hours</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Welcome Footer */}
      <section className="py-16 lg:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Welcome to LessonLoop.
            </p>
            <p className="text-lg text-muted-foreground">
              Built by a teacher. Built for teachers. Built to help your teaching life run in harmony.
            </p>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
