"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecayService = void 0;
const common_1 = require("@nestjs/common");
const ai_microservice_service_1 = require("../ai-microservice/ai-microservice.service");
const intake_persistence_service_1 = require("../intake/intake.persistence.service");
let DecayService = class DecayService {
    constructor(aiMicroservice, persistence) {
        this.aiMicroservice = aiMicroservice;
        this.persistence = persistence;
    }
    async recalculate(dto) {
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
};
exports.DecayService = DecayService;
exports.DecayService = DecayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_microservice_service_1.AiMicroserviceService,
        intake_persistence_service_1.IntakePersistenceService])
], DecayService);
