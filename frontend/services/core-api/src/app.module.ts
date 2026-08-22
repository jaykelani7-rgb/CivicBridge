import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AiMicroserviceModule } from "./modules/ai-microservice/ai-microservice.module";
import { IntakeModule } from "./modules/intake/intake.module";
import { DecayModule } from "./modules/decay/decay.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AiMicroserviceModule,
    HealthModule,
    IntakeModule,
    DecayModule,
  ],
})
export class AppModule {}
