"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTwilioPayload = normalizeTwilioPayload;
function normalizeTwilioPayload(payload) {
    const mediaCount = Number(payload.NumMedia ?? 0);
    const media = [];
    for (let index = 0; index < mediaCount; index += 1) {
        media.push({
            url: payload[`MediaUrl${index}`] ?? "",
            contentType: payload[`MediaContentType${index}`],
        });
    }
    return {
        accountSid: payload.AccountSid ?? "",
        messageSid: payload.MessageSid ?? "",
        fromNumber: payload.From ?? "",
        toNumber: payload.To ?? "",
        body: payload.Body ?? "",
        profileName: payload.ProfileName,
        mediaCount,
        media: media.filter((item) => item.url),
    };
}
