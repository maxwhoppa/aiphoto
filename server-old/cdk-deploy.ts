#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class AiPhotoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for images
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `aiphoto-images-${this.stackName.toLowerCase()}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        id: 'transition-to-ia',
        enabled: true,
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
    });

    // SQS Queue for image processing
    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `aiphoto-processing-${this.stackName.toLowerCase()}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aiphoto-users-${this.stackName.toLowerCase()}`,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // Lambda function for API
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          // Simple health check response
          if (event.path === '/health') {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: 'production',
                message: 'AI Photo Server is running'
              }),
            };
          }
          
          // Default response
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              message: 'AI Photo Server API',
              version: '1.0.0',
              timestamp: new Date().toISOString(),
            }),
          };
        };
      `),
      environment: {
        S3_BUCKET_NAME: imagesBucket.bucketName,
        SQS_QUEUE_URL: processingQueue.queueUrl,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_REGION: this.region,
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
    });

    // Grant permissions
    imagesBucket.grantReadWrite(apiFunction);
    processingQueue.grantSendMessages(apiFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'AiPhotoApi', {
      restApiName: `aiphoto-api-${this.stackName.toLowerCase()}`,
      description: 'AI Photo Processing API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API routes
    api.root.addMethod('ANY', lambdaIntegration);
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: imagesBucket.bucketName,
      description: 'S3 bucket for images',
    });
  }
}

// App
const app = new cdk.App();
new AiPhotoStack(app, 'AiPhotoStack', {
  stackName: 'aiphoto-prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});