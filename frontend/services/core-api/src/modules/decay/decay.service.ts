import { Injectable } from "@nestjs/common";
import { AiMicroserviceService } from "../ai-microservice/ai-microservice.service";
import { IntakePersistenceService } from "../intake/intake.persistence.service";
import { RecalculateDecayDto } from "./dto/recalculate-decay.dto";

@Injectable()
export class DecayService {
  constructor(
    private readonly aiMicroservice: AiMicroserviceService,
    private readonly persistence: IntakePersistenceService,
  ) {}

  async recalculate(dto: RecalculateDecayDto) {
    const response = await this.aiMicroservice.recalculateDecay({
      run_reason: dto.runReason ?? "scheduler",
      triggered_by: dto.triggeredBy,
      open_need_ids: dto.openNeedIds ?? [],
      as_of: dto.asOf,
    });

    await this.persistence.persistDecayUpdates(response.updates);

    return {
      ...response,
      persistedCount: response.updates.length,
    };
  }
}
