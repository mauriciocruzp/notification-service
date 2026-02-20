import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService, PaginatedNotifications } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user (paginated)' })
  async list(
    @CurrentUser() user: CurrentUserPayload['credentialId'],
    @Query() query: QueryNotificationsDto,
  ): Promise<PaginatedNotifications> {
    const unreadOnly = query.unreadOnly === 'true';
    const recipient = String(user);
    return this.notificationsService.findAllForUser(
      recipient,
      query.page,
      query.limit,
      unreadOnly,
    );
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for the current user' })
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload['credentialId']): Promise<{ count: number }> {
    const recipient = String(user);
    return this.notificationsService.markAllAsRead(recipient);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload['credentialId'],
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    const recipient = String(user);
    return this.notificationsService.markAsRead(notificationId, recipient);
  }
}
