export type ActionType =
  | 'click'
  | 'double_click'
  | 'type'
  | 'navigate'
  | 'scroll'
  | 'wait'
  | 'press_key'
  | 'finish';

export interface BaseAction {
  type: ActionType;
  description?: string;
}

export interface ClickAction extends BaseAction {
  type: 'click';
  selector: string;
}

export interface DoubleClickAction extends BaseAction {
  type: 'double_click';
  selector: string;
}

export interface TypeAction extends BaseAction {
  type: 'type';
  selector: string;
  text: string;
  clearFirst?: boolean;
}

export interface NavigateAction extends BaseAction {
  type: 'navigate';
  url: string;
}

export interface ScrollAction extends BaseAction {
  type: 'scroll';
  direction: 'up' | 'down';
  amount?: number;
}

export interface WaitAction extends BaseAction {
  type: 'wait';
  ms: number;
}

export interface PressKeyAction extends BaseAction {
  type: 'press_key';
  key: string;
  selector?: string;
}

export interface FinishAction extends BaseAction {
  type: 'finish';
  reason: string;
}

export type AgentAction =
  | ClickAction
  | DoubleClickAction
  | TypeAction
  | NavigateAction
  | ScrollAction
  | WaitAction
  | PressKeyAction
  | FinishAction;

export interface DecisionResult {
  thought: string;
  action: AgentAction;
  confidence?: number;
}
