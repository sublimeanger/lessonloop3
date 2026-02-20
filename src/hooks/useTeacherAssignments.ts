import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

interface AssignmentCount {
  teacher_id: string;
  count: number;
}

/**
 * Hook to get teacher assignment counts using the new teacher_id column.
 * Returns counts keyed by teachers.id (not auth user id).
 */
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
        .select('teacher_id')
        .eq('org_id', currentOrg.id);
      
      if (error) {
        logger.error('Error fetching assignment counts:', error);
        setIsLoading(false);
        return;
      }
      
      // Count assignments per teacher (by teacher_id)
      const countMap: Record<string, number> = {};
      for (const assignment of data || []) {
        if (assignment.teacher_id) {
          countMap[assignment.teacher_id] = (countMap[assignment.teacher_id] || 0) + 1;
        }
      }
      
      setCounts(countMap);
      setIsLoading(false);
    };
    
    fetchCounts();
  }, [currentOrg?.id]);

  return { counts, isLoading };
}
