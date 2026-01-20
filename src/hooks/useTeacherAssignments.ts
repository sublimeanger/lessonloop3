import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

interface AssignmentCount {
  teacher_user_id: string;
  count: number;
}

export function useTeacherAssignmentCounts() {
  const { currentOrg } = useOrg();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!currentOrg) return;
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_user_id')
        .eq('org_id', currentOrg.id);
      
      if (error) {
        console.error('Error fetching assignment counts:', error);
        setIsLoading(false);
        return;
      }
      
      // Count assignments per teacher
      const countMap: Record<string, number> = {};
      for (const assignment of data || []) {
        countMap[assignment.teacher_user_id] = (countMap[assignment.teacher_user_id] || 0) + 1;
      }
      
      setCounts(countMap);
      setIsLoading(false);
    };
    
    fetchCounts();
  }, [currentOrg?.id]);

  return { counts, isLoading };
}
