import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  "What's my schedule today?",
  "Show outstanding invoices",
  "How's my completion rate?",
];

export function LoopAssistWidget() {
  const [input, setInput] = useState('');
  const { openDrawerWithMessage } = useLoopAssistUI();
  const { alerts } = useProactiveAlerts();
  const inputRef = useRef<HTMLInputElement>(null);

  const topAlert = alerts[0];

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
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium">LoopAssist</span>
            </div>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ⌘J
            </kbd>
          </div>

          {/* Top alert if present */}
          {topAlert && (
            <div className="flex items-start gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
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
              className="h-8 text-sm bg-background/80"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Suggested prompts */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Badge
                key={prompt}
                variant="secondary"
                className="cursor-pointer text-[11px] font-normal hover:bg-accent transition-colors"
                onClick={() => handlePromptClick(prompt)}
              >
                {prompt}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
