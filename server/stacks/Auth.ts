import { StackContext, Cognito } from 'sst/constructs';

export function Auth({ stack }: StackContext) {
  const auth = new Cognito(stack, 'Auth', {
    login: ['email'],
    cdk: {
      userPool: {
        passwordPolicy: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: false,
        },
        signInAliases: {
          email: true,
          username: false,
        },
        autoVerify: {
          email: true,
        },
        standardAttributes: {
          email: {
            required: true,
            mutable: true,
          },
          givenName: {
            required: false,
            mutable: true,
          },
          familyName: {
            required: false,
            mutable: true,
          },
        },
        accountRecovery: 'EMAIL_ONLY',
        deletionProtection: stack.stage === 'prod',
      },
      userPoolClient: {
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
        generateSecret: false,
        preventUserExistenceErrors: true,
        tokenValidityUnits: {
          accessToken: 'hours',
          idToken: 'hours',
          refreshToken: 'days',
        },
        accessTokenValidity: {
          hours: 1,
        },
        idTokenValidity: {
          hours: 1,
        },
        refreshTokenValidity: {
          days: 30,
        },
      },
    },
  });

  return {
    auth,
  };
}