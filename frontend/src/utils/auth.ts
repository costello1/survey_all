import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

const AUTH_TOKEN_KEY = 'survey_admin_token';

export function getAuthToken(): string | null {
  return firebaseAuth.currentUser?.uid ?? window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  void signOut(firebaseAuth);
}
