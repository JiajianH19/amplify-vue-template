import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';

const API_URL = 'https://3o8woigknc.execute-api.ap-southeast-1.amazonaws.com/dev';

// Validate API URL format
if (!API_URL.match(/^https:\/\/.+\.execute-api\..+\.amazonaws\.com\/.+$/)) {
  throw new Error('Invalid API Gateway URL format');
}

const backend = defineBackend({});

backend.addOutput({
  custom: {
    BizFinderAPI: {
      REGION: Stack.of(backend.stack).region,
      URL: API_URL,
      // Add API version for future compatibility
      VERSION: '1.0.0'
    }
  }
});