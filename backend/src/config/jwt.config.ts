import { JwtModuleOptions } from '@nestjs/jwt';

/**
 * Eduardo (15/07): centralizado + fail-fast. ANTES tinha 18 pontos no
 * repo com fallback `|| 'cine-vision-secret-key'` — se JWT_SECRET
 * sumisse em staging/preview/CI, qualquer attacker forjava JWT com
 * `{sub, role: 'admin'}` assinado com a string pública (que já vazou
 * no GitHub) e virava admin.
 *
 * Agora TODOS os módulos importam getJwtSecret() / getRefreshSecret()
 * daqui. Se env não setada, boot quebra (fail-secure).
 */

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.trim().length < 16) {
    throw new Error(
      'JWT_SECRET must be set (min 16 chars). Refusing to boot without it.',
    );
  }
  return s;
}

export function getJwtRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s || s.trim().length < 16) {
    throw new Error(
      'JWT_REFRESH_SECRET must be set (min 16 chars). Refusing to boot without it.',
    );
  }
  return s;
}

export const jwtConfig: JwtModuleOptions = {
  get secret() {
    return getJwtSecret();
  },
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};

export const refreshJwtConfig: JwtModuleOptions = {
  get secret() {
    return getJwtRefreshSecret();
  },
  signOptions: {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
};
