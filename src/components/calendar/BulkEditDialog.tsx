import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BulkEditPayload } from '@/hooks/useBulkLessonActions';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onSubmit: (payload: BulkEditPayload) => Promise<void>;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
}

const STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const LESSON_TYPES = [
  { value: 'private', label: 'Private' },
  { value: 'group', label: 'Group' },
] as const;

export function BulkEditDialog({ open, onOpenChange, count, onSubmit, teachers, locations, rooms }: BulkEditDialogProps) {
  const [teacherId, setTeacherId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [lessonType, setLessonType] = useState<string>('');

  const filteredRooms = locationId ? rooms.filter(r => r.location_id === locationId) : [];

  const hasChanges = teacherId || locationId || roomId || status || lessonType;

  const handleSubmit = async () => {
    const payload: BulkEditPayload = {};
    if (teacherId) payload.teacher_id = teacherId;
    if (locationId) payload.location_id = locationId;
    if (roomId) payload.room_id = roomId;
    if (status) payload.status = status as any;
    if (lessonType) payload.lesson_type = lessonType as any;
    await onSubmit(payload);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setTeacherId('');
    setLocationId('');
    setRoomId('');
    setStatus('');
    setLessonType('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit {count} {count === 1 ? 'lesson' : 'lessons'}</DialogTitle>
          <DialogDescription>Only changed fields will be applied. Leave blank to keep existing values.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
              <SelectContent>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={(v) => { setLocationId(v); setRoomId(''); }}>
              <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredRooms.length > 0 && (
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  {filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Lesson Type</Label>
            <Select value={lessonType} onValueChange={setLessonType}>
              <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
              <SelectContent>
                {LESSON_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!hasChanges}>
            Apply to {count} {count === 1 ? 'lesson' : 'lessons'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
