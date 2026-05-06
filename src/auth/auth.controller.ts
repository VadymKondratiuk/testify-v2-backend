import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUser } from './decorators/get-current-user.decorator';
import { GetCurrentUserId } from './decorators/get-current-user-id.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AtAuthGuard } from './guards/at-auth.guard';
import { RtAuthGuard } from './guards/rt-auth.guard';
import { AuthService } from './auth.service';
import type { JwtPayloadWithRt } from './types/jwt-payload-with-rt.type';
import type { Tokens } from './types/tokens.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto): Promise<Tokens> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<Tokens> {
    return this.authService.login(loginDto);
  }

  @UseGuards(AtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@GetCurrentUserId() userId: string): Promise<{ success: true }> {
    return this.authService.logout(userId);
  }

  @UseGuards(RtAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@GetCurrentUser() user: JwtPayloadWithRt): Promise<Tokens> {
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }
}
