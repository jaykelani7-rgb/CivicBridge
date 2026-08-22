export interface TwilioMediaItem {
  url: string;
  contentType?: string;
}

export interface NormalizedTwilioWebhook {
  accountSid: string;
  messageSid: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  profileName?: string;
  mediaCount: number;
  media: TwilioMediaItem[];
}

type TwilioPayload = Record<string, string | undefined>;

export function normalizeTwilioPayload(payload: TwilioPayload): NormalizedTwilioWebhook {
  const mediaCount = Number(payload.NumMedia ?? 0);
  const media: TwilioMediaItem[] = [];

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
