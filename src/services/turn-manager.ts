import type { AgentConfig, TurnState } from '../types';
import { SCRIBE_AGENT_ID } from '../types';

export function createTurnManager(agents: AgentConfig[]): TurnState {
  return {
    currentAgentIndex: 0,
    currentRound: 1,
    maxRounds: 1,
    isUserInterrupted: false,
    interruptedAgentId: null,
    agentOrder: agents
      .filter((a) => a.enabled && a.id !== SCRIBE_AGENT_ID)
      .map((a) => a.id),
  };
}

export function getNextAgent(state: TurnState): string | null {
  if (state.agentOrder.length === 0) return null;
  if (state.currentRound > state.maxRounds) return null;
  return state.agentOrder[state.currentAgentIndex] ?? null;
}

export function advanceTurn(state: TurnState): TurnState {
  const nextIndex = state.currentAgentIndex + 1;

  // Moving past the last agent in this round
  if (nextIndex >= state.agentOrder.length) {
    const nextRound = state.currentRound + 1;
    return {
      ...state,
      currentAgentIndex: 0,
      currentRound: nextRound,
      isUserInterrupted: false,
      interruptedAgentId: null,
    };
  }

  return {
    ...state,
    currentAgentIndex: nextIndex,
  };
}

export function handleUserInterrupt(
  state: TurnState,
  currentAgentId: string
): TurnState {
  // Find the index of the agent who was speaking when interrupted
  const currentIdx = state.agentOrder.indexOf(currentAgentId);
  // Roll back one position: the agent before the current one will speak first after user
  // If current is at index 0, wrap around to the last agent
  const rollbackIndex = currentIdx > 0 ? currentIdx - 1 : state.agentOrder.length - 1;

  return {
    ...state,
    isUserInterrupted: true,
    interruptedAgentId: currentAgentId,
    // Set currentAgentIndex so that after the user message, the next call to
    // getNextAgent returns the agent at rollbackIndex + 1 (the one after the
    // agent who spoke before the user). We achieve this by setting
    // currentAgentIndex to rollbackIndex so advanceTurn moves to rollbackIndex+1.
    // But actually the spec says "the agent who spoke before the user gets to
    // speak first after the user", so we set it so getNextAgent returns that agent.
    currentAgentIndex: rollbackIndex,
  };
}

export function isRoundComplete(state: TurnState): boolean {
  return state.currentAgentIndex >= state.agentOrder.length - 1;
}
