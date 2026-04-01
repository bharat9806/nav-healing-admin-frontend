import api from '@/lib/api';
import { User } from '@/types';

let currentUserPromise: Promise<User> | null = null;

export function fetchCurrentUser() {
  if (!currentUserPromise) {
    currentUserPromise = api
      .get<User>('/auth/me')
      .then((response) => response.data)
      .catch((error) => {
        currentUserPromise = null;
        throw error;
      });
  }

  return currentUserPromise;
}

export function clearCurrentUserCache() {
  currentUserPromise = null;
}
