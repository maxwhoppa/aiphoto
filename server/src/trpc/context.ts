import { Request, Response } from 'express';

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

export interface Context {
  req: Request;
  res: Response;
  user?: CognitoTokenPayload;
}

export function createTRPCContext({ req, res }: { req: Request; res: Response }): Context {
  // Get user from auth middleware if available
  const user = (req as any).user as CognitoTokenPayload | undefined;

  return {
    req,
    res,
    user,
  };
}