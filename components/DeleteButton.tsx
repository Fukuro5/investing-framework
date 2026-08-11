"use client";

import { useActionState } from "react";

export interface DeleteActionState {
  status: "idle" | "error";
  errorMessage?: string;
}

interface IDeleteButtonProps {
  action: (state: DeleteActionState, formData: FormData) => Promise<DeleteActionState>;
  confirmMessage: string;
  label: string;
  hiddenFields: Record<string, string>;
}

const INITIAL_STATE: DeleteActionState = { status: "idle" };

export const DeleteButton = ({ action, confirmMessage, label, hiddenFields }: IDeleteButtonProps) => {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="text-sm text-red-700 hover:underline dark:text-red-400">
        {label}
      </button>
      {state.status === "error" && <p className="text-xs text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};
