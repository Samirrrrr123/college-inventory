import type { MessageKey } from '../i18n/messages';
import { ApiError } from './client';

const keys: Record<string, MessageKey> = {
  NETWORK_ERROR: 'serverUnavailable',
  API_NOT_CONNECTED: 'serverUnavailable',
  INVALID_CREDENTIALS: 'incorrectCredentials',
  EMAIL_EXISTS: 'duplicateEmail',
  UNAUTHORIZED: 'sessionExpired',
  FORBIDDEN: 'accessDenied',
  INVALID_RESET_TOKEN: 'resetExpired',
  WRONG_PASSWORD: 'wrongCurrentPassword',
  PASSWORD_UNCHANGED: 'passwordUnchanged',
  RATE_LIMITED: 'tooManyAttempts',
  VALIDATION_ERROR: 'checkFields',
};

export function errorMessage(error: unknown, t: (key: MessageKey) => string) {
  return t(error instanceof ApiError ? (keys[error.code] ?? 'requestFailed') : 'requestFailed');
}
