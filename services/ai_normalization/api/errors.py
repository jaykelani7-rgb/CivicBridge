"""
Custom API error type so responses match packages.contracts.envelope.StandardErrorResponse
exactly at the top level -- i.e. {"error": {code, message, retryable, details, trace_id}}.

FastAPI's built-in HTTPException always wraps whatever you pass as `detail` under a
top-level "detail" key, which would produce {"detail": {"error": {...}}} instead of
the shared contract shape. Raising this exception and registering the handler in
main.py (the same pattern services/data-intelligence/app/main.py uses for its
DomainError) keeps every AI Normalization error response byte-for-byte compatible
with contract.md Section 6's standard error response.
"""
from typing import List, Optional


class NormalizationAPIError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        http_status: int,
        trace_id: str,
        retryable: bool = False,
        details: Optional[List] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.trace_id = trace_id
        self.retryable = retryable
        self.details = details or []
