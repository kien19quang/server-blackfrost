import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type FeedbackListDto, feedbackListSchema } from '../dtos/feedback.dto';
import { FeedbackService } from '../services/feedback.service';

@Controller('feedback')
@ApiTags('Feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @ApiOkResponse({ standardSchema: feedbackListSchema })
  list(): Promise<FeedbackListDto> {
    return this.feedbackService.list();
  }
}
