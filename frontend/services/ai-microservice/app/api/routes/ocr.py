from fastapi import APIRouter

from app.models.ocr import OCRExtractionRequest, OCRExtractionResponse, OCRReviewRequest
from app.services.ocr_service import extract_document_payload, review_ocr_result

router = APIRouter()


@router.post("/extract", response_model=OCRExtractionResponse)
async def extract_ocr_payload(
    payload: OCRExtractionRequest,
) -> OCRExtractionResponse:
    return extract_document_payload(payload)


@router.post("/review", response_model=OCRExtractionResponse)
async def submit_human_review(
    payload: OCRReviewRequest,
) -> OCRExtractionResponse:
    return review_ocr_result(payload)
