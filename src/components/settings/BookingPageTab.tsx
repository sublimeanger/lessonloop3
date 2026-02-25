import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe,
  Palette,
  Clock,
  Users,
  Music,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Code,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrg } from '@/contexts/OrgContext';
import { useTeachers } from '@/hooks/useTeachers';
import { useInstruments } from '@/hooks/useInstruments';
import {
  useBookingPageConfig,
  useUpdateBookingPage,
  useBookingPageTeachers,
  useBookingPageInstruments,
  type BookingPageUpsertData,
} from '@/hooks/useBookingPage';

// ─── Slug validation ─────────────────────────────────────

function sanitiseSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}

// ─── Component ───────────────────────────────────────────

export function BookingPageTab() {
  const { currentOrg } = useOrg();
  const { data: config, isLoading: configLoading } = useBookingPageConfig();
  const { data: teachers = [] } = useTeachers();
  const { data: instruments = [] } = useInstruments();
  const updateMutation = useUpdateBookingPage();
  const teachersMutation = useBookingPageTeachers();
  const instrumentsMutation = useBookingPageInstruments();

  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === 'active'), [teachers]);
  // Show custom instruments for this org + global/common instruments
  const orgInstruments = useMemo(
    () => instruments.filter((i) => i.org_id === currentOrg?.id || !i.org_id),
    [instruments, currentOrg?.id],
  );

  // ─── Form state ────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [lessonDuration, setLessonDuration] = useState('30');
  const [advanceBookingDays, setAdvanceBookingDays] = useState('28');
  const [minNoticeHours, setMinNoticeHours] = useState('24');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [requirePhone, setRequirePhone] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // ─── Hydrate from config ───────────────────────────────
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setSlug(config.slug);
      setTitle(config.title || '');
      setDescription(config.description || '');
      setWelcomeMessage(config.welcome_message || '');
      setAccentColor(config.accent_color || '#6366f1');
      setLessonDuration(String(config.lesson_duration_mins));
      setAdvanceBookingDays(String(config.advance_booking_days));
      setMinNoticeHours(String(config.min_notice_hours));
      setBufferMinutes(String(config.buffer_minutes));
      setRequirePhone(config.require_phone);
      setConfirmationMessage(config.confirmation_message || '');
      setSelectedTeacherIds(config.booking_page_teachers.map((t) => t.teacher_id));
      setSelectedInstrumentIds(config.booking_page_instruments.map((i) => i.instrument_id));
    } else if (!configLoading && currentOrg) {
      // Default slug from org name
      setSlug(sanitiseSlug(currentOrg.name));
    }
  }, [config, configLoading, currentOrg]);

  // ─── Derived ───────────────────────────────────────────
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.lessonloop.com';
  const bookingUrl = `${baseUrl}/book/${slug}`;
  const slugValid = isValidSlug(slug);
  const isSaving = updateMutation.isPending || teachersMutation.isPending || instrumentsMutation.isPending;

  const embedSnippet = `<script src="${baseUrl}/embed.js" data-slug="${slug}"></script>`;

  // ─── Handlers ──────────────────────────────────────────

  function toggleTeacher(teacherId: string) {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId],
    );
  }

  function toggleInstrument(instrumentId: string) {
    setSelectedInstrumentIds((prev) =>
      prev.includes(instrumentId) ? prev.filter((id) => id !== instrumentId) : [...prev, instrumentId],
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!currentOrg) return;
    if (!slugValid) return;

    const payload: BookingPageUpsertData & { id?: string } = {
      id: config?.id,
      slug,
      enabled,
      title: title || null,
      description: description || null,
      welcome_message: welcomeMessage || null,
      accent_color: accentColor || null,
      lesson_duration_mins: Number(lessonDuration),
      advance_booking_days: Number(advanceBookingDays),
      min_notice_hours: Number(minNoticeHours),
      buffer_minutes: Number(bufferMinutes),
      require_phone: requirePhone,
      confirmation_message: confirmationMessage || null,
    };

    const result = await updateMutation.mutateAsync(payload);
    const pageId = result?.id || config?.id;

    if (pageId) {
      await Promise.all([
        teachersMutation.mutateAsync({ bookingPageId: pageId, teacherIds: selectedTeacherIds }),
        instrumentsMutation.mutateAsync({ bookingPageId: pageId, instrumentIds: selectedInstrumentIds }),
      ]);
    }
  }

  // ─── Loading ───────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Enable / Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Public Booking Page</CardTitle>
          </div>
          <CardDescription>
            Allow parents and prospective students to book trial lessons online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="booking-enabled" className="text-sm font-medium">
                Enable booking page
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, your booking page will be publicly accessible
              </p>
            </div>
            <Switch
              id="booking-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && slug && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{bookingUrl}</span>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto shrink-0"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* URL Slug */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URL Slug</CardTitle>
          <CardDescription>
            Choose a memorable URL for your booking page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{baseUrl}/book/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(sanitiseSlug(e.target.value))}
              placeholder="my-music-studio"
              className={cn('max-w-xs', !slugValid && slug.length > 0 && 'border-destructive')}
            />
          </div>
          {!slugValid && slug.length > 0 && (
            <p className="text-xs text-destructive">
              Slug must be 3-60 characters, lowercase letters, numbers, and hyphens only.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Branding</CardTitle>
          </div>
          <CardDescription>
            Customise how your booking page looks to visitors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bp-title">Page title</Label>
            <Input
              id="bp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={currentOrg?.name || 'My Music Studio'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-description">Description</Label>
            <Textarea
              id="bp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="We offer private and group music lessons for all ages and abilities."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-welcome">Welcome message</Label>
            <Textarea
              id="bp-welcome"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Welcome! We'd love to help you start your musical journey."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-accent">Accent colour</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="bp-accent"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-input p-1"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="max-w-[120px] font-mono text-sm"
                maxLength={7}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Booking Rules</CardTitle>
          </div>
          <CardDescription>
            Configure lesson duration, availability windows, and requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-duration">Lesson duration</Label>
              <Select value={lessonDuration} onValueChange={setLessonDuration}>
                <SelectTrigger id="bp-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bp-advance-days">Advance booking window</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bp-advance-days"
                  type="number"
                  min={1}
                  max={90}
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(e.target.value)}
                  className="max-w-[80px]"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bp-notice-hours">Minimum notice</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bp-notice-hours"
                  type="number"
                  min={0}
                  max={72}
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(e.target.value)}
                  className="max-w-[80px]"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bp-buffer">Buffer between lessons</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bp-buffer"
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(e.target.value)}
                  className="max-w-[80px]"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t">
            <div className="space-y-0.5">
              <Label htmlFor="bp-require-phone" className="text-sm font-medium">
                Require phone number
              </Label>
              <p className="text-xs text-muted-foreground">
                Ask parents to provide a phone number when booking
              </p>
            </div>
            <Switch
              id="bp-require-phone"
              checked={requirePhone}
              onCheckedChange={setRequirePhone}
            />
          </div>
        </CardContent>
      </Card>

      {/* Teachers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Teachers</CardTitle>
          </div>
          <CardDescription>
            Select which teachers are available for booking on the public page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No active teachers found. Add teachers in the Teachers section first.
            </p>
          ) : (
            <div className="space-y-2">
              {activeTeachers.map((teacher) => (
                <label
                  key={teacher.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedTeacherIds.includes(teacher.id)}
                    onCheckedChange={() => toggleTeacher(teacher.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{teacher.display_name}</span>
                    {teacher.instruments.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({teacher.instruments.join(', ')})
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Instruments</CardTitle>
          </div>
          <CardDescription>
            Select which instruments parents can choose from when booking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgInstruments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No instruments configured. Add instruments in Music settings.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {orgInstruments.map((instrument) => (
                <label
                  key={instrument.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedInstrumentIds.includes(instrument.id)}
                    onCheckedChange={() => toggleInstrument(instrument.id)}
                  />
                  <span className="text-sm">{instrument.name}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Confirmation Message</CardTitle>
          </div>
          <CardDescription>
            Displayed to parents after they submit a booking request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={confirmationMessage}
            onChange={(e) => setConfirmationMessage(e.target.value)}
            placeholder="Thank you for your booking request! We'll review it and get back to you within 24 hours to confirm your lesson time."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Embed Code */}
      {config?.id && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Embed Widget</CardTitle>
            </div>
            <CardDescription>
              Add this code to your website to show a floating "Book a Trial Lesson" button
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <pre className="rounded-lg border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {embedSnippet}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this snippet just before the closing <code>&lt;/body&gt;</code> tag on any page of your website.
              The widget will display a floating button that opens your booking page in an overlay.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2 pb-8">
        <Button
          onClick={handleSave}
          disabled={isSaving || !slugValid}
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Booking Page'
          )}
        </Button>
      </div>
    </div>
  );
}
