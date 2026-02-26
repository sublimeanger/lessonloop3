import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, AlertTriangle, CircleAlert, Calendar } from 'lucide-react';
import type { ProactiveAlert } from '@/hooks/useProactiveAlerts';
import { Button } from '@/components/ui/button';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import { useBannerDismissals } from '@/hooks/useBannerDismissals';

const SUGGESTED_PROMPTS = [
  "What's my schedule today?",
  "Show outstanding invoices",
  "How's my completion rate?",
];

function alertIcon(severity: ProactiveAlert['severity']) {
  switch (severity) {
    case 'urgent':
      return <CircleAlert className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />;
    default:
      return <Calendar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />;
  }
}

export function LoopAssistWidget() {
  const [input, setInput] = useState('');
  const { openDrawerWithMessage } = useLoopAssistUI();
  const { alerts } = useProactiveAlerts();
  const { isDismissed } = useBannerDismissals();
  const inputRef = useRef<HTMLInputElement>(null);

  // Show first non-dismissed alert in the widget
  const topAlert = alerts.find(a => !isDismissed(a.type));

  const handleSend = () => {
    if (!input.trim()) return;
    openDrawerWithMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    openDrawerWithMessage(prompt);
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.04] via-transparent to-primary/[0.06]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-body-strong">LoopAssist</span>
            </div>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-micro font-medium text-muted-foreground">
              ⌘J
            </kbd>
          </div>

          {/* Top alert if present */}
          {topAlert && (
            <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-2.5 py-2 sm:px-3 sm:py-2.5 text-body">
              {alertIcon(topAlert.severity)}
              <span className="text-muted-foreground line-clamp-2">{topAlert.message}</span>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your business..."
              className="h-11 text-body bg-background/80"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              aria-label="Send message"
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Suggested prompts — horizontal scroll on mobile, wrap on desktop */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-body font-normal whitespace-nowrap snap-start shrink-0 sm:whitespace-normal sm:shrink"
                onClick={() => handlePromptClick(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
