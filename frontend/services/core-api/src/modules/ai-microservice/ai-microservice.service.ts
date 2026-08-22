import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import {
  DecayRecalculationRequest,
  DecayRecalculationResponse,
  NeedExtractionRequest,
  NeedExtractionResponse,
  OCRExtractionRequest,
  OCRExtractionResponse,
  OCRReviewRequest,
  TwilioWebhookAck,
  VoiceTranscriptionRequest,
  VoiceTranscriptionResponse,
} from "./ai-contracts";

@Injectable()
export class AiMicroserviceService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl() {
    return this.configService.get<string>("AI_MICROSERVICE_BASE_URL") ?? "http://localhost:8000";
  }

  async classifyTwilioWebhook(
    payload: Record<string, string>,
    signature?: string,
  ): Promise<TwilioWebhookAck> {
    const formData = new URLSearchParams(payload);

    const { data } = await firstValueFrom(
      this.httpService.post<TwilioWebhookAck>(
        `${this.baseUrl}/api/v1/webhooks/twilio/whatsapp`,
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(signature ? { "X-Twilio-Signature": signature } : {}),
          },
        },
      ),
    );

    return data;
  }

  async transcribeVoice(
    payload: VoiceTranscriptionRequest,
  ): Promise<VoiceTranscriptionResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<VoiceTranscriptionResponse>(
        `${this.baseUrl}/api/v1/intake/voice/transcribe`,
        payload,
      ),
    );

    return data;
  }

  async extractNeed(
    payload: NeedExtractionRequest,
  ): Promise<NeedExtractionResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<NeedExtractionResponse>(
        `${this.baseUrl}/api/v1/intake/voice/extract`,
        payload,
      ),
    );

    return data;
  }

  async extractOcr(
    payload: OCRExtractionRequest,
  ): Promise<OCRExtractionResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<OCRExtractionResponse>(
        `${this.baseUrl}/api/v1/ocr/extract`,
        payload,
      ),
    );

    return data;
  }

  async reviewOcr(
    payload: OCRReviewRequest,
  ): Promise<OCRExtractionResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<OCRExtractionResponse>(
        `${this.baseUrl}/api/v1/ocr/review`,
        payload,
      ),
    );

    return data;
  }

  async recalculateDecay(
    payload: DecayRecalculationRequest,
  ): Promise<DecayRecalculationResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<DecayRecalculationResponse>(
        `${this.baseUrl}/api/v1/decay/recalculate`,
        payload,
      ),
    );

    return data;
  }
}
