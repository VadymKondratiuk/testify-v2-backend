import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';
import { JwtPayloadWithRt } from '../types/jwt-payload-with-rt.type';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    const secretOrKey = process.env.JWT_REFRESH_SECRET;

    if (!secretOrKey) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
      secretOrKey,
    });
  }

  validate(request: Request, payload: JwtPayload): JwtPayloadWithRt {
    const refreshToken = request
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}
