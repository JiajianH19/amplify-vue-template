<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { get } from 'aws-amplify/api';
import dnbLogo from '@/assets/dnb-logo.svg';

// --- Interfaces and Type Guards ---
interface BusinessData {
  DATA_TYPE: string;
  UEN: string;
  ENTITY_NAME: string;
  ENTITY_TYPE_DESCRIPTION: string;
  BUSINESS_CONSTITUTION_DESCRIPTION: string | null;
  PRIMARY_SSIC_CODE: string;
  ENTITY_STATUS_DESCRIPTION: string;
  REGISTRATION_INCORPORATION_DATE: string;
}

interface SsicSummaryData {
  DATA_TYPE: string;
  SSIC: string;
  TOTAL_COUNT: number;
}

// NEW: Interface for the multiple company response from a NAME search
interface MultipleCompanyResponse {
  DATA_TYPE: 'MULTIPLE_COM';
  COMPANY_LIST: BusinessData[];
}

// MODIFIED: Renamed from BizFinderResponse to be more generic
interface SearchResultWrapper {
  type: string;
  data: BusinessData | SsicSummaryData | MultipleCompanyResponse;
}

// MODIFIED: Renamed for clarity to handle any single company record
const isSingleCompanyResponse = (data: unknown): data is BusinessData => {
  if (!data || typeof data !== 'object') return false;
  const response = data as any;
  return 'UEN' in response && 'ENTITY_NAME' in response && 'DATA_TYPE' in response;
};

const isSsicSummaryResponse = (data: unknown): data is SsicSummaryData => {
  if (!data || typeof data !== 'object') return false;
  const response = data as any;
  return 'SSIC' in response && 'TOTAL_COUNT' in response;
};

// NEW: Type guard for the multiple company response
const isMultipleCompanyResponse = (data: unknown): data is MultipleCompanyResponse => {
  if (!data || typeof data !== 'object') return false;
  const response = data as any;
  return response.DATA_TYPE === 'MULTIPLE_COM' && Array.isArray(response.COMPANY_LIST);
};


// --- Component State ---
const searchType = ref<'UEN' | 'NAME' | 'SSIC'>('UEN');
const searchText = ref('');
// MODIFIED: Updated the type to use the new wrapper
const searchResults = ref<SearchResultWrapper | null>(null);
const errorMessage = ref('');
const isLoading = ref(false);

// NEW: State for handling the selection from a list of companies
const selectedCompanyDetails = ref<BusinessData | null>(null);
const isLoadingDetails = ref(false); // Spinner for when fetching details after a click

// --- State for Custom Dropdown ---
const isDropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const dropdownOptions = [
  { value: 'UEN', label: 'UEN' },
  { value: 'NAME', label: 'Name' },
  { value: 'SSIC', label: 'SSIC' }
] as const;

const toggleDropdown = () => isDropdownOpen.value = !isDropdownOpen.value;

const selectOption = (option: { value: 'UEN' | 'NAME' | 'SSIC'; label: string }) => {
  searchType.value = option.value;
  isDropdownOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false;
  }
};
onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside));

// MODIFIED: Update reset function to clear new state properties
function resetResults() {
  searchResults.value = null;
  errorMessage.value = '';
  selectedCompanyDetails.value = null; // Also reset the selected company
}

// --- API Logic ---
async function search() {
  resetResults();
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
      apiName: "BizFinderAPI",
      path: path,
      options: { queryParams: queryParams }
    });
    
    const { body } = await restOperation.response;
    const rawResponse = await body.json();

    // MODIFIED: Re-ordered checks to handle the new NAME search responses first
    if (isMultipleCompanyResponse(rawResponse)) {
      searchResults.value = {
        type: 'MULTIPLE_COM',
        data: rawResponse
      };
    } else if (isSsicSummaryResponse(rawResponse)) {
      searchResults.value = {
        type: 'SSIC',
        data: rawResponse
      };
    } else if (isSingleCompanyResponse(rawResponse)) {
      searchResults.value = {
        // This covers both a direct UEN search and a NAME search that returns a SINGLE_COM
        type: searchType.value === 'UEN' ? 'UEN' : 'SINGLE_COM',
        data: rawResponse
      };
    } else {
      if (rawResponse && typeof rawResponse === 'object' && 'message' in rawResponse) {
        errorMessage.value = (rawResponse as { message: string }).message;
      } else {
        errorMessage.value = 'No results found or invalid response format.';
      }
    }
  } catch (error: unknown) {
    console.error('An error occurred during the API call:', error);
    
    if ((error as any)?.response?.statusCode === 404) {
      errorMessage.value = "No Live Company Found";
    }
    else if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.';
    }
  } finally {
    isLoading.value = false;
  }
}

// NEW: Function to fetch details for a specific company when clicked from the list
async function getCompanyDetailsByUen(uen: string) {
  isLoadingDetails.value = true;
  selectedCompanyDetails.value = null; // Clear any previous selection
  // Don't clear the main error message, as it might be relevant

  try {
    const restOperation = get({
      apiName: "BizFinderAPI",
      path: '/company',
      options: {
        queryParams: {
          type: 'UEN', // Always search by UEN for details
          data: uen,
        }
      }
    });

    const { body } = await restOperation.response;
    const rawResponse = await body.json();

    if (isSingleCompanyResponse(rawResponse)) {
      selectedCompanyDetails.value = rawResponse;
    } else {
       // You could set a specific error message for this sub-action if needed
      console.error("Could not fetch details for UEN:", uen);
    }
  } catch (error) {
    console.error('An error occurred while fetching company details:', error);
    // Optionally set an error message
  } finally {
    isLoadingDetails.value = false;
  }
}
</script>

<template>
  <main class="hero-container">
    <div class="logo-container">
      <img :src="dnbLogo" alt="Dun & Bradstreet Logo" class="logo-image" />
    </div>

    <div class="blob blob1"></div>
    <div class="blob blob2"></div>
    <div class="blob blob3"></div>

    <div class="content-wrapper">
      <div class="headings">
        <h1 class="title">BizFinder</h1>
        <h2 class="subtitle">Find Business Information Instantly.</h2>
      </div>

      <div class="search-box-unified" @click="resetResults">
        <div class="custom-dropdown" ref="dropdownRef">
          <button @click="toggleDropdown" class="dropdown-toggle">
            {{ searchType }}
          </button>
          <ul v-if="isDropdownOpen" class="dropdown-menu">
            <li 
              v-for="option in dropdownOptions" 
              :key="option.value"
              @click="selectOption(option)"
              class="dropdown-item"
            >
              {{ option.label }}
            </li>
          </ul>
        </div>
        
        <input
          type="text"
          v-model="searchText"
          @keyup.enter="search"
          placeholder="Enter search term..."
          class="text-input-unified"
        />

          <button @click="search" :disabled="isLoading" class="search-icon-button">
          <svg v-if="isLoading" class="spinner-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="search-icon-svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
      </div>

      <div v-if="isLoading" class="loading-spinner-container">
        <div class="spinner-outer"></div>
      </div>

      <div v-if="!isLoading && (errorMessage || searchResults)" class="results-container-glass">
        <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
        
        <div v-if="searchResults">
          <h3>Search Result</h3>

          <!-- SSIC Result Display -->
          <ul v-if="'SSIC' in searchResults.data" class="results-list">
            <li>
              <strong>SSIC CODE:</strong>
              <span>{{ (searchResults.data as SsicSummaryData).SSIC }}</span>
            </li>
            <li>
              <strong>Total Companies:</strong>
              <span>{{ (searchResults.data as SsicSummaryData).TOTAL_COUNT }}</span>
            </li>
          </ul>

          <!-- NEW: Multiple Company List Display -->
          <div v-else-if="'COMPANY_LIST' in searchResults.data">
            <div class="company-list-header">
              <span>UEN</span>
              <span>ENTITY NAME</span>
            </div>
            <ul class="company-list-clickable">
              <li
                v-for="company in (searchResults.data as MultipleCompanyResponse).COMPANY_LIST"
                :key="company.UEN"
                @click="getCompanyDetailsByUen(company.UEN)"
                class="company-list-item"
              >
                <span>{{ company.UEN }}</span>
                <span>{{ company.ENTITY_NAME }}</span>
              </li>
            </ul>
          </div>

          <!-- Single Company Result (from UEN or SINGLE_COM search) -->
          <ul v-else class="results-list">
            <li>
              <strong>UEN:</strong>
              <span>{{ (searchResults.data as BusinessData).UEN }}</span>
            </li>
            <li>
              <strong>ENTITY NAME:</strong>
              <span>{{ (searchResults.data as BusinessData).ENTITY_NAME }}</span>
            </li>
            <li>
              <strong>ENTITY TYPE DESCRIPTION:</strong>
              <span>{{ (searchResults.data as BusinessData).ENTITY_TYPE_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>BUSINESS CONSTITUTION DESCRIPTION:</strong>
              <span>{{ (searchResults.data as BusinessData).BUSINESS_CONSTITUTION_DESCRIPTION || 'N/A' }}</span>
            </li>
            <li>
              <strong>PRIMARY SSIC CODE:</strong>
              <span>{{ (searchResults.data as BusinessData).PRIMARY_SSIC_CODE }}</span>
            </li>
            <li>
              <strong>ENTITY STATUS DESCRIPTION:</strong>
              <span>{{ (searchResults.data as BusinessData).ENTITY_STATUS_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>REGISTRATION INCORPORATION DATE:</strong>
              <span>{{ (searchResults.data as BusinessData).REGISTRATION_INCORPORATION_DATE }}</span>
            </li>
          </ul>
        </div>
        
        <!-- NEW: Section to display details of a company selected from the list -->
        <div v-if="isLoadingDetails" class="loading-spinner-container">
          <div class="spinner-outer"></div>
        </div>
        <div v-if="selectedCompanyDetails" class="selected-details-container">
          <h4 class="details-heading">Company Details</h4>
          <ul class="results-list">
            <li>
              <strong>UEN:</strong>
              <span>{{ selectedCompanyDetails.UEN }}</span>
            </li>
            <li>
              <strong>ENTITY NAME:</strong>
              <span>{{ selectedCompanyDetails.ENTITY_NAME }}</span>
            </li>
            <li>
              <strong>ENTITY TYPE DESCRIPTION:</strong>
              <span>{{ selectedCompanyDetails.ENTITY_TYPE_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>BUSINESS CONSTITUTION DESCRIPTION:</strong>
              <span>{{ selectedCompanyDetails.BUSINESS_CONSTITUTION_DESCRIPTION || 'N/A' }}</span>
            </li>
            <li>
              <strong>PRIMARY SSIC CODE:</strong>
              <span>{{ selectedCompanyDetails.PRIMARY_SSIC_CODE }}</span>
            </li>
            <li>
              <strong>ENTITY STATUS DESCRIPTION:</strong>
              <span>{{ selectedCompanyDetails.ENTITY_STATUS_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>REGISTRATION INCORPORATION DATE:</strong>
              <span>{{ selectedCompanyDetails.REGISTRATION_INCORPORATION_DATE }}</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  </main>

  <!-- Footer remains unchanged -->
  <footer class="footer-container">
    <!-- ... footer content ... -->
  </footer>
</template>

<style>
/* --- Base and Layout --- */
body { margin: 0; font-family: Avenir, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.hero-container { position: relative; min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; overflow: hidden; background: linear-gradient(to bottom right, #EEF2FF, #EFF6FF, #ECFEFF); }
.content-wrapper { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 25px; width: 100%; max-width: 800px; text-align: center; }

/* --- Logo --- */
.logo-container { position: absolute; top: 2rem; left: 2.5rem; z-index: 10; }
.logo-image { height: 35px; width: auto; }

/* --- Typography --- */
.headings { color: #1e3a8a; }
.title { font-size: 3.5rem; font-weight: 800; margin: 0; background: linear-gradient(to right, #13293d, #006494, #87bfff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-fill-color: transparent; }
.subtitle { font-size: 1.5rem; font-weight: 400; margin-top: 10px; color: #374151; }

/* --- Unified Search Box --- */
.search-box-unified {
  display: flex;
  align-items: center;
  width: 80%;
  max-width: 600px;
  backdrop-filter: blur(12px);
  border: 2px solid #c4c1e0;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  background: white;
  border-radius: 50px;
  transition: border-color 0.2s;
}
.search-box-unified:focus-within { border-color: #8dc6ff; }
.custom-dropdown { position: relative; flex-shrink: 0; }
.dropdown-toggle { background: transparent; border: none; border-right: 1px solid rgba(0, 0, 0, 0.1); background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.2em 1.2em; padding: 15px 45px 15px 20px; font-size: 1.1rem; font-family: inherit; outline: none; color: #1f2937; cursor: pointer; text-align: left; }
.text-input-unified {
  background: transparent;
  border: none;
  /* Adjust padding to make space for the button */
  padding: 15px 5px 15px 20px;
  width: 100%;
  flex-grow: 1;
  font-size: 1.1rem;
  outline: none;
  color: #1f2937;
}
custom-dropdown { position: relative; flex-shrink: 0; }
.text-input-unified::placeholder { color: #6b7280; }
.dropdown-menu { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; list-style: none; padding: 8px; margin: 0; z-index: 10; border-radius: 12px; overflow: hidden; backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); background: rgba(255, 255, 255, 0.7); }
.dropdown-item { padding: 10px 15px; cursor: pointer; border-radius: 8px; transition: background-color 0.2s ease; color: #1f2937; }
.dropdown-item:hover { background-color: rgba(59, 130, 246, 0.1); }

/* --- Other Buttons and Containers --- */
.search-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  height: 100%;
}
.search-icon-svg, .spinner-icon-svg {
  width: 24px;
  height: 24px;
  color: #6b7280;
  transition: color 0.2s ease;
}
.search-icon-button:hover:not(:disabled) .search-icon-svg {
  color: #1f2937;
}
.search-icon-button:disabled {
  cursor: not-allowed;
}
.spinner-icon-svg {
  animation: spin 1s linear infinite;
}
.results-container-glass { backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 16px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.6); width: 95%; padding: 20px; color: #1f2937; text-align: left; margin-top: 20px; }
.results-container-glass h3 { margin-top: 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1); padding-bottom: 10px; font-size: 1.5rem; }
.results-list { list-style-type: none; padding: 0; margin: 0; }
.results-list li { display: flex; justify-content: space-between; padding: 12px 5px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); }
.results-list li:last-child { border-bottom: none; }
.results-list li strong { text-transform: capitalize; margin-right: 15px; color: #4b5563; }
.message.error { background-color: rgba(254, 226, 226, 0.8); border-left: 5px solid #ef4444; padding: 15px; border-radius: 8px; color: #991b1b; font-weight: 500; }

/* NEW: Styles for the clickable company list */
.company-list-header {
  display: grid;
  grid-template-columns: 1fr 2fr;
  padding: 10px 15px;
  font-weight: bold;
  color: #4b5563;
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}
.company-list-clickable {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
.company-list-item {
  display: grid;
  grid-template-columns: 1fr 2fr;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.company-list-item:hover {
  background-color: rgba(59, 130, 246, 0.1);
}
.company-list-item:last-child {
  border-bottom: none;
}

/* NEW: Styles for the selected company details section */
.selected-details-container {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.details-heading {
  margin-top: 0;
  font-size: 1.25rem;
  color: #1e3a8a;
}

/* --- Animations --- */
.loading-spinner-container { margin-top: 20px; display:flex; justify-content: center;}
.spinner-outer { width: 40px; height: 40px; border: 4px solid rgba(0, 0, 0, 0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
.blob { position: absolute; border-radius: 50%; mix-blend-mode: multiply; filter: blur(70px); z-index: 1; }
.blob1 { width: 250px; height: 250px; top: 15%; left: 20%; background: rgba(0, 94, 184, 0.2); animation: blob 8s infinite; }
.blob2 { width: 300px; height: 300px; top: 30%; right: 25%; background: rgba(0, 120, 212, 0.2); animation: blob 10s infinite reverse; }
.blob3 { width: 200px; height: 200px; bottom: 15%; left: 30%; background: rgba(0, 165, 224, 0.2); animation: blob 7s infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }

/* --- Responsive Styles --- */
@media (max-width: 768px) {
  .logo-container { top: 1.5rem; right: 1.5rem; }
  .logo-image { height: 28px; }
  .company-list-header, .company-list-item {
    grid-template-columns: 1fr;
    gap: 5px;
    padding: 10px;
  }
  .company-list-item span:first-child {
    font-weight: bold;
  }
}

/* --- Footer Styles --- */
/* ... All existing footer styles remain unchanged ... */
</style>