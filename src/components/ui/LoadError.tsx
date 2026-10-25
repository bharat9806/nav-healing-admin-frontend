"use client";

import { isAxiosError } from "axios";
import s from "./LoadError.module.scss";

export function loadErrorMessage(error: unknown, fallback: string) {
  return isAxiosError(error) && error.response?.status === 403
    ? "You do not have access to this information. Ask your administrator to update your permissions."
    : fallback;
}

export default function LoadError({
  message,
  onRetry,
  loading = false,
}: {
  message: string;
  onRetry: () => void;
  loading?: boolean;
}) {
  return (
    <div className={s.error} role="alert">
      <div>
        <strong>{message.startsWith('You do not have access') ? 'Access restricted' : 'We couldn’t load this information'}</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={loading}>
        {loading ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
}
