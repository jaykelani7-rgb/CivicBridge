import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { IntakeService } from "./intake.service";
import { IntakePersistenceService } from "./intake.persistence.service";

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, IntakePersistenceService],
  exports: [IntakeService],
})
export class IntakeModule {}
