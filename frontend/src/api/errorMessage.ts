import type { MessageKey } from '../i18n/messages';
import { ApiError } from './client';

const keys: Record<string, MessageKey> = {
  NO_EQUIPMENT: 'noCheckEquipment',
  CHECK_INCOMPLETE: 'checkIncomplete',
  CHECK_COMPLETED: 'checkAlreadyCompleted',
  INVALID_FILE_TYPE: 'fileTypeError',
  INVALID_FILE_NAME: 'invalidFileName',
  EMPTY_FILE: 'emptyFile',
  BODY_TOO_LARGE: 'fileSizeError',
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
  INVENTORY_NUMBER_EXISTS: 'duplicateNumber',
  ALREADY_EXISTS: 'directoryDuplicate',
  RELATED_RECORDS: 'relatedRecords',
  EQUIPMENT_ISSUED: 'issuedCannotChange',
  CONCURRENT_CHANGE: 'concurrentChange',
  EQUIPMENT_UNAVAILABLE: 'equipmentUnavailable',
  INVALID_TRANSITION: 'invalidTransition',
  ALREADY_ISSUED: 'alreadyIssued',
  INVALID_DUE_DATE: 'invalidDueDate',
  INVALID_RECIPIENT: 'invalidRecipient',
  ALREADY_RETURNED: 'returnAlreadyRecorded',
  NOT_FOUND: 'recordMissing',
};

export function errorMessage(error: unknown, t: (key: MessageKey) => string) {
  return t(error instanceof ApiError ? (keys[error.code] ?? 'requestFailed') : 'requestFailed');
}
