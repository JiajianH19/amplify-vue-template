<template>
  <div id="app-container">
    <header class="app-header">
      <span class="logo">BizFinder</span>
    </header>

    <main class="main-content">
      <div class="search-box">
        <select v-model="searchType" class="dropdown">
          <option value="UEN">UEN</option>
          <option value="NAME">Name</option>
          <option value="SSIC">SSIC Code</option>
        </select>

        <input
          type="text"
          v-model="searchText"
          @keyup.enter="search"
          placeholder="Enter search term..."
          class="text-input"
        />

        <button @click="search" :disabled="isLoading" class="search-button">
          {{ isLoading ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <!-- Results Display Area -->
      <div class="results-container">
        <div v-if="isLoading" class="message">Loading...</div>
        <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
        <div v-if="searchResults">
          <h3>Raw JSON Response:</h3>
          <pre>{{ searchResults }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { get } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';

export default {
  name: 'App',
  data() {
    return {
      searchType: 'UEN',
      searchText: '',
      searchResults: null,
      errorMessage: '',
      isLoading: false,
    };
  },
  methods: {
    async search() {
      this.errorMessage = '';
      this.searchResults = null;
      this.isLoading = true;

      if (!this.searchText.trim()) {
        this.errorMessage = 'Please enter a search term.';
        this.isLoading = false;
        return;
      }

      try {
        const config = Amplify.getConfig();
        const apiConfig = config.custom.BizFinderAPI;

        if (!apiConfig || !apiConfig.URL) {
          throw new Error("API configuration not found. Ensure 'npx amplify sandbox' is running.");
        }
        
        const path = '/company';
        const queryParams = {
          type: this.searchType,
          data: this.searchText.trim(),
        };

        const restOperation = get({
          apiName: "BizFinderAPI_placeholder",
          path: path,
          options: {
            queryParams: queryParams,
            customEndpoint: apiConfig.URL,
          }
        });
        
        const { body } = await restOperation.response;
        const responseJson = await body.json();

        console.log('API Response Body:', responseJson);

        if (responseJson.error) {
          this.errorMessage = responseJson.error;
        } else {
          this.searchResults = responseJson;
        }

      } catch (error) {
        console.error('An error occurred during the API call:', error);
        this.errorMessage = error.message || 'Failed to fetch data. Check browser console.';
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6f8; }
  #app-container { display: flex; flex-direction: column; min-height: 100vh; }
  .app-header { background-color: #fff; padding: 10px 30px; border-bottom: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .logo { font-size: 1.5rem; font-weight: bold; color: #007bff; }
  .main-content { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
  .search-box { display: flex; align-items: center; gap: 10px; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 600px; }
  .dropdown, .text-input { padding: 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
  .text-input { flex-grow: 1; }
  .search-button { padding: 12px 20px; border: none; border-radius: 4px; background-color: #007bff; color: white; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; }
  .search-button:hover:not(:disabled) { background-color: #0056b3; }
  .search-button:disabled { background-color: #cccccc; cursor: not-allowed; }
  .results-container { margin-top: 30px; width: 100%; max-width: 600px; text-align: center; }
  .message { font-size: 1.1rem; color: #555; }
  .message.error { color: #dc3545; font-weight: bold; }
  pre { background-color: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; text-align: left; white-space: pre-wrap; word-wrap: break-word; }
</style>