import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class RecalculateDecayDto {
  @IsOptional()
  @IsEnum(["scheduler", "manual", "backfill"])
  runReason?: "scheduler" | "manual" | "backfill";

  @IsOptional()
  @IsString()
  triggeredBy?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  openNeedIds?: string[];

  @IsOptional()
  @IsDateString()
  asOf?: string;
}
