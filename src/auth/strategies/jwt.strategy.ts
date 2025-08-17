import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(configService: ConfigService) {
		const secret = configService.get<string>('JWT_SECRET');
		if (!secret) {
			throw new Error('JWT_SECRET is not defined');
		}
		const cookieExtractor = (req: any) => {
			if (req && req.cookies && req.cookies['access_token']) {
				return req.cookies['access_token'];
			}
			return null;
		};
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				cookieExtractor,
				ExtractJwt.fromAuthHeaderAsBearerToken(),
			]),
			ignoreExpiration: false,
			secretOrKey: secret,
		});
	}

	async validate(payload: any) {
		return { userId: payload.sub, email: payload.email, role: payload.role };
	}
}
