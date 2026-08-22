import { HttpModule } from "@nestjs/axios";
import { Global, Module } from "@nestjs/common";
import { AiMicroserviceService } from "./ai-microservice.service";

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 12_000,
      maxRedirects: 2,
    }),
  ],
  providers: [AiMicroserviceService],
  exports: [AiMicroserviceService],
})
export class AiMicroserviceModule {}
