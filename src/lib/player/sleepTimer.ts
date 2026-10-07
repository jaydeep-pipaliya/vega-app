/** Choices shown in the player's Sleep tab. Numbers are minutes. */
export type SleepTimerOption = 'off' | 15 | 30 | 45 | 60 | 'episode';

export const SLEEP_TIMER_OPTIONS: SleepTimerOption[] = [
  'off',
  15,
  30,
  45,
  60,
  'episode',
];

export interface SleepTimerState {
  option: SleepTimerOption;
  /** Epoch ms when playback should pause; null unless a minute option is set. */
  deadline: number | null;
}

export const SLEEP_TIMER_OFF: SleepTimerState = {option: 'off', deadline: null};

export function startSleepTimer(
  option: SleepTimerOption,
  now: number,
): SleepTimerState {
  if (typeof option === 'number') {
    return {option, deadline: now + option * 60_000};
  }
  return {option, deadline: null};
}

/** True once a minute based timer has run out. */
export function isSleepDeadlineReached(
  state: SleepTimerState,
  now: number,
): boolean {
  return state.deadline !== null && now >= state.deadline;
}

/** "End of episode" stops at the end and must not roll into the next one. */
export function shouldStopAtEpisodeEnd(state: SleepTimerState): boolean {
  return state.option === 'episode';
}

/** Whole minutes left, rounded up, or null when no deadline is running. */
export function getSleepMinutesLeft(
  state: SleepTimerState,
  now: number,
): number | null {
  if (state.deadline === null) {
    return null;
  }
  return Math.max(0, Math.ceil((state.deadline - now) / 60_000));
}

export function getSleepOptionLabel(option: SleepTimerOption): string {
  if (option === 'off') {
    return 'Off';
  }
  if (option === 'episode') {
    return 'End of episode';
  }
  return `${option} minutes`;
}

/** Remaining time text for the active menu row, e.g. "12 min left". */
export function formatSleepRemaining(minutesLeft: number | null): string {
  if (minutesLeft === null) {
    return '';
  }
  return minutesLeft <= 1 ? 'Less than 1 min left' : `${minutesLeft} min left`;
}
