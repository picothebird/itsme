import type { ApplicationStatus } from './types.js'

/**
 * Managed-research application lifecycle state machine.
 * applied → screening → review → selected/rejected → scheduled → in_session → completed → paid
 * `rejected` and `paid` are terminal.
 */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['screening', 'rejected'],
  screening: ['review', 'rejected'],
  review: ['selected', 'rejected'],
  selected: ['scheduled', 'rejected'],
  scheduled: ['in_session', 'rejected'],
  in_session: ['completed'],
  completed: ['paid'],
  rejected: [],
  paid: [],
}

export const canTransition = (from: ApplicationStatus, to: ApplicationStatus): boolean =>
  APPLICATION_TRANSITIONS[from].includes(to)

export const isTerminal = (status: ApplicationStatus): boolean =>
  APPLICATION_TRANSITIONS[status].length === 0
