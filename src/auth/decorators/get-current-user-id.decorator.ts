import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.type';

export const GetCurrentUserId = createParamDecorator(
  (_: undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    return request.user.sub;
  },
);
