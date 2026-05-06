import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { AtStrategy } from './strategies/at.strategy';
import { RtStrategy } from './strategies/rt.strategy';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AtStrategy, RtStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
