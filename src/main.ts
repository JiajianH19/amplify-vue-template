import { createApp } from 'vue';
import App from './App.vue';
import { Amplify } from 'aws-amplify';

// API Gateway endpoint
const API_GATEWAY_URL = 'https://3o8woigknc.execute-api.ap-southeast-1.amazonaws.com/dev';

Amplify.configure({
  API: {
    REST: {
      BizFinderAPI: {
        endpoint: API_GATEWAY_URL,
        region: 'ap-southeast-1',
        custom_header: async () => {
          return {}  // Add any custom headers if needed
        }
      },
    },
  },
});

createApp(App).mount('#app');