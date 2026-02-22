import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const chatMessages = [
  {
    role: "user" as const,
    text: "Who has overdue invoices?",
  },
  {
    role: "assistant" as const,
    text: "You have **3 overdue invoices** totalling **£435.00**:\n\n• Emma Wilson — £150 (14 days overdue)\n• James Chen — £180 (7 days overdue)\n• Sophie Taylor — £105 (3 days overdue)",
  },
];

const actionCard = {
  title: "Send payment reminders",
  description: "Email all 3 guardians with overdue invoice details",
  status: "Awaiting your approval",
};

const exampleQueries = [
  "What's my revenue this term?",
  "Draft a cancellation policy email",
  "Who cancelled lessons this week?",
  "Schedule a make-up for Oliver",
];

export function AISpotlight() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [showAction, setShowAction] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // Show user message
    const t1 = setTimeout(() => setVisibleMessages(1), 600);
    // Typing indicator
    const t2 = setTimeout(() => setTyping(true), 1400);
    // Show assistant message
    const t3 = setTimeout(() => {
      setTyping(false);
      setVisibleMessages(2);
    }, 2800);
    // Show action card
    const t4 = setTimeout(() => setShowAction(true), 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <section className="py-24 lg:py-32 bg-ink relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-teal/8 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-t from-coral/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <Badge className="mb-6 bg-white/10 text-teal-light border-white/10 hover:bg-white/10">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            AI-Powered
          </Badge>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Meet LoopAssist. Your AI co-pilot.
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Ask questions in plain English. Get instant answers about your schedule, finances, and students.
            Then let it take action — with your approval.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start max-w-6xl mx-auto">
          {/* Left: Chat demo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl"
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">LoopAssist</p>
                <p className="text-xs text-white/40">AI Assistant</p>
              </div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 min-h-[320px]">
              <AnimatePresence>
                {visibleMessages >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end"
                  >
                    <div className="bg-teal/20 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm max-w-[80%]">
                      {chatMessages[0].text}
                    </div>
                  </motion.div>
                )}

                {typing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-1.5 px-4 py-3"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-white/30"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </motion.div>
                )}

                {visibleMessages >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white/10 text-white/90 rounded-2xl rounded-tl-md px-4 py-3 text-sm max-w-[85%] leading-relaxed">
                      <p className="mb-2">You have <strong>3 overdue invoices</strong> totalling <strong>£435.00</strong>:</p>
                      <ul className="space-y-1 text-white/70 text-xs">
                        <li>• Emma Wilson — £150 (14 days overdue)</li>
                        <li>• James Chen — £180 (7 days overdue)</li>
                        <li>• Sophie Taylor — £105 (3 days overdue)</li>
                      </ul>
                    </div>
                  </motion.div>
                )}

                {showAction && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div className="border border-teal/30 rounded-xl bg-teal/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Send className="w-4 h-4 text-teal-light" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{actionCard.title}</p>
                          <p className="text-xs text-white/50 mt-0.5">{actionCard.description}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <button className="px-3 py-1.5 rounded-lg bg-teal text-white text-xs font-semibold cursor-default">
                              Approve & Send
                            </button>
                            <button className="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs cursor-default">
                              Dismiss
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <ShieldCheck className="w-3 h-3 text-teal-light" />
                            <span className="text-[10px] text-white/40">{actionCard.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input bar */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <MessageSquare className="w-4 h-4 text-white/30 shrink-0" />
                <span className="text-sm text-white/30">Ask LoopAssist anything…</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Example queries + trust */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-8"
          >
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Try asking…</h3>
              <p className="text-sm text-white/50 mb-5">
                LoopAssist understands your data. Just ask in plain English.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {exampleQueries.map((query, i) => (
                  <motion.span
                    key={query}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white/80 hover:bg-white/10 hover:border-white/20 transition-colors cursor-default"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-light shrink-0" />
                    {query}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Trust block */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-5 h-5 text-teal-light" />
                <h4 className="text-sm font-semibold text-white">You stay in control</h4>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                LoopAssist never takes action without your explicit approval.
                Every proposed action shows a confirmation step — review, approve, or dismiss.
                Your data, your rules.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-white/40 mt-14"
        >
          LoopAssist is included on every plan — no add-on fees.
        </motion.p>
      </div>
    </section>
  );
}
