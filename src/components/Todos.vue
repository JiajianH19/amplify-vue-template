<script setup lang="ts">
import { ref } from 'vue';
import { get } from 'aws-amplify/api';
// Assuming '@/assets/main.css' is imported globally in main.ts or via a base <style> tag

// Define types for your API responses for better type safety
interface BizFinderResponse {
  error?: string;
  message?: string;
  data: {
    // Add specific data structure here
    uen?: string;
    name?: string;
    ssic?: string;
    // ... other fields
  };
}

const searchType = ref<'UEN' | 'NAME' | 'SSIC'>('UEN');
const searchText = ref('');
// Type searchResults to accept BizFinderResponse or null
const searchResults = ref<BizFinderResponse | null>(null);
const errorMessage = ref('');
const isLoading = ref(false);

// REMOVE apiEndpoint variable from here, it's globally configured in main.ts
// const apiEndpoint = 'https://3o8woigknc.execute-api.ap-southeast-1.amazonaws.com/dev';

async function search() {
  errorMessage.value = '';
  searchResults.value = null;
  isLoading.value = true;

  if (!searchText.value.trim()) {
    errorMessage.value = 'Please enter a search term.';
    isLoading.value = false;
    return;
  }

  try {
    const path = '/company';
    const queryParams = {
      type: searchType.value,
      data: searchText.value.trim(),
    };

    const restOperation = get({
      apiName: "BizFinderAPI", // Use the apiName configured in main.ts
      path: path,
      options: {
        queryParams: queryParams,
        // REMOVE customEndpoint from here. It's handled by apiName.
        // customEndpoint: apiEndpoint, // This line caused TS2353
      }
    });
    
    const { body } = await restOperation.response;
    const rawResponse = await body.json();
    // Type check and cast
    if (rawResponse && typeof rawResponse === 'object') {
      const responseJson = rawResponse as BizFinderResponse;
      console.log('API Response Body:', responseJson);

      if (responseJson.error) {
        errorMessage.value = responseJson.error;
      } else {
        searchResults.value = responseJson;
      }
    } else {
      throw new Error('Invalid response format');
    }

  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('An error occurred during the API call:', error);
    // Type narrow 'error' before accessing its properties (TS18046)
    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'Failed to fetch data. Check browser console.';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <main>
    <h1>My todos</h1> <!-- This looks like it's still from the Todos component, adjust if this is App.vue -->
    <div>
      <!-- Your existing template content for the search form and results -->
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
              <pre>{{ JSON.stringify(searchResults, null, 2) }}</pre>
            </div>
          </div>
        </main>
      </div>
    </div>
  </main>
</template>

<!-- Add your styles if not using a global main.css -->
<style>
/* @import '@/assets/main.css'; /* Uncomment if specific to this component or not globally imported */

/* Your existing styles (or link to global styles) */
#app-container {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.app-header {
  background-color: #42b983;
  color: white;
  padding: 15px 0;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.logo {
  font-size: 2em;
  font-weight: bold;
}

.main-content {
  max-width: 800px;
  width: 90%;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}

.search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.dropdown, .text-input, .search-button {
  padding: 10px 15px;
  border-radius: 5px;
  border: 1px solid #ccc;
  font-size: 1em;
}

.dropdown {
  background-color: white;
  cursor: pointer;
}

.text-input {
  flex-grow: 1;
  min-width: 200px;
}

.search-button {
  background-color: #42b983;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.search-button:hover:not(:disabled) {
  background-color: #36a374;
}

.search-button:disabled {
  background-color: #a0d9b4;
  cursor: not-allowed;
}

.results-container {
  text-align: left;
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 5px;
  background-color: white;
}

.message {
  padding: 10px;
  background-color: #e0f7fa;
  border-left: 5px solid #00bcd4;
  margin-bottom: 10px;
}

.message.error {
  background-color: #ffebee;
  border-left: 5px solid #f44336;
  color: #d32f2f;
}

pre {
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 5px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>