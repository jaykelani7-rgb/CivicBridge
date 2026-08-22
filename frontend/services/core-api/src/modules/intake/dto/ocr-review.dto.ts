import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class OcrReviewDto {
  @IsUUID()
  extractionId!: string;

  @IsBoolean()
  approved!: boolean;

  @IsUUID()
  reviewerUserId!: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
