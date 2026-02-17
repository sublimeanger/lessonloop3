import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg, OrgType } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'loopassist_first_run_orgs';

interface ProactiveMessage {
  title: string;
  message: string;
  suggestedPrompts: string[];
}

function getProactiveMessage(orgType: OrgType, hasStudents: boolean, hasLocations: boolean): ProactiveMessage | null {
  // Don't show proactive message if they've already done substantial setup
  if (hasStudents && hasLocations) {
    return null;
  }

  switch (orgType) {
    case 'solo_teacher':
      if (!hasStudents) {
        return {
          title: "Welcome! I'm here to help",
          message: "I see you're just getting started. Would you like me to guide you through adding your first student?",
          suggestedPrompts: [
            "Help me add my first student",
            "What should I set up first?",
            "Show me around the dashboard",
          ],
        };
      }
      return null;

    case 'studio':
      if (!hasLocations) {
        return {
          title: "Let's set up your studio",
          message: "As a studio, you'll want to add your location and rooms first. This helps organise lessons and prevent scheduling conflicts.",
          suggestedPrompts: [
            "Help me set up my studio location",
            "What's the best way to organise rooms?",
            "How do I add multiple teachers?",
          ],
        };
      }
      return null;

    case 'academy':
      if (!hasLocations) {
        return {
          title: "Welcome to LessonLoop",
          message: "For academies, I recommend setting up your locations first, then inviting your team. This creates a solid foundation for your lesson scheduling.",
          suggestedPrompts: [
            "Help me set up multiple locations",
            "How do team permissions work?",
            "What's the best way to import students?",
          ],
        };
      }
      return null;

    case 'agency':
      return {
        title: "Agency mode activated",
        message: "As an agency, you'll want to set up how parents can request lesson changes. For school-based teaching, many agencies prefer to lock scheduling to admin-only.",
        suggestedPrompts: [
          "Configure parent scheduling permissions",
          "Help me set up client schools",
          "How do I manage peripatetic teachers?",
        ],
      };

    default:
      return null;
  }
}

export function useLoopAssistFirstRun() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFirstRun = async () => {
      if (!currentOrg || !user) {
        setIsLoading(false);
        return;
      }

      // Check if we've already shown proactive message for this org
      const shown = localStorage.getItem(STORAGE_KEY);
      const shownOrgs: string[] = shown ? JSON.parse(shown) : [];
      
      if (shownOrgs.includes(currentOrg.id)) {
        setProactiveMessage(null);
        setIsLoading(false);
        return;
      }

      // Check org status to tailor the message
      try {
        const [studentsResult, locationsResult] = await Promise.all([
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', 'active'),
          supabase
            .from('locations')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id),
        ]);

        const hasStudents = (studentsResult.count || 0) > 0;
        const hasLocations = (locationsResult.count || 0) > 0;

        const message = getProactiveMessage(currentOrg.org_type, hasStudents, hasLocations);
        setProactiveMessage(message);
      } catch (error) {
        console.error('Error checking org status for LoopAssist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFirstRun();
  }, [currentOrg, user]);

  const dismissProactiveMessage = useCallback(() => {
    if (!currentOrg) return;

    // Mark this org as having seen the proactive message
    const shown = localStorage.getItem(STORAGE_KEY);
    const shownOrgs: string[] = shown ? JSON.parse(shown) : [];
    
    if (!shownOrgs.includes(currentOrg.id)) {
      shownOrgs.push(currentOrg.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shownOrgs));
    }

    setProactiveMessage(null);
  }, [currentOrg]);

  return {
    proactiveMessage,
    isLoading,
    dismissProactiveMessage,
  };
}
