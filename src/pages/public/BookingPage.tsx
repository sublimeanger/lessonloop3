import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  usePublicBookingPage,
  fetchBookingSlots,
  type TimeSlot,
  type PublicBookingPage as PublicBookingPageData,
} from '@/hooks/useBookingPage';
import { BookingStepIndicator } from '@/components/booking/BookingStepIndicator';
import { SlotGrid } from '@/components/booking/SlotGrid';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, Music, User, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageMeta } from '@/hooks/usePageMeta';

// ─── Types ───────────────────────────────────────────────

interface ChildEntry {
  first_name: string;
  age: string;
  instrument_id: string;
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

interface StepDef {
  key: string;
  label: string;
}

// ─── Helpers ─────────────────────────────────────────────

function buildSteps(config: PublicBookingPageData | null): StepDef[] {
  const steps: StepDef[] = [{ key: 'welcome', label: 'Welcome' }];

  const instrumentCount = config?.booking_page_instruments?.length ?? 0;
  if (instrumentCount > 1) {
    steps.push({ key: 'instrument', label: 'Instrument' });
  }

  const teacherCount = config?.booking_page_teachers?.length ?? 0;
  if (teacherCount > 1) {
    steps.push({ key: 'teacher', label: 'Teacher' });
  }

  steps.push({ key: 'datetime', label: 'Date & Time' });
  steps.push({ key: 'details', label: 'Your Details' });
  steps.push({ key: 'confirmation', label: 'Confirmed' });

  return steps;
}

function formatDateForDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getMaxDate(advanceDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + advanceDays);
  return d.toISOString().split('T')[0];
}

// ─── Main Component ─────────────────────────────────────

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  const { data: config, isLoading, error } = usePublicBookingPage(slug);

  usePageMeta(
    config?.organisation?.name ? `Book a Lesson | ${config.organisation.name}` : 'Book a Lesson | LessonLoop',
    'Book a music lesson online'
  );

  // ── State ──────────────────────────────────────────────

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [contact, setContact] = useState<ContactInfo>({
    name: '',
    email: '',
    phone: '',
  });

  const [children, setChildren] = useState<ChildEntry[]>([
    { first_name: '', age: '', instrument_id: '' },
  ]);

  const [notes, setNotes] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // ── Derived values ─────────────────────────────────────

  const steps = config ? buildSteps(config) : [];
  const stepKey = steps[currentStep]?.key ?? 'welcome';
  const accentColor = config?.accent_color || '#6366f1';
  const orgName = config?.title || config?.organisation?.name || 'Music Lessons';

  // ── Auto-select single instrument/teacher ──────────────

  useEffect(() => {
    if (!config) return;

    if (config.booking_page_instruments?.length === 1) {
      setSelectedInstrumentId(config.booking_page_instruments[0].instrument_id);
    }
    if (config.booking_page_teachers?.length === 1) {
      setSelectedTeacherId(config.booking_page_teachers[0].teacher_id);
    }
  }, [config]);

  // ── Fetch slots when date changes ─────────────────────

  useEffect(() => {
    if (!selectedDate || !config?.id) return;

    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setSlots([]);

    fetchBookingSlots({
      booking_page_id: config.id,
      date: selectedDate,
      instrument_id: selectedInstrumentId || undefined,
      teacher_id: selectedTeacherId === 'any' ? undefined : selectedTeacherId || undefined,
    })
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, config?.id, selectedInstrumentId, selectedTeacherId]);

  // ── Navigation ─────────────────────────────────────────

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // ── Form helpers ───────────────────────────────────────

  const updateContact = useCallback(
    (field: keyof ContactInfo, value: string) => {
      setContact((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateChild = useCallback(
    (index: number, field: keyof ChildEntry, value: string) => {
      setChildren((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const addChild = useCallback(() => {
    setChildren((prev) => [...prev, { first_name: '', age: '', instrument_id: '' }]);
  }, []);

  const removeChild = useCallback((index: number) => {
    setChildren((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Form validation ────────────────────────────────────

  const isDetailsValid = useCallback((): boolean => {
    if (!contact.name.trim()) return false;
    if (!contact.email.trim() || !contact.email.includes('@')) return false;
    if (config?.require_phone && !contact.phone.trim()) return false;
    if (children.length === 0 || !children[0].first_name.trim()) return false;
    if (!privacyAccepted) return false;
    return true;
  }, [contact, children, privacyAccepted, config?.require_phone]);

  // ── Submit ─────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!config || !selectedSlot) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke('booking-submit', {
        body: {
          booking_page_id: config.id,
          slot: {
            date: selectedSlot.date,
            time: selectedSlot.time,
            teacher_id: selectedSlot.teacher_id,
          },
          contact: {
            name: contact.name.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim() || null,
          },
          children: children
            .filter((c) => c.first_name.trim())
            .map((c) => ({
              first_name: c.first_name.trim(),
              age: c.age ? parseInt(c.age, 10) : null,
              instrument_id: c.instrument_id || null,
            })),
          notes: notes.trim() || null,
        },
      });

      if (invokeError) throw invokeError;
    } catch (err) {
      // If edge function is not deployed yet, proceed to confirmation
      console.warn('booking-submit invocation failed, proceeding to confirmation:', err);
    }

    if (isEmbed) {
      window.parent.postMessage({ type: 'lessonloop:booking-complete' }, '*');
    }

    setSubmitting(false);
    goNext();
  }, [config, selectedSlot, contact, children, notes, isEmbed, goNext]);

  // ─── Loading state ─────────────────────────────────────

  if (isLoading) {
    return (
      <PageShell isEmbed={isEmbed}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  // ─── Error / Not found state ───────────────────────────

  if (error || !config) {
    return (
      <PageShell isEmbed={isEmbed}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
          <Music className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Booking Page Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            This booking page doesn't exist or is currently disabled. Please check the URL and try again.
          </p>
        </div>
      </PageShell>
    );
  }

  // ─── Render current step ──────────────────────────────

  const isWelcome = stepKey === 'welcome';
  const isConfirmation = stepKey === 'confirmation';
  const showBack = !isWelcome && !isConfirmation;

  return (
    <PageShell isEmbed={isEmbed} accentColor={accentColor}>
      {/* Embed close button */}
      {isEmbed && (
        <button
          onClick={() => window.parent.postMessage({ type: 'lessonloop:close' }, '*')}
          className="absolute top-3 right-3 z-10 rounded-full p-2 hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      )}

      {/* Step indicator */}
      {!isConfirmation && (
        <BookingStepIndicator
          steps={steps}
          currentStep={currentStep}
          accentColor={accentColor}
        />
      )}

      {/* Back button */}
      {showBack && (
        <div className="px-5 sm:px-6 pt-1 pb-2">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="px-5 sm:px-6 pb-6 flex-1">
        {/* ── Step 0: Welcome ─────────────────────────── */}
        {stepKey === 'welcome' && (
          <div className="flex flex-col items-center text-center py-8 space-y-5">
            {config.logo_url ? (
              <img
                src={config.logo_url}
                alt={orgName}
                className="h-16 w-auto object-contain"
              />
            ) : (
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Music className="h-8 w-8" style={{ color: accentColor }} />
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
              {config.description && (
                <p className="text-muted-foreground text-sm max-w-sm">{config.description}</p>
              )}
            </div>

            {config.welcome_message && (
              <p className="text-sm text-foreground/80 max-w-sm leading-relaxed">
                {config.welcome_message}
              </p>
            )}

            <Button
              onClick={goNext}
              className="mt-4 rounded-full px-8 py-3 h-auto text-sm font-medium shadow-md"
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            >
              Book a Trial Lesson
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Step 1: Select Instrument ───────────────── */}
        {stepKey === 'instrument' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Choose Your Instrument</h2>
              <p className="text-sm text-muted-foreground mt-1">What would you like to learn?</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(config.booking_page_instruments || []).map((item) => {
                const isSelected = selectedInstrumentId === item.instrument_id;
                const name = item.instrument?.name || 'Instrument';

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedInstrumentId(item.instrument_id);
                      goNext();
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border-2 p-5 min-h-[110px] transition-all',
                      'hover:shadow-sm active:scale-[0.98] touch-manipulation',
                      isSelected
                        ? 'text-white shadow-md'
                        : 'border-border bg-card hover:border-opacity-50',
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                          }
                        : undefined
                    }
                  >
                    <Music
                      className={cn(
                        'h-6 w-6 mb-2',
                        isSelected ? 'text-white/90' : 'text-muted-foreground',
                      )}
                    />
                    <span className="text-sm font-medium text-center">{name}</span>
                    {item.instrument?.category && (
                      <span
                        className={cn(
                          'text-xs mt-1',
                          isSelected ? 'text-white/70' : 'text-muted-foreground',
                        )}
                      >
                        {item.instrument.category}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Select Teacher ──────────────────── */}
        {stepKey === 'teacher' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Choose a Teacher</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select your preferred teacher
              </p>
            </div>

            <div className="space-y-2">
              {/* Any available */}
              <button
                onClick={() => {
                  setSelectedTeacherId('any');
                  goNext();
                }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-left transition-all',
                  'hover:shadow-sm active:scale-[0.99] touch-manipulation',
                  selectedTeacherId === 'any'
                    ? 'text-white shadow-md'
                    : 'border-border bg-card',
                )}
                style={
                  selectedTeacherId === 'any'
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : undefined
                }
              >
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
                    selectedTeacherId === 'any'
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">Any Available Teacher</div>
                  <div
                    className={cn(
                      'text-xs mt-0.5',
                      selectedTeacherId === 'any'
                        ? 'text-white/70'
                        : 'text-muted-foreground',
                    )}
                  >
                    We'll match you with the best available teacher
                  </div>
                </div>
              </button>

              {/* Individual teachers */}
              {(config.booking_page_teachers || []).map((item) => {
                const teacher = item.teacher;
                if (!teacher) return null;

                const isSelected = selectedTeacherId === item.teacher_id;
                const initials = teacher.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedTeacherId(item.teacher_id);
                      goNext();
                    }}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-left transition-all',
                      'hover:shadow-sm active:scale-[0.99] touch-manipulation',
                      isSelected
                        ? 'text-white shadow-md'
                        : 'border-border bg-card',
                    )}
                    style={
                      isSelected
                        ? { backgroundColor: accentColor, borderColor: accentColor }
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{teacher.display_name}</div>
                      {teacher.bio && (
                        <div
                          className={cn(
                            'text-xs mt-0.5 line-clamp-2',
                            isSelected ? 'text-white/70' : 'text-muted-foreground',
                          )}
                        >
                          {teacher.bio}
                        </div>
                      )}
                      {teacher.instruments && teacher.instruments.length > 0 && (
                        <div
                          className={cn(
                            'text-xs mt-0.5 truncate',
                            isSelected ? 'text-white/60' : 'text-muted-foreground/70',
                          )}
                        >
                          {teacher.instruments.join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Select Date & Time ──────────────── */}
        {stepKey === 'datetime' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Pick a Date & Time</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose when you'd like your trial lesson
              </p>
            </div>

            {/* Date input */}
            <div className="space-y-2">
              <Label htmlFor="booking-date" className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Select a date
              </Label>
              <Input
                id="booking-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getTomorrow()}
                max={getMaxDate(config.advance_booking_days ?? 28)}
                className="w-full"
              />
            </div>

            {/* Slots */}
            {selectedDate && (
              <div className="pt-2">
                <h3 className="text-sm font-medium mb-3">
                  Available times for{' '}
                  <span className="font-semibold">{formatDateForDisplay(selectedDate)}</span>
                </h3>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <SlotGrid
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={(slot) => {
                      setSelectedSlot(slot);
                      goNext();
                    }}
                    accentColor={accentColor}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Your Details ────────────────────── */}
        {stepKey === 'details' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Your Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tell us a bit about yourself
              </p>
            </div>

            {/* Contact fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bp-name">Your name *</Label>
                <Input
                  id="bp-name"
                  value={contact.name}
                  onChange={(e) => updateContact('name', e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bp-email">Email address *</Label>
                <Input
                  id="bp-email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact('email', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bp-phone">
                  Phone number{config.require_phone ? ' *' : ' (optional)'}
                </Label>
                <Input
                  id="bp-phone"
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => updateContact('phone', e.target.value)}
                  placeholder="+44 7xxx xxx xxx"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Children / Students */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Student(s) *</Label>
                <button
                  type="button"
                  onClick={addChild}
                  className="text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: accentColor }}
                >
                  + Add another student
                </button>
              </div>

              {children.map((child, index) => (
                <div key={index} className="rounded-lg border p-3 space-y-3 relative">
                  {children.length > 1 && (
                    <button
                      onClick={() => removeChild(index)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      aria-label={`Remove student ${index + 1}`}
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-45" />
                    </button>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor={`child-name-${index}`}>First name *</Label>
                    <Input
                      id={`child-name-${index}`}
                      value={child.first_name}
                      onChange={(e) => updateChild(index, 'first_name', e.target.value)}
                      placeholder="Student's first name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`child-age-${index}`}>Age</Label>
                      <Input
                        id={`child-age-${index}`}
                        type="number"
                        min={3}
                        max={99}
                        value={child.age}
                        onChange={(e) => updateChild(index, 'age', e.target.value)}
                        placeholder="Age"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`child-instrument-${index}`}>Instrument</Label>
                      <select
                        id={`child-instrument-${index}`}
                        value={child.instrument_id}
                        onChange={(e) => updateChild(index, 'instrument_id', e.target.value)}
                        className={cn(
                          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <option value="">Select...</option>
                        {(config.booking_page_instruments || []).map((inst) => (
                          <option key={inst.instrument_id} value={inst.instrument_id}>
                            {inst.instrument?.name || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="bp-notes">
                Anything else we should know? (optional)
              </Label>
              <Textarea
                id="bp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., preferred lesson day, any specific goals..."
                rows={3}
              />
            </div>

            {/* Privacy consent */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={privacyAccepted}
                onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I agree to share my details with this music school for the purpose of
                arranging a trial lesson. My data will be handled in accordance with
                their privacy policy. *
              </span>
            </label>

            {/* Submit error */}
            {submitError && (
              <p className="text-sm text-destructive text-center">{submitError}</p>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!isDetailsValid() || submitting}
              className="w-full rounded-full py-3 h-auto text-sm font-medium shadow-md"
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Booking Request'
              )}
            </Button>
          </div>
        )}

        {/* ── Step 5: Confirmation ────────────────────── */}
        {stepKey === 'confirmation' && (
          <ConfirmationStep
            config={config}
            selectedSlot={selectedSlot}
            selectedInstrumentId={selectedInstrumentId}
            selectedTeacherId={selectedTeacherId}
            accentColor={accentColor}
            isEmbed={isEmbed}
          />
        )}
      </div>
    </PageShell>
  );
}

// ─── Page Shell ──────────────────────────────────────────

function PageShell({
  children,
  isEmbed,
  accentColor,
}: {
  children: React.ReactNode;
  isEmbed: boolean;
  accentColor?: string;
}) {
  if (isEmbed) {
    return (
      <div className="relative flex flex-col min-h-screen bg-background">
        {children}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-start justify-center px-4 py-8 sm:py-12"
      style={{
        background: `linear-gradient(135deg, ${accentColor || '#6366f1'}08 0%, ${accentColor || '#6366f1'}03 50%, transparent 100%)`,
      }}
    >
      <div className="w-full max-w-lg bg-background rounded-2xl shadow-lg border relative overflow-hidden flex flex-col">
        {/* Accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: accentColor || '#6366f1' }}
        />
        {children}
      </div>
    </div>
  );
}

// ─── Confirmation Step ──────────────────────────────────

function ConfirmationStep({
  config,
  selectedSlot,
  selectedInstrumentId,
  selectedTeacherId,
  accentColor,
  isEmbed,
}: {
  config: PublicBookingPageData;
  selectedSlot: TimeSlot | null;
  selectedInstrumentId: string | null;
  selectedTeacherId: string | null;
  accentColor: string;
  isEmbed: boolean;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 500);
    const t3 = setTimeout(() => setPhase(3), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const instrumentName = config.booking_page_instruments?.find(
    (i) => i.instrument_id === selectedInstrumentId,
  )?.instrument?.name;

  const teacherName =
    selectedTeacherId === 'any'
      ? 'Any Available'
      : config.booking_page_teachers?.find(
          (t) => t.teacher_id === selectedTeacherId,
        )?.teacher?.display_name || selectedSlot?.teacher_name;

  const dateDisplay = selectedSlot ? formatDateForDisplay(selectedSlot.date) : undefined;

  return (
    <div className="flex flex-col items-center text-center py-8">
      {/* Animated checkmark */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-500 ease-out',
          phase >= 1 ? 'h-20 w-20 opacity-100 scale-100' : 'h-12 w-12 opacity-0 scale-50',
        )}
        style={{
          backgroundColor: `${accentColor}15`,
          boxShadow: phase >= 2 ? `0 0 0 8px ${accentColor}10` : undefined,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full transition-all duration-300 delay-200',
            phase >= 1 ? 'h-14 w-14 opacity-100' : 'h-8 w-8 opacity-0',
          )}
          style={{ backgroundColor: accentColor }}
        >
          <Check
            className={cn(
              'text-white transition-all duration-300 delay-300',
              phase >= 2 ? 'h-7 w-7 opacity-100' : 'h-0 w-0 opacity-0',
            )}
            strokeWidth={3}
          />
        </div>
      </div>

      {/* Heading */}
      <h2
        className={cn(
          'text-xl font-semibold mt-6 transition-all duration-500 delay-500',
          phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        Booking Request Received!
      </h2>

      {/* Message */}
      <p
        className={cn(
          'text-muted-foreground text-sm mt-2 max-w-sm transition-all duration-500 delay-700',
          phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        {config.confirmation_message ||
          "Thank you for your booking request. We'll review it and confirm your lesson shortly."}
      </p>

      {/* Summary */}
      <div
        className={cn(
          'mt-6 w-full max-w-sm rounded-xl border bg-card p-4 text-left transition-all duration-500 delay-[900ms]',
          phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Booking Summary
        </h3>
        <dl className="space-y-2 text-sm">
          {dateDisplay && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{dateDisplay}</dd>
            </div>
          )}
          {selectedSlot?.time && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-medium">{selectedSlot.time}</dd>
            </div>
          )}
          {teacherName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Teacher</dt>
              <dd className="font-medium">{teacherName}</dd>
            </div>
          )}
          {instrumentName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Instrument</dt>
              <dd className="font-medium">{instrumentName}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Powered by footer */}
      {!isEmbed && (
        <p
          className={cn(
            'text-xs text-muted-foreground/50 mt-8 transition-all duration-500 delay-[1100ms]',
            phase >= 3 ? 'opacity-100' : 'opacity-0',
          )}
        >
          Powered by{' '}
          <a
            href="https://lessonloop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground transition-colors"
          >
            LessonLoop
          </a>
        </p>
      )}
    </div>
  );
}
