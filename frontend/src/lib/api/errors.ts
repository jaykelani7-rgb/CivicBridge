export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  status: number;
  traceId?: string;
  details: unknown[];
};

export class ApiError extends Error implements ApiErrorBody {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly traceId?: string;
  readonly details: unknown[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.retryable = body.retryable;
    this.status = body.status;
    this.traceId = body.traceId;
    this.details = body.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
