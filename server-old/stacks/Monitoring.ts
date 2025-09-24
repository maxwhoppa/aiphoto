import { StackContext, use } from 'sst/constructs';
import { Dashboard, Metric, GraphWidget } from 'aws-cdk-lib/aws-cloudwatch';
import { API } from './API';
import { Queue } from './Queue';

export function Monitoring({ stack }: StackContext) {
  const { api } = use(API);
  const { imageProcessingQueue } = use(Queue);

  // Create CloudWatch Dashboard
  const dashboard = new Dashboard(stack, 'AiPhotoDashboard', {
    dashboardName: `aiphoto-${stack.stage}-dashboard`,
  });

  // API Metrics
  const apiRequestCount = new Metric({
    namespace: 'AWS/ApiGateway',
    metricName: 'Count',
    dimensionsMap: {
      ApiName: api.cdk.httpApi.apiId,
    },
    statistic: 'Sum',
  });

  const apiLatency = new Metric({
    namespace: 'AWS/ApiGateway',
    metricName: 'IntegrationLatency',
    dimensionsMap: {
      ApiName: api.cdk.httpApi.apiId,
    },
    statistic: 'Average',
  });

  const apiErrors = new Metric({
    namespace: 'AWS/ApiGateway',
    metricName: '5XXError',
    dimensionsMap: {
      ApiName: api.cdk.httpApi.apiId,
    },
    statistic: 'Sum',
  });

  // SQS Metrics
  const queueDepth = new Metric({
    namespace: 'AWS/SQS',
    metricName: 'ApproximateNumberOfVisibleMessages',
    dimensionsMap: {
      QueueName: imageProcessingQueue.cdk.queue.queueName,
    },
    statistic: 'Average',
  });

  const messagesReceived = new Metric({
    namespace: 'AWS/SQS',
    metricName: 'NumberOfMessagesReceived',
    dimensionsMap: {
      QueueName: imageProcessingQueue.cdk.queue.queueName,
    },
    statistic: 'Sum',
  });

  // Add widgets to dashboard
  dashboard.addWidgets(
    new GraphWidget({
      title: 'API Requests',
      left: [apiRequestCount],
      width: 12,
      height: 6,
    }),
    new GraphWidget({
      title: 'API Latency',
      left: [apiLatency],
      width: 12,
      height: 6,
    }),
    new GraphWidget({
      title: 'API Errors',
      left: [apiErrors],
      width: 12,
      height: 6,
    }),
    new GraphWidget({
      title: 'Queue Depth',
      left: [queueDepth],
      width: 12,
      height: 6,
    }),
    new GraphWidget({
      title: 'Messages Processed',
      left: [messagesReceived],
      width: 12,
      height: 6,
    })
  );

  return {
    dashboard,
  };
}