import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from '@/utils/config';
import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { getDb, users } from '@/db';
import { eq } from 'drizzle-orm';

interface CognitoTokenPayload {
  sub: string;
  email?: string;
  username?: string;
  'cognito:username'?: string;
  aud: string;
  iss: string;
  token_use: string;
  exp: number;
  iat: number;
}

class CognitoJWTVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private issuer: string;

  constructor() {
    this.issuer = `https://cognito-idp.${config.COGNITO_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
      {
        timeoutDuration: 5000,
        cooldownDuration: 30000,
      }
    );
    
    logger.info('JWT Verifier initialized', {
      issuer: this.issuer,
      jwksUrl: `${this.issuer}/.well-known/jwks.json`,
      region: config.COGNITO_REGION,
      userPoolId: config.COGNITO_USER_POOL_ID,
    });
  }

  async verifyToken(token: string): Promise<CognitoTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ['RS256'],
      });

      // Additional validations
      if (payload.token_use !== 'access') {
        throw new AuthenticationError('Invalid token type');
      }

      return payload as unknown as CognitoTokenPayload;
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

export { jwtVerifier };

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
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
    const userResults = await db.select().from(users).where(eq(users.cognitoId, payload.sub)).limit(1);
    let user = userResults[0];

    if (!user) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        cognitoId: payload.sub,
        email: payload.email || `${payload.sub}@cognito.local`,
      }).returning();
      
      if (!newUser) {
        throw new AuthenticationError('Failed to create user');
      }
      
      user = newUser;
      logger.info('New user created', { userId: newUser.id, email: newUser.email });
    }

    // Ensure user exists
    if (!user) {
      throw new AuthenticationError('Failed to retrieve or create user');
    }

    // Attach user to request context
    (request as FastifyRequest & { user: { userId: string; cognitoId: string; email: string } }).user = {
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