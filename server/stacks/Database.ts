import { StackContext, RDS } from 'sst/constructs';

export function Database({ stack }: StackContext) {
  const database = new RDS(stack, 'Database', {
    engine: 'postgresql13.13',
    defaultDatabaseName: 'aiphoto',
    migrations: 'src/db/migrations',
    types: 'src/db/types.ts',
    scaling: {
      autoPause: stack.stage !== 'prod',
      minCapacity: 'ACU_2',
      maxCapacity: stack.stage === 'prod' ? 'ACU_16' : 'ACU_4',
    },
  });

  return {
    database,
  };
}