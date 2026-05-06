import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayloadWithRt } from '../types/jwt-payload-with-rt.type';

export const GetCurrentUser = createParamDecorator(
  (data: keyof JwtPayloadWithRt | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{
      user: JwtPayloadWithRt;
    }>();

    if (!data) {
      return request.user;
    }

    return request.user[data];
  },
);
