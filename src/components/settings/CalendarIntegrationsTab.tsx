import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, differenceInDays } from 'date-fns';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Copy, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Unlink,
  RotateCcw,
} from 'lucide-react';
import { useCalendarConnections } from '@/hooks/useCalendarConnections';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { CalendarSyncHealth } from './CalendarSyncHealth';
import { useOrg } from '@/contexts/OrgContext';

export function CalendarIntegrationsTab() {
  const { toast } = useToast();
  const { isOrgAdmin } = useOrg();
  const {
    googleConnection,
    appleConnection,
    isLoading,
    isConnecting,
    connectGoogle,
    disconnectCalendar,
    toggleSync,
    triggerSync,
    generateICalUrl,
    getICalUrl,
    regenerateICalToken,
  } = useCalendarConnections();

  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  const handleGenerateICalUrl = async () => {
    setIsGeneratingUrl(true);
    try {
      const url = await generateICalUrl();
      if (url) {
        setIcalUrl(url);
      }
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'iCal URL copied to clipboard' });
  };

  const existingIcalUrl = getICalUrl();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <FeatureGate feature="calendar_sync">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendar Integrations
            </CardTitle>
            <CardDescription>
              Sync your lessons with external calendars. LessonLoop is the source of truth for lesson data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Calendar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-6 w-6">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium">Google Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      Two-way sync with your Google Calendar
                    </p>
                  </div>
                </div>
                {googleConnection ? (
                  <Badge variant={googleConnection.sync_status === 'active' ? 'default' : 'destructive'}>
                    {googleConnection.sync_status === 'active' ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Error</>
                    )}
                  </Badge>
                ) : (
                  <Button onClick={connectGoogle} disabled={isConnecting}>
                    {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Connect
                  </Button>
                )}
              </div>

              {googleConnection && (
                <div className="ml-13 pl-13 border-l-2 border-muted ml-5 pl-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm text-muted-foreground">Calendar</Label>
                      <p className="font-medium">{googleConnection.calendar_name || 'Primary Calendar'}</p>
                    </div>
                     <div>
                      <Label className="text-sm text-muted-foreground">Last Synced</Label>
                      {(() => {
                        const isStale = googleConnection.last_sync_at &&
                          (Date.now() - new Date(googleConnection.last_sync_at).getTime() > 2 * 60 * 60 * 1000);
                        return (
                          <div className="flex items-center gap-1.5">
                            <p className={`font-medium ${isStale ? 'text-warning' : ''}`}>
                              {googleConnection.last_sync_at
                                ? formatDistanceToNow(new Date(googleConnection.last_sync_at), { addSuffix: true })
                                : 'Never'}
                            </p>
                            {isStale && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                                <AlertCircle className="h-3 w-3" />
                                Stale
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sync Enabled</Label>
                      <p className="text-sm text-muted-foreground">Automatically sync lessons to Google Calendar</p>
                    </div>
                    <Switch
                      checked={googleConnection.sync_enabled}
                      onCheckedChange={(checked) => 
                        toggleSync.mutate({ connectionId: googleConnection.id, enabled: checked })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync.mutate(googleConnection.id)}
                      disabled={triggerSync.isPending}
                    >
                      {triggerSync.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will stop syncing lessons to Google Calendar. Events already in your calendar will remain unless you choose to delete them.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectCalendar.mutate({ 
                              connectionId: googleConnection.id, 
                              deleteEvents: false 
                            })}
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Apple Calendar (iCal) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium">Apple Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      Subscribe via iCal feed URL (read-only)
                    </p>
                  </div>
                </div>
                {(existingIcalUrl || icalUrl) ? (
                  <Badge variant="default">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
                  </Badge>
                ) : null}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Apple Calendar subscribes to your lesson feed. Changes may take 15-60 minutes to appear depending on your calendar app's refresh settings.
                </AlertDescription>
              </Alert>

              {existingIcalUrl || icalUrl ? (
                <div className="space-y-3">
                  {/* Expiry warning */}
                  {appleConnection?.ical_token_expires_at && (() => {
                    const expiresAt = new Date(appleConnection.ical_token_expires_at);
                    const daysLeft = differenceInDays(expiresAt, new Date());
                    if (daysLeft <= 7) {
                      return (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Your iCal feed URL expires on {format(expiresAt, 'dd MMM yyyy')}. Please regenerate it below.
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground">
                        Feed URL expires on {format(expiresAt, 'dd MMM yyyy')} ({daysLeft} days remaining)
                      </p>
                    );
                  })()}

                  <div className="space-y-2">
                    <Label>Your iCal Feed URL</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input 
                        value={existingIcalUrl || icalUrl || ''} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 sm:h-10 sm:w-10"
                        aria-label="Copy iCal URL"
                        onClick={() => handleCopyUrl(existingIcalUrl || icalUrl || '')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keep this URL private. Anyone with this link can view your lesson schedule.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`webcal://${(existingIcalUrl || icalUrl || '').replace('https://', '')}`, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Calendar App
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Regenerate URL
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Regenerate iCal URL?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will create a new URL and invalidate the old one. You'll need to re-subscribe in your calendar app.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => regenerateICalToken.mutate()}>
                            Regenerate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <Button onClick={handleGenerateICalUrl} disabled={isGeneratingUrl}>
                  {isGeneratingUrl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate iCal URL
                </Button>
              )}

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <h5 className="font-medium text-sm">How to subscribe:</h5>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copy the iCal URL above</li>
                  <li>In Apple Calendar, go to File → New Calendar Subscription</li>
                  <li>Paste the URL and click Subscribe</li>
                  <li>Set refresh frequency (recommended: Every hour)</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info about sync behaviour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How Calendar Sync Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <span className="text-primary">→</span> LessonLoop to External
                </h5>
                <p className="text-sm text-muted-foreground">
                  When you create, edit, or cancel a lesson in LessonLoop, it automatically syncs to your connected Google Calendar.
                </p>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <span className="text-primary">←</span> External to LessonLoop
                </h5>
                <p className="text-sm text-muted-foreground">
                  Events from your external calendar appear as "busy" blocks when scheduling, helping avoid conflicts. They don't create lessons.
                </p>
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>LessonLoop is the source of truth.</strong> Editing a synced event directly in Google Calendar won't update the lesson in LessonLoop. Always make changes here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {isOrgAdmin && (
          <>
            <Separator />
            <CalendarSyncHealth />
          </>
        )}
      </div>
    </FeatureGate>
  );
}
