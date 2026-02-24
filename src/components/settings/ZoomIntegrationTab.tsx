import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  CheckCircle2,
  XCircle,
  Loader2,
  Unlink,
  Video,
} from 'lucide-react';
import { useCalendarConnections } from '@/hooks/useCalendarConnections';
import { formatDistanceToNow } from 'date-fns';
import { FeatureGate } from '@/components/subscription/FeatureGate';

export function ZoomIntegrationTab() {
  const {
    zoomConnection,
    isLoading,
    isConnecting,
    connectZoom,
    disconnectCalendar,
    toggleSync,
  } = useCalendarConnections();

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Zoom Meetings
          </CardTitle>
          <CardDescription>
            Automatically create Zoom meeting links for online lessons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#2D8CFF] flex items-center justify-center">
                  <Video className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-medium">Zoom Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Auto-create Zoom links for online lessons
                  </p>
                </div>
              </div>
              {zoomConnection ? (
                <Badge variant={zoomConnection.sync_status === 'active' ? 'default' : 'destructive'}>
                  {zoomConnection.sync_status === 'active' ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Error</>
                  )}
                </Badge>
              ) : (
                <Button onClick={connectZoom} disabled={isConnecting}>
                  {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              )}
            </div>

            {zoomConnection && (
              <div className="ml-13 pl-13 border-l-2 border-muted ml-5 pl-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm text-muted-foreground">Account</Label>
                    <p className="font-medium">{zoomConnection.calendar_name || 'Zoom Account'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Last Used</Label>
                    <p className="font-medium">
                      {zoomConnection.last_sync_at
                        ? formatDistanceToNow(new Date(zoomConnection.last_sync_at), { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-create Meetings</Label>
                    <p className="text-sm text-muted-foreground">Automatically create Zoom meetings for online lessons</p>
                  </div>
                  <Switch
                    checked={zoomConnection.sync_enabled}
                    onCheckedChange={(checked) =>
                      toggleSync.mutate({ connectionId: zoomConnection.id, enabled: checked })
                    }
                  />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Zoom?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop auto-creating Zoom meetings for online lessons. Existing Zoom meeting links on lessons will remain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectCalendar.mutate({
                          connectionId: zoomConnection.id,
                          deleteEvents: false
                        })}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {!zoomConnection && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <h5 className="font-medium text-sm">How it works:</h5>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Connect your Zoom account above</li>
                  <li>Toggle "Online Lesson" when creating a lesson</li>
                  <li>A unique Zoom meeting link is automatically created</li>
                  <li>Parents see the join link in their portal</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
