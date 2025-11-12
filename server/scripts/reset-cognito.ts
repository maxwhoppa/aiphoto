import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Load environment variables
loadEnv({ path: path.join(__dirname, '..', '.env') });

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
});

const userPoolId = process.env.COGNITO_USER_POOL_ID;

if (!userPoolId) {
  console.error('❌ COGNITO_USER_POOL_ID not found in environment variables');
  process.exit(1);
}

async function deleteAllCognitoUsers() {
  console.log('🔄 Starting Cognito user deletion...');
  console.log(`📍 User Pool ID: ${userPoolId}`);

  try {
    // List all users
    console.log('📦 Fetching all users...');
    const listCommand = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60,
    });

    const listResponse = await client.send(listCommand);
    const users = listResponse.Users || [];

    if (users.length === 0) {
      console.log('✅ No users found in the user pool');
      return;
    }

    console.log(`Found ${users.length} users to delete`);

    // Delete each user
    for (const user of users) {
      const username = user.Username;
      if (!username) continue;

      try {
        console.log(`  Deleting user: ${username}`);
        const deleteCommand = new AdminDeleteUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        });
        await client.send(deleteCommand);
        console.log(`  ✅ Deleted: ${username}`);
      } catch (deleteError: any) {
        console.error(`  ❌ Failed to delete ${username}:`, deleteError.message);
      }
    }

    console.log('✅ Cognito user deletion completed!');

  } catch (error: any) {
    console.error('❌ Error during Cognito user deletion:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error('The specified user pool was not found. Please check your COGNITO_USER_POOL_ID.');
    }
    process.exit(1);
  }
}

// Confirmation prompt
async function main() {
  console.log('⚠️  WARNING: This will delete ALL users from the Cognito user pool!');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');

  await new Promise(resolve => setTimeout(resolve, 3000));

  await deleteAllCognitoUsers();
  process.exit(0);
}

main();