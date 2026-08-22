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
exports.AiMicroserviceService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let AiMicroserviceService = class AiMicroserviceService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
    }
    get baseUrl() {
        return this.configService.get("AI_MICROSERVICE_BASE_URL") ?? "http://localhost:8000";
    }
    async classifyTwilioWebhook(payload, signature) {
        const formData = new URLSearchParams(payload);
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/webhooks/twilio/whatsapp`, formData.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                ...(signature ? { "X-Twilio-Signature": signature } : {}),
            },
        }));
        return data;
    }
    async transcribeVoice(payload) {
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/intake/voice/transcribe`, payload));
        return data;
    }
    async extractNeed(payload) {
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/intake/voice/extract`, payload));
        return data;
    }
    async extractOcr(payload) {
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/ocr/extract`, payload));
        return data;
    }
    async reviewOcr(payload) {
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/ocr/review`, payload));
        return data;
    }
    async recalculateDecay(payload) {
        const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/api/v1/decay/recalculate`, payload));
        return data;
    }
};
exports.AiMicroserviceService = AiMicroserviceService;
exports.AiMicroserviceService = AiMicroserviceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiMicroserviceService);
