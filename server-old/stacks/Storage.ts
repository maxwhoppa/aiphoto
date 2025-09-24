import { StackContext, Bucket } from 'sst/constructs';

export function Storage({ stack }: StackContext) {
  const imagesBucket = new Bucket(stack, 'ImagesBucket', {
    cors: [
      {
        allowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: '1 day',
      },
    ],
    cdk: {
      bucket: {
        lifecycleRules: [
          {
            id: 'delete-incomplete-multipart-uploads',
            abortIncompleteMultipartUploadAfter: {
              days: 1,
            },
            status: 'Enabled',
          },
          {
            id: 'transition-to-ia',
            transitions: [
              {
                storageClass: 'STANDARD_IA',
                transitionAfter: {
                  days: 30,
                },
              },
              {
                storageClass: 'GLACIER',
                transitionAfter: {
                  days: 90,
                },
              },
            ],
            status: 'Enabled',
          },
        ],
      },
    },
  });

  return {
    imagesBucket,
  };
}