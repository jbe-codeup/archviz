import { ResourceRegistry, type DocumentValidator, type ResourceDefinition } from '@archviz/schema';
import { roleTrustValidator } from './iam-trust.js';
import { workloadRoleValidator } from './workload-role.js';
import {
  ecsSecretsExecRoleValidator,
  ecsImageSourceValidator,
  lbMultiAzValidator,
} from './deploy-checks.js';
import {
  vpc,
  subnet,
  internetGateway,
  ec2Instance,
  securityGroup,
  rdsInstance,
  auroraCluster,
  auroraClusterInstance,
  elastiCacheCluster,
  s3Bucket,
  alb,
  nlb,
  targetGroup,
  lambdaFunction,
  dynamodbTable,
  iamRole,
  ecrRepository,
  ecsCluster,
  ecsTaskDefinition,
  ecsService,
  secretsManagerSecret,
  ssmParameter,
  sqsQueue,
  snsTopic,
  apiGatewayHttpApi,
  cloudwatchLogGroup,
} from './resources/index.js';

export const awsResources: ResourceDefinition[] = [
  vpc,
  subnet,
  internetGateway,
  ec2Instance,
  securityGroup,
  rdsInstance,
  auroraCluster,
  auroraClusterInstance,
  elastiCacheCluster,
  s3Bucket,
  alb,
  nlb,
  targetGroup,
  lambdaFunction,
  dynamodbTable,
  iamRole,
  ecrRepository,
  ecsCluster,
  ecsTaskDefinition,
  ecsService,
  secretsManagerSecret,
  ssmParameter,
  sqsQueue,
  snsTopic,
  apiGatewayHttpApi,
  cloudwatchLogGroup,
];

/** Document-wide AWS rules; core's validate() runs them via the registry. */
export const awsValidators: DocumentValidator[] = [
  roleTrustValidator,
  workloadRoleValidator,
  ecsSecretsExecRoleValidator,
  ecsImageSourceValidator,
  lbMultiAzValidator,
];

export function createAwsRegistry(): ResourceRegistry {
  const registry = new ResourceRegistry();
  registry.registerAll(awsResources);
  for (const validator of awsValidators) registry.registerValidator(validator);
  return registry;
}

export {
  vpc,
  subnet,
  internetGateway,
  ec2Instance,
  securityGroup,
  rdsInstance,
  auroraCluster,
  auroraClusterInstance,
  elastiCacheCluster,
  s3Bucket,
  alb,
  nlb,
  targetGroup,
  lambdaFunction,
  dynamodbTable,
  iamRole,
  ecrRepository,
  ecsCluster,
  ecsTaskDefinition,
  ecsService,
  secretsManagerSecret,
  ssmParameter,
  sqsQueue,
  snsTopic,
  apiGatewayHttpApi,
  cloudwatchLogGroup,
};
export { CATEGORY_COLORS, ICON_LABELS } from './icons.js';
export {
  LOCALSTACK_HOBBY_TYPES,
  LOCALSTACK_ULTIMATE_HINT_TYPES,
  LOCALSTACK_UPGRADE_HINT,
  checkLocalstackHobbyCompatibility,
} from './localstack-hobby.js';
export type { HobbyCompatibility, LocalstackCompatibilityOptions } from './localstack-hobby.js';
export { TRUST_PRESET_SERVICES, usesCustomTrustPolicy, roleTrustValidator } from './iam-trust.js';
export { resolveWorkloadRoleId, workloadRoleValidator } from './workload-role.js';
export {
  ecsSecretsExecRoleValidator,
  ecsImageSourceValidator,
  lbMultiAzValidator,
} from './deploy-checks.js';
