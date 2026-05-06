import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secretOrKey = process.env.JWT_ACCESS_SECRET;

    if (!secretOrKey) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
