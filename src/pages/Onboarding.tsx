import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

const steps = [
  { id: 1, title: 'Your details', description: 'Tell us about yourself' },
  { id: 2, title: 'Organisation', description: 'Set up your teaching business' },
  { id: 3, title: 'Get started', description: "You're all set!" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');

  const handleNext = async () => {
    if (currentStep === 1) {
      // Save profile details
      if (!fullName.trim()) {
        toast({
          title: 'Name required',
          description: 'Please enter your full name.',
          variant: 'destructive',
        });
        return;
      }
      
      setIsLoading(true);
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setIsLoading(false);
      
      if (error) {
        toast({
          title: 'Update failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // For now just move forward, org setup can be expanded later
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Mark onboarding as complete
      setIsLoading(true);
      const { error } = await updateProfile({
        has_completed_onboarding: true,
      });
      setIsLoading(false);
      
      if (error) {
        toast({
          title: 'Update failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 p-4">
      <div className="mx-auto w-full max-w-2xl pt-8">
        {/* Progress */}
        <div className="mb-8 flex justify-center gap-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex h-2 w-24 rounded-full transition-colors ${
                step.id <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="John Smith" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={profile?.email || ''} 
                    disabled 
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the email you signed up with
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number (optional)</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="+44 7700 900000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organisation name (optional)</Label>
                  <Input 
                    id="orgName" 
                    placeholder="Smith Music Academy"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank if you're teaching as a solo teacher
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgType">Type of teaching</Label>
                  <Input 
                    id="orgType" 
                    placeholder="Piano lessons, Music school, etc." 
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {currentStep === 3 && (
              <div className="flex flex-col items-center py-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">You're all set!</h3>
                <p className="mt-2 text-center text-muted-foreground">
                  Your LessonLoop account is ready. Start by adding your first student or setting up your schedule.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1 || isLoading}
            >
              Back
            </Button>
            <Button onClick={handleNext} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : currentStep === 3 ? (
                'Go to Dashboard'
              ) : (
                'Continue'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
