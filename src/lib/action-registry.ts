/**
 * Shared action type registry — single source of truth for all LoopAssist action metadata.
 *
 * Consumed by:
 * - ActionCard.tsx (icons, labels, roles, destructive flag)
 * - useLoopAssist.ts (valid action types, proposal validation)
 * - looopassist-execute/index.ts (role permissions — imported via copy for Deno edge fn)
 */

import type { AppRole } from '@/contexts/AuthContext';

export interface ActionDefinition {
  label: string;
  /** lucide-react icon name — resolved at usage site to avoid circular deps */
  iconName: 'Receipt' | 'Mail' | 'Calendar' | 'FileText' | 'ClipboardCheck' | 'Ban' | 'CheckCircle2';
  roles: AppRole[];
  destructive: boolean;
}

export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  generate_billing_run: {
    label: 'Generate Billing Run',
    iconName: 'Receipt',
    roles: ['owner', 'admin', 'finance'],
    destructive: true,
  },
  send_invoice_reminders: {
    label: 'Send Invoice Reminders',
    iconName: 'Mail',
    roles: ['owner', 'admin', 'finance'],
    destructive: false,
  },
  send_bulk_reminders: {
    label: 'Send All Overdue Reminders',
    iconName: 'Mail',
    roles: ['owner', 'admin', 'finance'],
    destructive: false,
  },
  reschedule_lessons: {
    label: 'Reschedule Lessons',
    iconName: 'Calendar',
    roles: ['owner', 'admin', 'teacher'],
    destructive: false,
  },
  draft_email: {
    label: 'Draft Email',
    iconName: 'FileText',
    roles: ['owner', 'admin', 'teacher'],
    destructive: false,
  },
  mark_attendance: {
    label: 'Mark Attendance',
    iconName: 'ClipboardCheck',
    roles: ['owner', 'admin', 'teacher'],
    destructive: false,
  },
  cancel_lesson: {
    label: 'Cancel Lesson',
    iconName: 'Ban',
    roles: ['owner', 'admin'],
    destructive: true,
  },
  complete_lessons: {
    label: 'Mark Lessons Complete',
    iconName: 'CheckCircle2',
    roles: ['owner', 'admin', 'teacher'],
    destructive: false,
  },
  bulk_complete_lessons: {
    label: 'Mark All Past Lessons Complete',
    iconName: 'CheckCircle2',
    roles: ['owner', 'admin', 'teacher'],
    destructive: true,
  },
  send_progress_report: {
    label: 'Send Progress Report',
    iconName: 'FileText',
    roles: ['owner', 'admin', 'teacher'],
    destructive: false,
  },
};

/** All valid action type strings */
export const VALID_ACTION_TYPES = Object.keys(ACTION_REGISTRY);

/** Check if an action type is destructive */
export function isDestructiveAction(actionType: string): boolean {
  return ACTION_REGISTRY[actionType]?.destructive ?? false;
}

/** Get allowed roles for an action type */
export function getAllowedRoles(actionType: string): AppRole[] {
  return ACTION_REGISTRY[actionType]?.roles ?? ['owner', 'admin'];
}

/** Get label for an action type */
export function getActionLabel(actionType: string): string {
  return ACTION_REGISTRY[actionType]?.label ?? actionType;
}
