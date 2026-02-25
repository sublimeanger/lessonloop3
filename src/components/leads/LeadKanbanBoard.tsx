import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useLeads,
  useLeadStageCounts,
  useUpdateLeadStage,
  LEAD_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type LeadStage,
  type LeadListItem,
} from '@/hooks/useLeads';
import { LeadCard } from './LeadCard';
import { CreateLeadModal } from './CreateLeadModal';

// ---------------------------------------------------------------------------
// Sortable card wrapper
// ---------------------------------------------------------------------------

function SortableLeadCard({ lead }: { lead: LeadListItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} isDragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable column
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  stage: LeadStage;
  leads: LeadListItem[];
  count: number;
  isFirst?: boolean;
  onAddClick?: () => void;
}

function KanbanColumn({ stage, leads, count, isFirst, onAddClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const color = STAGE_COLORS[stage];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[260px] w-[280px] shrink-0 rounded-xl bg-muted/40 border border-border/50 snap-start',
        isOver && 'ring-2 ring-primary/40 bg-primary/5',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium truncate">{STAGE_LABELS[stage]}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 tabular-nums">
            {count}
          </Badge>
        </div>
        {isFirst && onAddClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onAddClick}
            aria-label="Add new lead"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[60vh]">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <Inbox className="h-6 w-6 mb-1" />
            <p className="text-xs">No leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Kanban Board
// ---------------------------------------------------------------------------

interface LeadKanbanBoardProps {
  leads?: LeadListItem[];
  stageCounts?: Record<string, number>;
  onAddLead?: () => void;
}

export function LeadKanbanBoard({ leads: externalLeads, stageCounts: externalCounts, onAddLead }: LeadKanbanBoardProps) {
  const isMobile = useIsMobile();
  const { data: fetchedLeads, isLoading } = useLeads();
  const { data: fetchedCounts } = useLeadStageCounts();
  const updateStage = useUpdateLeadStage();

  const leads = externalLeads ?? fetchedLeads;
  const stageCounts = externalCounts ?? fetchedCounts;

  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<LeadStage, LeadListItem[]> = {
      enquiry: [],
      contacted: [],
      trial_booked: [],
      trial_completed: [],
      enrolled: [],
      lost: [],
    };

    for (const lead of leads || []) {
      const stage = lead.stage as LeadStage;
      if (grouped[stage]) {
        grouped[stage].push(lead);
      }
    }

    return grouped;
  }, [leads]);

  const activeLead = useMemo(() => {
    if (!activeId || !leads) return null;
    return leads.find((l) => l.id === activeId) || null;
  }, [activeId, leads]);

  // Sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Find which column a lead belongs to
  const findStageForLead = useCallback(
    (leadId: string): LeadStage | null => {
      for (const stage of LEAD_STAGES) {
        if (leadsByStage[stage].some((l) => l.id === leadId)) {
          return stage;
        }
      }
      return null;
    },
    [leadsByStage],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // We handle actual move in dragEnd to reduce mutation calls
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = active.id as string;
      const currentStage = findStageForLead(leadId);

      // Determine target stage: "over" could be a column id (stage) or another card
      let targetStage: LeadStage | null = null;

      if (LEAD_STAGES.includes(over.id as LeadStage)) {
        targetStage = over.id as LeadStage;
      } else {
        // Dropped over another card - find its stage
        targetStage = findStageForLead(over.id as string);
      }

      if (!targetStage || targetStage === currentStage) return;

      updateStage.mutate({ leadId, stage: targetStage });
    },
    [findStageForLead, updateStage],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className={cn(
            'flex gap-3 pb-4',
            isMobile ? 'overflow-x-auto snap-x snap-mandatory px-1 -mx-1' : '',
          )}
        >
          {LEAD_STAGES.map((stage, idx) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage]}
              count={stageCounts?.[stage] ?? leadsByStage[stage].length}
              isFirst={idx === 0}
              onAddClick={onAddLead || (() => setCreateOpen(true))}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[260px]">
              <LeadCard lead={activeLead} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!onAddLead && <CreateLeadModal open={createOpen} onOpenChange={setCreateOpen} />}
    </>
  );
}
