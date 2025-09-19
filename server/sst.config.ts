import { SSTConfig } from 'sst';
import { API } from './stacks/API';
import { Database } from './stacks/Database';
import { Storage } from './stacks/Storage';
import { Queue } from './stacks/Queue';
import { Auth } from './stacks/Auth';
import { Monitoring } from './stacks/Monitoring';

export default {
  config(_input) {
    return {
      name: 'aiphoto-server',
      region: 'us-east-1',
      profile: _input.stage === 'prod' ? 'production' : 'default',
      stage: _input.stage,
    };
  },
  stacks(app) {
    app.setDefaultFunctionProps({
      runtime: 'nodejs18.x',
      architecture: 'arm64',
      timeout: '30 seconds',
      memorySize: '1024 MB',
      environment: {
        NODE_ENV: app.stage === 'prod' ? 'production' : 'development',
      },
    });

    // Create foundational stacks first
    app.stack(Database).stack(Storage).stack(Queue).stack(Auth);
    
    // Then dependent stacks
    app.stack(API).stack(Monitoring);
  },
} satisfies SSTConfig;