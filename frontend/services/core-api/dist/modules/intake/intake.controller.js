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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntakeController = void 0;
const common_1 = require("@nestjs/common");
const intake_service_1 = require("./intake.service");
const voice_intake_dto_1 = require("./dto/voice-intake.dto");
const ocr_intake_dto_1 = require("./dto/ocr-intake.dto");
const ocr_review_dto_1 = require("./dto/ocr-review.dto");
let IntakeController = class IntakeController {
    constructor(intakeService) {
        this.intakeService = intakeService;
    }
    async ingestTwilioWebhook(body, signature) {
        return this.intakeService.ingestTwilioWebhook(body, signature);
    }
    async ingestVoice(dto) {
        return this.intakeService.ingestVoice(dto);
    }
    async ingestOcr(dto) {
        return this.intakeService.ingestOcr(dto);
    }
    async reviewOcr(dto) {
        return this.intakeService.reviewOcr(dto);
    }
};
exports.IntakeController = IntakeController;
__decorate([
    (0, common_1.Post)("webhooks/twilio/whatsapp"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-twilio-signature")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "ingestTwilioWebhook", null);
__decorate([
    (0, common_1.Post)("voice"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voice_intake_dto_1.VoiceIntakeDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "ingestVoice", null);
__decorate([
    (0, common_1.Post)("ocr"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ocr_intake_dto_1.OcrIntakeDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "ingestOcr", null);
__decorate([
    (0, common_1.Post)("ocr/review"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ocr_review_dto_1.OcrReviewDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "reviewOcr", null);
exports.IntakeController = IntakeController = __decorate([
    (0, common_1.Controller)("v1/intake"),
    __metadata("design:paramtypes", [intake_service_1.IntakeService])
], IntakeController);
