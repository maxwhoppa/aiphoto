import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';
import { config } from '@/utils/config';
import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { getDb, users } from '@/db';
import { eq } from 'drizzle-orm';

interface CognitoTokenPayload {
  sub: string;
  email: string;
  'cognito:username': string;
  aud: string;
  iss: string;
  token_use: string;
  exp: number;
  iat: number;
}

class CognitoJWTVerifier {
  private client: jwksClient.JwksClient;
  private issuer: string;

  constructor() {
    this.issuer = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`;
    this.client = jwksClient({
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  private async getSigningKey(kid: string): Promise<string> {
    try {
      const key = await this.client.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      logger.error('Failed to get signing key', { error, kid });
      throw new AuthenticationError('Invalid token signature');
    }
  }

  async verifyToken(token: string): Promise<CognitoTokenPayload> {
    try {
      // Decode token header to get key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        throw new AuthenticationError('Invalid token format');
      }

      // Get signing key
      const signingKey = await this.getSigningKey(decoded.header.kid);

      // Verify token
      const payload = jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer: this.issuer,
      }) as CognitoTokenPayload;

      // Additional validations
      if (payload.token_use !== 'access') {
        throw new AuthenticationError('Invalid token type');
      }

      if (Date.now() >= payload.exp * 1000) {
        throw new AuthenticationError('Token expired');
      }

      return payload;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      logger.error('Token verification failed', { error });
      throw new AuthenticationError('Invalid token');
    }
  }
}

const jwtVerifier = new CognitoJWTVerifier();

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = await jwtVerifier.verifyToken(token);

    // Get or create user in database
    const db = getDb();
    let user = await db.query.users.findFirst({
      where: eq(users.cognitoId, payload.sub),
    });

    if (!user) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        cognitoId: payload.sub,
        email: payload.email,
      }).returning();
      user = newUser;
      
      logger.info('New user created', { userId: user.id, email: user.email });
    }

    // Attach user to request context
    (request as any).user = {
      userId: user.id,
      cognitoId: user.cognitoId,
      email: user.email,
    };

    logger.debug('User authenticated', { 
      userId: user.id, 
      cognitoId: user.cognitoId 
    });

  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      throw error;
    }
    
    logger.error('Authentication middleware error', { error });
    throw new AuthenticationError('Authentication failed');
  }
}

// Optional middleware for routes that don't require auth
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await authMiddleware(request, reply);
  } catch (error) {
    // Silently continue without authentication
    logger.debug('Optional auth failed', { error: error instanceof Error ? error.message : error });
  }
}