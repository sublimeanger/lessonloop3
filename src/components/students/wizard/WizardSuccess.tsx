import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, User, Users, MapPin, Plus, ArrowRight } from 'lucide-react';

export interface CreatedData {
  studentId: string;
  studentName: string;
  guardian?: {
    name: string;
    relationship: string;
  };
  locationName?: string;
}

interface WizardSuccessProps {
  data: CreatedData;
  onViewStudent: () => void;
  onAddAnother: () => void;
}

export function WizardSuccess({ data, onViewStudent, onAddAnother }: WizardSuccessProps) {
  return (
    <div className="flex flex-col items-center py-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>
      
      <h3 className="text-xl font-semibold mb-6">Student Created</h3>
      
      <Card className="w-full max-w-md mb-6">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">{data.studentName}</p>
              <p className="text-sm text-muted-foreground">Student</p>
            </div>
          </div>
          
          {data.guardian && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Users className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-medium">{data.guardian.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{data.guardian.relationship}</p>
              </div>
            </div>
          )}
          
          {data.locationName && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                <MapPin className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="font-medium">{data.locationName}</p>
                <p className="text-sm text-muted-foreground">Default Location</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onAddAnother}>
          <Plus className="mr-2 h-4 w-4" />
          Add Another
        </Button>
        <Button onClick={onViewStudent}>
          View Student
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
