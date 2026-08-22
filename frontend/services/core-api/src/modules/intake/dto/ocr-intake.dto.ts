import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";

export class OcrIntakeDto {
  @IsUrl()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  languageHint?: string;

  @IsOptional()
  @IsString()
  scriptHint?: string;

  @IsOptional()
  @IsEnum(["OCR", "WHATSAPP", "MANUAL"])
  source?: "OCR" | "WHATSAPP" | "MANUAL";
}
