import { z } from 'zod';
import {
  CognitoIdentityProviderClient,
  AdminConfirmSignUpCommand,
  AdminGetUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { publicProcedure, router } from '../index';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.COGNITO_REGION,
});

export const authRouter = router({
  confirmSocialUser: publicProcedure
    .input(z.object({
      email: z.string().email(),
      provider: z.enum(['apple', 'google']),
    }))
    .mutation(async ({ input }) => {
      try {
        const { email, provider } = input;

        logger.info('Confirming social user', { email, provider });

        // Check if user exists and get their confirmation status
        const getUserCommand = new AdminGetUserCommand({
          UserPoolId: config.COGNITO_USER_POOL_ID,
          Username: email,
        });

        const userResponse = await cognitoClient.send(getUserCommand);

        logger.info('User status check', {
          email,
          provider,
          userStatus: userResponse.UserStatus,
          enabled: userResponse.Enabled
        });

        // Check if user is already confirmed
        if (userResponse.UserStatus === 'CONFIRMED') {
          logger.info('User already confirmed', { email, provider });
          return { success: true, message: 'User already confirmed' };
        }

        // For social sign-ins (Apple/Google), auto-confirm unconfirmed users
        if (userResponse.UserStatus === 'UNCONFIRMED' || userResponse.UserStatus === 'FORCE_CHANGE_PASSWORD') {
          logger.info('Auto-confirming social user', { email, provider, currentStatus: userResponse.UserStatus });

          // Confirm the user
          const confirmCommand = new AdminConfirmSignUpCommand({
            UserPoolId: config.COGNITO_USER_POOL_ID,
            Username: email,
          });

          await cognitoClient.send(confirmCommand);

          logger.info('Successfully confirmed social user', { email, provider });

          return {
            success: true,
            message: `User confirmed successfully via ${provider}`
          };
        }

        // Handle other statuses
        logger.warn('Unexpected user status for social sign-in', {
          email,
          provider,
          userStatus: userResponse.UserStatus
        });

        return {
          success: true,
          message: `User status: ${userResponse.UserStatus}`
        };
      } catch (error: any) {
        logger.error('Failed to confirm social user', {
          email: input.email,
          provider: input.provider,
          error: error.message,
          errorCode: error.name
        });

        if (error.name === 'UserNotFoundException') {
          throw new Error('User not found in Cognito User Pool');
        }

        if (error.name === 'NotAuthorizedException') {
          throw new Error('Not authorized to confirm this user');
        }

        throw new Error(`Failed to confirm user: ${error.message}`);
      }
    }),
});