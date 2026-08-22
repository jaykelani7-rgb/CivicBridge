import { Body, Controller, Post } from "@nestjs/common";
import { DecayService } from "./decay.service";
import { RecalculateDecayDto } from "./dto/recalculate-decay.dto";

@Controller("v1/decay")
export class DecayController {
  constructor(private readonly decayService: DecayService) {}

  @Post("recalculate")
  async recalculate(@Body() dto: RecalculateDecayDto) {
    return this.decayService.recalculate(dto);
  }
}
