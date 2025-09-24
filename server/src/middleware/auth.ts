import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from '../utils/config';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

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

interface AuthenticatedRequest extends Request {
  user?: CognitoTokenPayload;
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

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = await jwtVerifier.verifyToken(token);

    // Attach JWT payload directly to request
    req.user = payload;
    logger.debug('User authenticated', { 
      cognitoId: payload.sub,
      email: payload.email 
    });

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        error: error.message
      });
    }
    
    logger.error('Authentication middleware error', { error });
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}


export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header, continue without user context
      logger.debug('No authorization header, continuing without user context');
      return next();
    }

    const token = authHeader.substring(7);
    const payload = await jwtVerifier.verifyToken(token);

    // Attach JWT payload to request if valid
    req.user = payload;
    logger.debug('User authenticated via optional auth', { 
      cognitoId: payload.sub,
      email: payload.email 
    });

    next();
  } catch (error) {
    // Auth failed, but continue without user context
    logger.debug('Optional auth failed, continuing without user context', { 
      error: error instanceof Error ? error.message : error 
    });
    next();
  }
}

export type { AuthenticatedRequest };