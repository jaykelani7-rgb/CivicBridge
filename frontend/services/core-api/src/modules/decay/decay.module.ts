import { Module } from "@nestjs/common";
import { DecayController } from "./decay.controller";
import { DecayService } from "./decay.service";

@Module({
  controllers: [DecayController],
  providers: [DecayService],
})
export class DecayModule {}
