import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig: JwtModuleOptions = {
  secret: process.env.JWT_SECRET || 'cine-vision-secret-key',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h', // Access token expires in 24 hours (allows long uploads)
  },
};

export const refreshJwtConfig: JwtModuleOptions = {
  secret: process.env.JWT_REFRESH_SECRET || 'cine-vision-refresh-secret-key',
  signOptions: {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // Refresh token expires in 7 days
  },
};