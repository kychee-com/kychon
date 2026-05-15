export const ADMIN_ACTION_PROMPT_SHOW = 'kychon:admin-action-prompt-show';
export const ADMIN_ACTION_PROMPT_DISMISS = 'kychon:admin-action-prompt-dismiss';
export const ADMIN_ACTION_PROMPT_ACTIVATE = 'kychon:admin-action-prompt-activate';

export interface AdminActionPromptDetail {
  id: string;
  message: string;
  actionLabel: string;
  dismissLabel?: string;
  top: number;
  left: number;
  duration?: number;
}

export interface AdminActionPromptIdDetail {
  id: string;
}
