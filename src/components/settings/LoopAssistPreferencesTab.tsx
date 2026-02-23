import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { FeatureGate } from '@/components/subscription/FeatureGate';

interface AiPreferences {
  term_name?: string;
  billing_cycle?: string;
  tone?: string;
  progress_report_style?: string;
  custom_instructions?: string;
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly & casual' },
  { value: 'encouraging', label: 'Encouraging & warm' },
];

export function LoopAssistPreferencesTab() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['ai-preferences', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('ai_preferences')
        .eq('id', currentOrg!.id)
        .single();
      if (error) throw error;
      return (data?.ai_preferences as AiPreferences) || {};
    },
    enabled: !!currentOrg?.id,
  });

  const [termName, setTermName] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [tone, setTone] = useState('friendly');
  const [progressStyle, setProgressStyle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  useEffect(() => {
    if (prefs) {
      setTermName(prefs.term_name || '');
      setBillingCycle(prefs.billing_cycle || '');
      setTone(prefs.tone || 'friendly');
      setProgressStyle(prefs.progress_report_style || '');
      setCustomInstructions(prefs.custom_instructions || '');
    }
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const aiPreferences: AiPreferences = {};
      if (termName.trim()) aiPreferences.term_name = termName.trim();
      if (billingCycle.trim()) aiPreferences.billing_cycle = billingCycle.trim();
      if (tone) aiPreferences.tone = tone;
      if (progressStyle.trim()) aiPreferences.progress_report_style = progressStyle.trim();
      if (customInstructions.trim()) aiPreferences.custom_instructions = customInstructions.trim().slice(0, 500);

      const { error } = await supabase
        .from('organisations')
        .update({ ai_preferences: aiPreferences } as any)
        .eq('id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-preferences', currentOrg?.id] });
      toast({ title: 'Preferences saved', description: 'LoopAssist will use your updated preferences.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <FeatureGate feature="loop_assist">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            LoopAssist Preferences
          </CardTitle>
          <CardDescription>
            Customise how LoopAssist communicates and understands your academy's terminology
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="termName">Term name</Label>
              <Input
                id="termName"
                placeholder="e.g. semester, half-term, period"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                disabled={!isOrgAdmin}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">What your academy calls its teaching periods</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCycle">Billing cycle</Label>
              <Input
                id="billingCycle"
                placeholder="e.g. 1st of each month, 15th to 14th"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                disabled={!isOrgAdmin}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">Helps LoopAssist explain billing accurately</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone} disabled={!isOrgAdmin}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">How LoopAssist should sound when drafting messages</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="progressStyle">Progress report style</Label>
            <Textarea
              id="progressStyle"
              placeholder="e.g. Always mention the student's instrument. Focus on effort not just results. Include practice stats."
              value={progressStyle}
              onChange={(e) => setProgressStyle(e.target.value)}
              disabled={!isOrgAdmin}
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">Guidelines for how LoopAssist summarises student progress</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions">Custom instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="e.g. We call our locations 'studios' not 'rooms'. Always sign off emails as 'The [Academy Name] Team'."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              disabled={!isOrgAdmin}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-between">
              <p className="text-xs text-muted-foreground">Any extra rules LoopAssist should follow</p>
              <p className="text-xs text-muted-foreground">{customInstructions.length}/500</p>
            </div>
          </div>

          {isOrgAdmin && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Preferences
            </Button>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
