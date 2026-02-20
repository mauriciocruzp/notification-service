import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  credentialId: number;
  sub: string;
  payload: Record<string, unknown>;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | number => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserPayload }>();
    const user = request.user;
    if (data) {
      return user[data] as number;
    }
    return user;
  },
);
