import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  briefingStateSchema,
  type BriefingStateDto,
  mergeBriefingSchema,
  type MergeBriefingDto,
  updateBriefingSchema,
  type UpdateBriefingDto,
} from '../dtos/briefing.dto';
import { BriefingService } from '../services/briefing.service';

@Controller('briefing')
@ApiTags('Briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get()
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  get(): Promise<BriefingStateDto> {
    return this.briefingService.get();
  }

  @Post('generate')
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  generate(): Promise<BriefingStateDto> {
    return this.briefingService.generate();
  }

  @Post('draft/replace')
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  replaceWithDraft(): Promise<BriefingStateDto> {
    return this.briefingService.replaceWithDraft();
  }

  @Post('draft/merge')
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  mergeDraft(@Body({ schema: mergeBriefingSchema }) dto: MergeBriefingDto): Promise<BriefingStateDto> {
    return this.briefingService.mergeDraft(dto);
  }

  @Put()
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  update(@Body({ schema: updateBriefingSchema }) dto: UpdateBriefingDto): Promise<BriefingStateDto> {
    return this.briefingService.update(dto);
  }

  @Delete('draft')
  @ApiOkResponse({ standardSchema: briefingStateSchema })
  discardDraft(): Promise<BriefingStateDto> {
    return this.briefingService.discardDraft();
  }
}
