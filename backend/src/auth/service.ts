import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import { ApiError } from '../errors.js';
import { AuthRepository, userFields } from './repository.js';

const refreshLifetime = 7 * 24 * 60 * 60 * 1000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Sign in again');

export class AuthService {
  constructor(
    readonly repository: AuthRepository,
    private config: Config,
    private sendResetLink: (url: string) => void,
  ) {}

  async register(name: string, email: string, password: string) {
    return this.repository.createUser(name, email, await bcrypt.hash(password, 12));
  }

  private tokens(userId: string, sessionId: string) {
    const claims = { sid: sessionId };
    const options = {
      subject: userId,
      issuer: 'college-inventory',
      audience: 'inventory-client',
    };
    return {
      accessToken: jwt.sign({ ...claims, type: 'access' }, this.config.ACCESS_SECRET, {
        ...options,
        expiresIn: '15m',
        jwtid: randomUUID(),
      }),
      refreshToken: jwt.sign({ ...claims, type: 'refresh' }, this.config.REFRESH_SECRET, {
        ...options,
        expiresIn: '7d',
        jwtid: randomUUID(),
      }),
    };
  }

  private claims(token: string, type: 'access' | 'refresh') {
    try {
      const value = jwt.verify(
        token,
        type === 'access' ? this.config.ACCESS_SECRET : this.config.REFRESH_SECRET,
        { algorithms: ['HS256'], issuer: 'college-inventory', audience: 'inventory-client' },
      );
      if (
        typeof value === 'string' ||
        value.type !== type ||
        typeof value.sid !== 'string' ||
        typeof value.sub !== 'string'
      )
        throw unauthorized();
      return { userId: value.sub, sessionId: value.sid };
    } catch {
      throw unauthorized();
    }
  }

  async login(email: string, password: string) {
    const user = await this.repository.findByEmail(email);
    const fallbackHash = '$2b$12$0vZKDuO.tNyoap7WnuaajOaY5pLTsI9BBqj7LG9HLm3C1IX9HhWbi';
    const matches = await bcrypt.compare(password, user?.passwordHash ?? fallbackHash);
    if (!user || !matches || user.isBlocked)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    const sessionId = randomUUID();
    const tokens = this.tokens(user.id, sessionId);
    await this.repository.db.$transaction([
      this.repository.db.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshHash: hash(tokens.refreshToken),
          expiresAt: new Date(Date.now() + refreshLifetime),
        },
      }),
      this.repository.db.auditEntry.create({ data: { actorId: user.id, action: 'signedIn' } }),
    ]);
    return tokens;
  }

  async authenticate(token: string) {
    const claims = this.claims(token, 'access');
    const session = await this.repository.findSession(claims.sessionId);
    if (
      !session ||
      session.userId !== claims.userId ||
      session.expiresAt <= new Date() ||
      session.user.isBlocked
    )
      throw unauthorized();
    return { user: session.user, sessionId: session.id };
  }

  async refresh(token: string) {
    const claims = this.claims(token, 'refresh');
    const tokens = this.tokens(claims.userId, claims.sessionId);
    const rotated = await this.repository.rotateSession(
      claims.sessionId,
      hash(token),
      hash(tokens.refreshToken),
      new Date(Date.now() + refreshLifetime),
    );
    if (rotated.count !== 1) throw unauthorized();
    return tokens;
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.repository.db.session.deleteMany({ where: { refreshHash: hash(token) } });
  }

  async forgotPassword(email: string) {
    const user = await this.repository.findByEmail(email);
    if (!user || user.isBlocked) return;
    const token = randomBytes(32).toString('hex');
    await this.repository.db.$transaction([
      this.repository.db.passwordReset.deleteMany({ where: { userId: user.id } }),
      this.repository.db.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      }),
    ]);
    const url = new URL('/reset-password', this.config.CLIENT_ORIGIN);
    url.searchParams.set('token', token);
    this.sendResetLink(url.toString());
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.repository.db.passwordReset.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!reset || reset.expiresAt <= new Date())
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'The reset link is invalid or expired');
    const user = await this.repository.db.user.findUnique({ where: { id: reset.userId } });
    if (!user || user.isBlocked) throw unauthorized();
    const saved = await this.repository.replacePassword(
      reset.userId,
      await bcrypt.hash(password, 12),
      hash(token),
    );
    if (!saved)
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'The reset link has already been used');
  }

  async changePassword(userId: string, currentPassword: string, password: string) {
    const user = await this.repository.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw new ApiError(400, 'WRONG_PASSWORD', 'The current password is incorrect');
    if (currentPassword === password)
      throw new ApiError(400, 'PASSWORD_UNCHANGED', 'Choose a different password');
    await this.repository.replacePassword(userId, await bcrypt.hash(password, 12));
  }

  async updateProfile(userId: string, name: string, email: string) {
    return this.repository.db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { name, email },
        select: userFields,
      });
      await tx.auditEntry.create({ data: { actorId: userId, action: 'profileUpdated' } });
      return user;
    });
  }
}
