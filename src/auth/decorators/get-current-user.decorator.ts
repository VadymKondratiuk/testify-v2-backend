import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.type';
import { JwtPayloadWithRt } from '../types/jwt-payload-with-rt.type';

type CurrentUser = JwtPayload | JwtPayloadWithRt;

export const GetCurrentUser = createParamDecorator(
  (data: keyof JwtPayloadWithRt | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{
      user: CurrentUser;
    }>();

    if (!data) {
      return request.user;
    }

    return request.user[data as keyof CurrentUser];
  },
);
