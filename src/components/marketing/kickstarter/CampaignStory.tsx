import { motion } from "framer-motion";
import { BrowserFrameLight } from "@/components/marketing/BrowserFrame";
import { calendarWeek, invoicesList, parentPortal, loopassistChat } from "@/assets/marketing";
import dashboardHero from "@/assets/marketing/dashboard-hero.png";
import { Music, Users, GraduationCap } from "lucide-react";

const stats = [
  { icon: Music, value: "300+", label: "Students managed" },
  { icon: Users, value: "10", label: "Teachers in the team" },
  { icon: GraduationCap, value: "20", label: "Years teaching" },
];

const acts = [
  {
    title: "The Problem",
    body: "Music teachers everywhere are buried in admin. Spreadsheets for scheduling, manual invoicing, chasing payments by text, and parents who never know when the next lesson is. Lauren Twilley lived this for 20 years — running a piano school of 300 students with notebooks and sheer willpower.",
  },
  {
    title: "The Journey",
    body: "After trying every tool on the market and finding none that truly understood the rhythms of music education, Lauren decided to build one. Not a generic booking app with a music skin — a purpose-built platform designed around how music teachers actually work: term-based billing, recurring weekly slots, make-up credits, and parent portals.",
  },
  {
    title: "The Solution",
    body: "LessonLoop is the result — a beautiful, all-in-one platform that handles scheduling, invoicing, parent communication, and even AI-powered admin assistance. It's built, tested, and ready. Now we need your help to take it to the world.",
  },
];

const screenshots = [
  { src: dashboardHero, alt: "Dashboard overview", url: "app.lessonloop.net/dashboard" },
  { src: calendarWeek, alt: "Weekly calendar", url: "app.lessonloop.net/calendar" },
  { src: invoicesList, alt: "Invoice management", url: "app.lessonloop.net/invoices" },
  { src: parentPortal, alt: "Parent portal", url: "app.lessonloop.net/portal" },
  { src: loopassistChat, alt: "LoopAssist AI", url: "app.lessonloop.net/loopassist" },
];

export function CampaignStory() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Founder intro */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center mb-20"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-light to-teal border-4 border-background shadow-xl flex items-center justify-center text-2xl font-bold text-ink mx-auto mb-6">
            LT
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Our Story
          </h2>
          <p className="text-lg text-muted-foreground">
            From piano teacher to platform builder — a 20-year journey to solve the admin problem in music education.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-20">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <s.icon className="w-6 h-6 text-teal mx-auto mb-2" />
              <div className="text-3xl sm:text-4xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Three acts */}
        <div className="max-w-3xl mx-auto space-y-12 mb-24">
          {acts.map((act, i) => (
            <motion.div
              key={act.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-sm font-bold text-teal uppercase tracking-widest mb-3">
                Act {i + 1}: {act.title}
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">{act.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Product screenshots */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <h3 className="text-2xl font-bold text-foreground text-center mb-10">
            The platform — built and ready
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {screenshots.slice(0, 4).map((shot) => (
              <BrowserFrameLight key={shot.url} url={shot.url}>
                <img src={shot.src} alt={shot.alt} className="w-full" loading="lazy" />
              </BrowserFrameLight>
            ))}
          </div>
          {screenshots[4] && (
            <div className="mt-6 max-w-xl mx-auto">
              <BrowserFrameLight url={screenshots[4].url}>
                <img src={screenshots[4].src} alt={screenshots[4].alt} className="w-full" loading="lazy" />
              </BrowserFrameLight>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
