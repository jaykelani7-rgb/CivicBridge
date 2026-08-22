import { Body, Controller, Headers, Post } from "@nestjs/common";
import { IntakeService } from "./intake.service";
import { VoiceIntakeDto } from "./dto/voice-intake.dto";
import { OcrIntakeDto } from "./dto/ocr-intake.dto";
import { OcrReviewDto } from "./dto/ocr-review.dto";

@Controller("v1/intake")
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post("webhooks/twilio/whatsapp")
  async ingestTwilioWebhook(
    @Body() body: Record<string, string | undefined>,
    @Headers("x-twilio-signature") signature?: string,
  ) {
    return this.intakeService.ingestTwilioWebhook(body, signature);
  }

  @Post("voice")
  async ingestVoice(@Body() dto: VoiceIntakeDto) {
    return this.intakeService.ingestVoice(dto);
  }

  @Post("ocr")
  async ingestOcr(@Body() dto: OcrIntakeDto) {
    return this.intakeService.ingestOcr(dto);
  }

  @Post("ocr/review")
  async reviewOcr(@Body() dto: OcrReviewDto) {
    return this.intakeService.reviewOcr(dto);
  }
}
