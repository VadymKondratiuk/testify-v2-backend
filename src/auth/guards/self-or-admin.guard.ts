import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      params: { id?: string };
      user?: JwtPayload;
    }>();

    const user = request.user;
    const targetUserId = request.params.id;

    if (!user || !targetUserId) {
      return false;
    }

    return user.role === Role.ADMIN || user.sub === targetUserId;
  }
}
