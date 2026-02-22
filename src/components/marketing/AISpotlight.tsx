import { motion } from "framer-motion";
import { Sparkles, Shield, Lock, Bot } from "lucide-react";

const chatMessages = [
  { role: "user" as const, text: "Who has overdue invoices?" },
  {
    role: "assistant" as const,
    text: "3 parents have overdue invoices totalling £285. Want me to send reminders?",
  },
];

const actionItems = [
  { name: "Rachel Thompson", amount: "£120.00" },
  { name: "James Whitfield", amount: "£90.00" },
  { name: "Priya Patel", amount: "£75.00" },
];

const queryChips = [
  "What's my revenue this term?",
  "Draft a cancellation policy email",
  "Who cancelled lessons this week?",
  "Schedule a make-up for Oliver",
];

const features = [
  { icon: Shield, text: "Every action requires your confirmation" },
  { icon: Sparkles, text: "Included on every plan — no add-on fees" },
  { icon: Lock, text: "Your data never leaves your account" },
];

export function AISpotlight() {
  return (
    <section className="py-24 lg:py-32 bg-ink relative overflow-hidden">
      {/* Subtle gradient orbs */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--teal) / 0.4) 0%, transparent 70%)", filter: "blur(80px)" }}
      />
      <div
        className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--coral) / 0.3) 0%, transparent 70%)", filter: "blur(80px)" }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            <span className="text-white">Meet LoopAssist.</span>
            <br />
            <span className="text-white/60">Your AI co-pilot.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Ask questions in plain English. Get instant answers about your schedule, finances, and students. Then let it take action — with your approval.
          </p>
        </motion.div>

        {/* Two columns */}
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          {/* Left — Chat demo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">LoopAssist</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-white/40 text-xs">Online</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.3, duration: 0.4 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-teal/20 text-white rounded-br-md"
                          : "bg-white/10 text-white/90 rounded-bl-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}

                {/* Action proposal card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.9, duration: 0.4 }}
                  className="bg-coral/5 border border-coral/30 rounded-xl p-4"
                >
                  <div className="text-white text-sm font-semibold mb-3">
                    Send payment reminders
                  </div>
                  <div className="space-y-2 mb-4">
                    {actionItems.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="text-white/70">{item.name}</span>
                        <span className="text-coral font-medium">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-1.5 rounded-lg bg-coral text-white text-xs font-semibold cursor-default">
                      Confirm &amp; Send
                    </div>
                    <div className="px-4 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs font-medium cursor-default">
                      Cancel
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Right — Chips + features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Query chips */}
            <p className="text-white/40 text-sm mb-4">Try asking:</p>
            <div className="flex flex-wrap gap-2 mb-10">
              {queryChips.map((chip, i) => (
                <motion.span
                  key={chip}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm"
                >
                  {chip}
                </motion.span>
              ))}
            </div>

            {/* Key features */}
            <div className="space-y-5">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.text}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <feat.icon className="w-4 h-4 text-white/70" />
                  </div>
                  <span className="text-white/70 text-sm">{feat.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom statement */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-white/40 text-sm mt-16"
        >
          No competitors offer an AI assistant. LoopAssist is unique to LessonLoop.
        </motion.p>
      </div>
    </section>
  );
}
