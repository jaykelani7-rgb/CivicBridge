import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from "class-validator";
import { LocationDto } from "./location.dto";

export class VoiceIntakeDto {
  @IsUrl()
  mediaUrl!: string;

  @IsOptional()
  @IsString()
  languageHint?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  locationHint?: LocationDto;

  @IsOptional()
  @IsEnum(["VOICE", "WHATSAPP", "MANUAL"])
  source?: "VOICE" | "WHATSAPP" | "MANUAL";
}
