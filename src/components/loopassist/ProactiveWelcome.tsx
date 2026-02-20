import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, X } from 'lucide-react';

interface ProactiveWelcomeProps {
  title: string;
  message: string;
  suggestedPrompts: string[];
  onPromptClick: (prompt: string) => void;
  onDismiss: () => void;
}

export function ProactiveWelcome({
  title,
  message,
  suggestedPrompts,
  onPromptClick,
  onDismiss,
}: ProactiveWelcomeProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal text-left text-xs"
              onClick={() => onPromptClick(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
