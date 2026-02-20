import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  credentialId?: number;
  email?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.secret')!,
      ignoreExpiration: false,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): { credentialId: number; sub: string; payload: JwtPayload } {
    const credentialId = payload.credentialId ?? parseInt(payload.sub, 10);
    if (Number.isNaN(credentialId)) {
      throw new UnauthorizedException('Invalid token: missing credentialId/sub');
    }
    return {
      credentialId,
      sub: payload.sub,
      payload,
    };
  }
}
