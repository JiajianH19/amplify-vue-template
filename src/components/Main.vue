<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { get } from 'aws-amplify/api';
import dnbLogo from '@/assets/sccb-logo.png';

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
// NEW: State for Toast Notification
const showNotification = ref(false);
const notificationMessage = ref('');
let notificationTimer: number | null = null; // To hold the timer ID

const searchType = ref<'UEN' | 'NAME' | 'SSIC'>('UEN');
const searchText = ref('');
// MODIFIED: Updated the type to use the new wrapper
const searchResults = ref<SearchResultWrapper | null>(null);
const errorMessage = ref('');
const isLoading = ref(false);

// NEW: State for handling the selection from a list of companies
const selectedCompanyDetails = ref<BusinessData | null>(null);
const isLoadingDetails = ref(false); // Spinner for when fetching details after a click

// NEW: State for pagination
const currentPage = ref(1);
const itemsPerPage = ref(10); // You can change this value to show more/less items per page

// --- State for Custom Dropdown ---
const isDropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// NEW: State to control the visibility of the main headings
const showHeadings = ref(true);

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
  showHeadings.value = true;
  searchResults.value = null;
  errorMessage.value = '';
  selectedCompanyDetails.value = null; // Also reset the selected company
  currentPage.value = 1; // Reset to the first page on new search
}

// --- NEW: Computed Properties for Pagination ---
const totalPages = computed(() => {
  if (searchResults.value?.type === 'MULTIPLE_COM' && 'COMPANY_LIST' in searchResults.value.data) {
    return Math.ceil(searchResults.value.data.COMPANY_LIST.length / itemsPerPage.value);
  }
  return 0;
});

const paginatedCompanyList = computed(() => {
  if (searchResults.value?.type === 'MULTIPLE_COM' && 'COMPANY_LIST' in searchResults.value.data) {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return searchResults.value.data.COMPANY_LIST.slice(start, end);
  }
  return [];
});


// --- NEW: Pagination Navigation Functions ---
function goToPage(pageNumber: number) {
  if (pageNumber >= 1 && pageNumber <= totalPages.value) {
    currentPage.value = pageNumber;
  }
}
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}
function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

// --- API Logic ---
async function search() {
  resetResults();
  showHeadings.value = false;
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
    // NEW: Trigger the notification after every search completes
    triggerNotification('For detailed reports on any of these companies, please <a href="https://sccb.com.sg/contact-us/" target="_blank" rel="noopener noreferrer">contact us</a>.');
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

// MODIFIED: Function to show the persistent notification
function triggerNotification(message: string) {
  notificationMessage.value = message;
  showNotification.value = true;
}

function handleNotificationClick(event: MouseEvent) {
  // We check if the element that was clicked is an <a> tag.
  // The 'as HTMLElement' is a type assertion to help TypeScript.
  if ((event.target as HTMLElement).tagName === 'A') {
    // If it is, we hide the notification.
    showNotification.value = false;
  }
}
</script>

<template>
  <div class="page-layout">
    <header class="page-header">
      <div class="logo-container">
        <img :src="dnbLogo" alt="Dun & Bradstreet Logo" class="logo-image" />
      </div>

      <nav class="header-nav">
        <a href="https://sccb.com.sg/contact-us/" target="_blank" rel="noopener noreferrer" class="contact-us-link">
          Contact Us
        </a>
      </nav>
    </header>

    <main class="main-content">

      <!-- NEW: A dedicated container for the blobs that will have overflow: hidden -->
      <div class="blobs-container">
        <div class="blob blob1"></div>
        <div class="blob blob2"></div>
        <div class="blob blob3"></div>
        <div class="blob blob4"></div>
      </div>

    <div class="content-wrapper">
      <Transition name="fade-slide">
        <div v-if="showHeadings" class="headings">
          <h1 class="title">Data Vault</h1>
          <h2 class="subtitle">Find <span class="subtitle-color-contrast">Business</span> Information Instantly.</h2>
        </div>
      </Transition>

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

          <button @click.stop="search" :disabled="isLoading" class="search-icon-button">
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

      <Teleport to="body">
        <!-- NEW WRAPPER DIV -->
        <div v-if="showNotification" class="toast-wrapper">
          <Transition name="toast-fade">
            <!-- NOTE: the v-if is now on the wrapper, not the notification itself -->
            <div class="toast-notification" @click="handleNotificationClick">
              <span v-html="notificationMessage"></span>
              <button @click.stop="showNotification = false" class="toast-close-button">
                &times;
              </button>
            </div>
          </Transition>
        </div>
      </Teleport>

      <div 
        v-if="!isLoading && (errorMessage || searchResults || selectedCompanyDetails)" 
        class="results-container-glass"
        :class="{ 'is-blurred': showNotification }"
      >        
      <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>
        
        <!-- NEW STRUCTURE: START -->

        <!-- VIEW 1: DETAILS VIEW (Shows loading spinner or the final details) -->
        <!-- This block is checked FIRST. -->
        <div v-if="isLoadingDetails" class="loading-spinner-container">
          <div class="spinner-outer"></div>
        </div>
        <div v-else-if="selectedCompanyDetails" class="selected-details-container">
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

        <!-- VIEW 2: INITIAL SEARCH RESULTS (List, SSIC, or Single UEN) -->
        <!-- This block is checked SECOND, only if the details view is not active. -->
        <div v-else-if="searchResults">
          <h3 class="search-result-header-color">Search Result</h3>

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

          <!-- Multiple Company List Display -->
          <div v-else-if="'COMPANY_LIST' in searchResults.data">
            <div class="company-list-header">
              <span>UEN</span>
              <span>ENTITY NAME</span>
            </div>
            <ul class="company-list-clickable">
              <li
                v-for="company in paginatedCompanyList"
                :key="company.UEN"
                @click="getCompanyDetailsByUen(company.UEN)"
                class="company-list-item"
              >
                <span>{{ company.UEN }}</span>
                <span>{{ company.ENTITY_NAME }}</span>
              </li>
            </ul>
            
            <div v-if="totalPages > 1" class="pagination-controls">
              <button @click="prevPage" :disabled="currentPage === 1" class="pagination-button">
                &laquo; Prev
              </button>
              <span class="pagination-info">Page {{ currentPage }} of {{ totalPages }}</span>
              <button @click="nextPage" :disabled="currentPage === totalPages" class="pagination-button">
                Next &raquo;
              </button>
            </div>
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
        <!-- NEW STRUCTURE: END -->

      </div>
    </div>
  </main>

  <footer class="footer-container">
    <div class="footer-content">
      <!-- This is the empty spacer column on the left -->
      <div class="footer-column footer-spacer-left"></div>
      <!-- Customer Service Column -->
      <div class="footer-column footer-customer-service">
        <h3 class="footer-heading">Customer Service & Support</h3>
        <div class="footer-links-container">
          <div class="footer-links">
            <a href="tel:+6564396603">(+65) 6439 6603</a>
            <a href="tel:+6565656161">(+65) 6565 6161</a>
            <a href="mailto:csc@sccb.com.sg">csc@sccb.com.sg</a>
            <a href="https://sccb.com.sg/contact-us/">Contact us</a>
          </div>
        </div>
      </div>

      <!-- Office Address Column -->
      <div class="footer-column footer-office-address">
        <h3 class="footer-heading">Office Address</h3>
        <div class="footer-text-group">
          <p>6 Shenton Way</p>
          <p>OUE Downtown 2,</p>
          <p>#17-10</p>
          <p>Singapore 068809</p>
        </div>
      </div>

      <!-- Business Hours Column -->
      <div class="footer-column footer-business-hours">
        <h3 class="footer-heading">Business Hours</h3>
        <div class="footer-text-group">
          <p>Monday to Friday, 8.30am to 6pm.</p>
          <p>Closed on Weekends and Public Holidays.</p>
        </div>
      </div>

      <!-- This is the empty spacer column on the right -->
      <div class="footer-column footer-spacer-right"></div>
    </div>
  </footer>

  </div>
</template>

<style>
/* --- Base and Layout --- */
body { margin: 0; font-family: Avenir, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.hero-container { position: relative; min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; overflow: hidden;  }

.page-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(to bottom, #FFFFFF, #FFFFFF, #FFFFFF);

}

.page-header {
  padding: 2rem 2.5rem; /* Symmetrical padding for better alignment */
  flex-shrink: 0;
  position: relative; 
  z-index: 1;
  display: flex; /* ADDED: Turns the header into a flex container */
  justify-content: space-between; /* ADDED: Pushes logo left, link right */
  align-items: center; /* ADDED: Vertically aligns logo and link */
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('@/assets/header-background.jpg') no-repeat top / cover;
  opacity: 0.5; /* Opacity ONLY lives here */
  z-index: -1;  /* This pushes it to the back */
}

.page-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px; /* Adjust the height of the fade here */
  background: linear-gradient(to top, #ffffff, rgba(255, 255, 255, 0));
}

/* MODIFIED: Replaced .hero-container with .main-content */
.main-content {
  flex-grow: 1; 
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.content-wrapper { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 25px; width: 100%; max-width: 800px; text-align: center; }


/* .logo-container { position: absolute; top: 2rem; left: 2.5rem; z-index: 10; } */
.logo-image { height: 60px; width: auto; }
.logo-container { 
  /* Add these two lines */
  position: relative;
  z-index: 1; /* This ensures it's on a higher "layer" than the ::before element */
}

.header-nav {
  position: relative;
  z-index: 1; /* Ensures it sits above the background pseudo-element */
}

.contact-us-link {
  /* --- Button Appearance --- */
  background-color: #FB4141; /* Light red background by default */
  /*border: 0.5px solid #FB4141; /* Brand red border by default */

  color: white; /* Brand red text color by default */
  
  text-decoration: none ;
  font-weight: 650;
  font-size: 0.9rem; 
  padding: 10px 15px; /* Adjust padding for a good button shape */
  border-radius: 8px;
  transition: all 0.2s ease-in-out;

}

.contact-us-link:hover {
  background-color: #E83102; /* Fill with brand red on hover */
  color: white; /* Make text white for contrast */
  transform: translateY(-2px); /* Slight lift effect on hover */
}

/* --- Typography --- */
.headings { color: #1e3a8a; }
.title { font-size: 3.5rem; font-weight: 800; margin: 0; background: #FB4141; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-fill-color: transparent; }
.subtitle { font-size: 1.5rem; font-weight: 400; margin-top: 10px; color: #374151; }
.subtitle-color-contrast {color: #FB4141; font-weight:900}
.search-result-header-color {color: #FB4141}

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
.search-box-unified:focus-within { border-color: #F15A59; }
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
.dropdown-menu { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; list-style: none; padding: 8px; margin: 0; z-index: 10; border-radius: 12px; overflow: hidden; backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); background: rgba(255, 255, 255, 1); }
.dropdown-item { padding: 10px 15px; cursor: pointer; border-radius: 8px; transition: background-color 0.2s ease; color: #1f2937; }
.dropdown-item:hover { background-color: #FEF2F4; }

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
  background-color: #FEF2F4;
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
  color: #FB4141;
}

/* --- Animations --- */
.loading-spinner-container { margin-top: 20px; display:flex; justify-content: center;}
.spinner-outer { width: 40px; height: 40px; border: 4px solid rgba(0, 0, 0, 0.1); border-top-color: #F15A59; border-radius: 50%; animation: spin 1s linear infinite; }
/* NEW: Add these styles for the new blobs container */
.blobs-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden; /* The overflow property now lives here! */
  z-index: 1; /* Sits behind the content-wrapper */
}
.blob { position: absolute; border-radius: 50%; mix-blend-mode: multiply; filter: blur(70px); z-index: 1; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }

/* --- Responsive Styles --- */
@media (max-width: 768px) {
  .logo-container { top: 1.5rem; right: 1.5rem; }
  .logo-image { height: 30px; }
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
/* General styles for the footer container */
.footer-container {
  background-color: #ffffff; /* From: bg-white */
  padding-top: 4rem;      /* From: py-12 */
  padding-bottom: 3rem;   /* From: py-12 */
}

/* The main flexbox layout for the content */
.footer-content {
  display: flex;          /* From: flex */
  flex-direction: row;    /* From: flex-row */
  justify-content: space-around; /* From: justify-around */
}

/* A base style for all columns inside the footer */
.footer-column {
  display: flex;          /* From: flex */
  flex-direction: column; /* From: flex-col */
  gap: 1rem;              /* From: gap-4 */
}

/* Specific widths and paddings for each column */
.footer-spacer-left { width: 8%; }
.footer-customer-service { width: 32%; padding-left: 0.7rem; }
.footer-office-address { width: 23%; padding-left: 0.8rem; }  
.footer-business-hours { width: 29%; padding-left: 0.9rem; }  
.footer-spacer-right { width: 4%; }

/* Styling for the headings (h3) */
.footer-heading {
  font-size: 1.25rem;      /* From: text-xl */
  font-weight: 700;        /* From: font-bold */
  color: #1f2937;          /* From: text-gray-800 */
  border-left: 2px solid #F15A59; /* From: border-l-2 (color is a standard gray) */
  padding-left: 0.5rem;    /* From: pl-2 */
  margin: 0;
}

/* Container for the contact links */
.footer-links-container {
  display: flex;           /* From: flex */
  gap: 2rem;               /* From: gap-8 */
}

/* Styling for the group of links */
.footer-links {
  display: flex;           /* From: flex */
  flex-direction: column;  /* From: flex-col */
  gap: 0.5rem;             /* From: gap-2 */
  color: #4b5563;          /* From: text-gray-600 */
}

/* Styling for the links themselves */
.footer-links a {
  color: inherit; /* Ensures the link takes the color of its parent */
  text-decoration: none; /* A common practice for footer links */
  transition: color 0.2s ease-in-out; /* Adds a smooth color change on hover */
}

/* Hover effect for the links */
.footer-links a:hover {
  color: #111827;          /* From: hover:text-gray-900 */
}

/* Styling for the address and hours text blocks */
.footer-text-group {
  display: flex;           /* From: flex */
  flex-direction: column;  /* From: flex-col */
  gap: 0.25rem;            /* From: gap-1 */
  color: #4b5563;          /* From: text-gray-600 */
}

/* Tailwind resets margins on paragraphs, so we should do the same */
.footer-text-group p {
  margin: 0;
}

@media (max-width: 768px) {

  /* 1. Change the main container to stack columns vertically */
  .footer-content {
    flex-direction: column; /* Stack items vertically instead of in a row */
    align-items: center;    /* Center the stacked columns horizontally */
    gap: 2.5rem;            /* Increase the space between the stacked items */
  }

  /* 2. Make each content column take up more width and center its text */
  .footer-column {
    width: 90%;             /* Allow each column to be much wider */
    max-width: 400px;       /* But not too wide on a tablet */
    text-align: center;     /* Center the text content within each column */
    padding-left: 0;        /* Remove the desktop-specific left padding */
  }

  /* 3. Adjust the headings for a vertical layout */
  .footer-heading {
    border-left: none;              /* Remove the vertical border on the side */
    padding-left: 0;                /* Remove the side padding */
    border-bottom: 2px solid #F15A59; /* Add a horizontal border underneath instead */
    padding-bottom: 0.75rem;        /* Add some space below the heading text */
  }

  /* 4. Center the block of contact links */
  .footer-links-container {
    justify-content: center; /* Centers the links block within its container */
  }

  /* 5. Hide the empty spacer columns, as they are not needed on mobile */
  .footer-spacer-left,
  .footer-spacer-right {
    display: none;
  }
}

/* NEW: Styles for Pagination Controls */
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.pagination-button {
  background-color: transparent;
  border: 1px solid #3b82f6;
  color: #3b82f6;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}
.pagination-button:hover:not(:disabled) {
  background-color: #3b82f6;
  color: white;
}
.pagination-button:disabled {
  border-color: #9ca3af;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}
.pagination-info {
  color: #4b5563;
  font-weight: 500;
}

/*
  Defines the properties to be animated (opacity and transform) and the duration/easing.
  This class is active during the entire enter/leave animation.
*/
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

/*
  Defines the starting state for the enter animation (when it appears)
  and the final state for the leave animation (when it disappears).
  The element will be transparent and slightly moved up.
*/
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* NEW: Flexbox wrapper to force centering */
.toast-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* Make it sit on top of everything, but below the toast if needed */
  z-index: 999; 
  /* Prevent clicks on the wrapper itself */
  pointer-events: none; 
}

/* MODIFIED: Styles for Centered Toast Notification */
.toast-notification {
  /* Positioning and Stacking Context */
  z-index: 1000;
  pointer-events: auto; /* Re-enable clicks on the notification */

  /* Layout */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  
  /* MODIFIED Sizing */
  width: 90%;
  max-width: 600px;
  min-height: 40px;
  
  /* Appearance */
  background-color: rgba(255, 255, 255, 0.9);
  color: #1f2937;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  /* The default border is no longer needed, you can remove it or keep it */
  border: 1px solid rgba(0, 0, 0, 0.05); 
  font-weight: 500;
}

/* --- Styles for Custom Corner Borders on Toast --- */

/* Top-Left Corner Border */
.toast-notification::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 40px; 
  height: 40px;
  border-top: 3px solid #FB4141;
  border-left: 3px solid #FB4141;
  border-top-left-radius: 8px;
}

/* Bottom-Right Corner Border */
.toast-notification::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40px;
  height: 40px;
  border-bottom: 3px solid #FB4141;
  border-right: 3px solid #FB4141;
  border-bottom-right-radius: 8px;
}

/* NEW: Styles for the close button */
.toast-close-button {
  position: relative; /* Establishes a stacking context */
  z-index: 2;         /* Lifts the button to a higher layer */
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font-size: 1.75rem; /* Makes the '×' larger and easier to click */
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  transition: color 0.2s ease;
}

.toast-close-button:hover {
  color: #1f2937; /* Darker on hover */
}

/* NEW: Vue Transition classes for the toast */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* NEW: Style for the link inside the toast notification */
.toast-notification a {
  color: #FB4141; /* Your primary brand red */
  font-weight: 600;
  text-decoration: underline;
  transition: opacity 0.2s ease;
}

.toast-notification a:hover {
  opacity: 0.8; /* Slightly fade on hover */
}

/* NEW: Class to apply blur/opacity effect to an element */
.is-blurred {
  filter: blur(4px);
  opacity: 0.6;
  /* This prevents the user from clicking on the results behind the modal */
  pointer-events: none;
  /* Add a transition for a smooth effect */
  transition: filter 0.3s ease, opacity 0.3s ease;
}
</style>