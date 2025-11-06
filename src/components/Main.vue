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
  DATA_TYPE: string; // Still useful to have in the type definition
  SSIC: string;
  TOTAL_COUNT: number;
}

interface BizFinderResponse {
  type: string;
  data: BusinessData | SsicSummaryData;
}

const isBizFinderResponse = (data: unknown): data is BusinessData => {
  if (!data || typeof data !== 'object') return false;
  const response = data as any;
  return 'UEN' in response && 'ENTITY_NAME' in response && 'DATA_TYPE' in response;
};

const isSsicSummaryResponse = (data: unknown): data is SsicSummaryData => {
  if (!data || typeof data !== 'object') return false;
  const response = data as any;
  // MODIFICATION: Removed the check for DATA_TYPE. The presence of SSIC and TOTAL_COUNT is enough.
  return 'SSIC' in response && 'TOTAL_COUNT' in response;
};

// --- Component State ---
const searchType = ref<'UEN' | 'NAME' | 'SSIC'>('UEN');
const searchText = ref('');
const searchResults = ref<BizFinderResponse | null>(null);
const errorMessage = ref('');
const isLoading = ref(false);

// --- State for Custom Dropdown ---
const isDropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// MODIFICATION FOR ERROR 2: Use `as const` for precise type inference.
const dropdownOptions = [
  { value: 'UEN', label: 'UEN' },
  { value: 'NAME', label: 'Name' },
  { value: 'SSIC', label: 'SSIC' }
] as const;

const toggleDropdown = () => isDropdownOpen.value = !isDropdownOpen.value;

// The function signature is now compatible thanks to `as const` above.
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

// --- MODIFICATION: New function to clear results ---
function resetResults() {
  searchResults.value = null;
  errorMessage.value = '';
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
    if (isSsicSummaryResponse(rawResponse)) {
      searchResults.value = {
        type: 'SSIC',
        data: rawResponse
      };
    }
    else if (isBizFinderResponse(rawResponse)) {
      searchResults.value = {
        type: 'UEN',
        data: rawResponse
      };
    } else {
      // MODIFICATION FOR ERROR 1: Safely check for the 'message' property.
      if (rawResponse && typeof rawResponse === 'object' && 'message' in rawResponse) {
        // Now it's safe to access .message because we've checked for it.
        errorMessage.value = (rawResponse as { message: string }).message;
      } else {
        // Fallback for any other non-successful response format.
        errorMessage.value = 'No results found or invalid response format.';
      }
    }
  } catch (error: unknown) {
    console.error('An error occurred during the API call:', error);
    
    // MODIFICATION: Specifically check for a 404 status code from the API response
    if (error && error.response && error.response.statusCode === 404) {
      errorMessage.value = "No Live Company Found";
    }
    // Fallback for other types of errors
    else if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.';
    }
  } finally {
    isLoading.value = false;
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
          <!-- Show spinner when loading -->
          <svg v-if="isLoading" class="spinner-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <!-- Show magnify glass when not loading -->
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

          <!-- This template logic already works correctly and doesn't need to be changed -->
          <ul v-if="searchResults.value.type == 'SSIC'" class="results-list">
            <li>
              <strong>SSIC CODE:</strong>
              <span>{{ searchResults.data.SSIC }}</span>
            </li>
            <li>
              <strong>Total Companies:</strong>
              <span>{{ searchResults.data.TOTAL_COUNT }}</span>
            </li>
          </ul>

          <ul v-else class="results-list">
             <!-- <li v-for="(value, key) in searchResults.data" :key="key">
                <strong v-if="key !== 'DATA_TYPE'">{{ key.replace(/_/g, ' ') }}:</strong> 
                <span v-if="key !== 'DATA_TYPE'">{{ value || 'N/A' }}</span>
             </li> -->

            <li>
              <strong>UEN:</strong>
              <span>{{ searchResults.data.UEN }}</span>
            </li>
            <li>
              <strong>ENTITY NAME:</strong>
              <span>{{ searchResults.data.ENTITY_NAME }}</span>
            </li>
            <li>
              <strong>ENTITY TYPE DESCRIPTION:</strong>
              <span>{{ searchResults.data.ENTITY_TYPE_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>BUSINESS CONSTITUTION DESCRIPTION:</strong>
              <span>{{ searchResults.data.BUSINESS_CONSTITUTION_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>PRIMARY SSIC CODE:</strong>
              <span>{{ searchResults.data.PRIMARY_SSIC_CODE }}</span>
            </li>
            <li>
              <strong>ENTITY STATUS DESCRIPTION:</strong>
              <span>{{ searchResults.data.ENTITY_STATUS_DESCRIPTION }}</span>
            </li>
            <li>
              <strong>REGISTRATION INCORPORATION DATE:</strong>
              <span>{{ searchResults.data.REGISTRATION_INCORPORATION_DATE }}</span>
            </li>
          </ul>
        </div>
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
          <a href="tel:+6564396608">(+65) 6439 6608</a>
          <a href="tel:+6565656161">(+65) 6565 6161</a>
          <a href="mailto:csc@sccb.com.sg">csc@sccb.com.sg</a>
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
.title { font-size: 3.5rem; font-weight: 800; margin: 0; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-fill-color: transparent; }
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
.dropdown-toggle { background: transparent; border: none; border-right: 1px solid rgba(0, 0, 0, 0.1); background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.2em 1.2em; padding: 15px 45px 15px 20px; font-size: 1.1rem; font-family: inherit; outline: none; color: #1f2937; cursor: pointer; text-align: left; }
.text-input-unified { background: transparent; border: none; padding: 15px 20px; width: 100%; flex-grow: 1; font-size: 1.1rem; outline: none; color: #1f2937; }
.text-input-unified::placeholder { color: #6b7280; }
.dropdown-menu { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; list-style: none; padding: 8px; margin: 0; z-index: 10; border-radius: 12px; overflow: hidden; backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); background: rgba(255, 255, 255, 0.7); }
.dropdown-item { padding: 10px 15px; cursor: pointer; border-radius: 8px; transition: background-color 0.2s ease; color: #1f2937; }
.dropdown-item:hover { background-color: rgba(59, 130, 246, 0.1); }

/* --- Other Buttons and Containers --- */
/* New styles for the icon button */
.search-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem; /* 16px padding on left/right */
  background: transparent;
  border: none;
  cursor: pointer;
  height: 100%; /* Make it fill the parent's height */
}
.search-icon-svg, .spinner-icon-svg {
  width: 24px;
  height: 24px;
  color: #6b7280; /* Gray color for the icon */
  transition: color 0.2s ease;
}
.search-icon-button:hover:not(:disabled) .search-icon-svg {
  color: #1f2937; /* Darker color on hover */
}
.search-icon-button:disabled {
  cursor: not-allowed;
}
/* Spinner icon animation */
.spinner-icon-svg {
  animation: spin 1s linear infinite;
}
.search-button-glass { padding: 12px 30px; font-size: 1.1rem; font-weight: 600; color: white; background: linear-gradient(to right, #3b82f6, #06b6d4); border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); }
.search-button-glass:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4); }
.search-button-glass:disabled { opacity: 0.6; cursor: not-allowed; }
.results-container-glass { backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 16px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.6); width: 95%; padding: 20px; color: #1f2937; text-align: left; margin-top: 20px; }
.results-container-glass h3 { margin-top: 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1); padding-bottom: 10px; font-size: 1.5rem; }
.results-list { list-style-type: none; padding: 0; margin: 0; }
.results-list li { display: flex; justify-content: space-between; padding: 12px 5px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); }
.results-list li:last-child { border-bottom: none; }
.results-list li strong { text-transform: capitalize; margin-right: 15px; color: #4b5563; }
.message.error { background-color: rgba(254, 226, 226, 0.8); border-left: 5px solid #ef4444; padding: 15px; border-radius: 8px; color: #991b1b; font-weight: 500; }

/* --- Animations --- */
.loading-spinner-container { margin-top: 20px; }
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
}


/* General styles for the footer container */
.footer-container {
  background-color: #ffffff; /* From: bg-white */
  padding-top: 3rem;      /* From: py-12 */
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
.footer-spacer-left { width: 12%; }
.footer-customer-service { width: 32%; padding-left: 0.75rem; } /* From: w-[32%] pl-3 */
.footer-office-address { width: 23%; padding-left: 0.5rem; }   /* From: w-[23%] pl-2 */
.footer-business-hours { width: 29%; padding-left: 0.5rem; }  /* From: w-[29%] pl-2 */
.footer-spacer-right { width: 4%; }

/* Styling for the headings (h3) */
.footer-heading {
  font-size: 1.25rem;      /* From: text-xl */
  font-weight: 700;        /* From: font-bold */
  color: #1f2937;          /* From: text-gray-800 */
  border-left: 2px solid #e5e7eb; /* From: border-l-2 (color is a standard gray) */
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
    border-bottom: 2px solid #e5e7eb; /* Add a horizontal border underneath instead */
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
</style>