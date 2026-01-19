import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

const steps = [
  { id: 1, title: 'Your details', description: 'Tell us about yourself' },
  { id: 2, title: 'Organisation', description: 'Set up your teaching business' },
  { id: 3, title: 'Get started', description: 'You\'re all set!' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 p-4">
      <div className="mx-auto w-full max-w-2xl">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" placeholder="Smith" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input id="phone" type="tel" placeholder="+44 7700 900000" />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organisation name</Label>
                  <Input id="orgName" placeholder="Smith Music Academy" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgType">Type</Label>
                  <Input id="orgType" placeholder="Music School" />
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
              disabled={currentStep === 1}
            >
              Back
            </Button>
            <Button onClick={handleNext}>
              {currentStep === 3 ? 'Go to Dashboard' : 'Continue'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
