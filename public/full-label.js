        // Add this at the very beginning of your script section
const API_BASE = '/api/advanced-label';

// Enhanced state management for uploads
const enhancedState = {
    uploadedLabels: new Map(),
    currentComparison: null,
    comparisonView: 'side-by-side',
    sectionFilter: 'all'
};

        // Enhanced Global State Management
        const state = {
            currentSearch: '',
            drugData: null,
            applications: [],
            labels: [],
            companies: new Map(),
            timeline: [],
            ndcCodes: [],
            uploadedLabels: [],
            selectedLabels: [],
            searchResults: null,
            chart: null,
            notes: [],
            comparisonView: 'side-by-side',
            timelineFilter: 'all',
            timelineGrouping: 'all',
            labelChanges: new Map(),
            changeReasons: new Map()
        };



        // Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize search listener
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Initialize other features
    // if (typeof updateLastSync === 'function') updateLastSync();
    if (typeof loadNotes === 'function') loadNotes();
    
    // Initialize enhanced features
    loadUploadedLabels();
    setupDragAndDrop();
});

if (!window.enhancedState) {
    window.enhancedState = {
        uploadedLabels: new Map()
    };
}

// Initialize enhanced features
document.addEventListener('DOMContentLoaded', () => {
    loadUploadedLabels();
    setupDragAndDrop();
});
// function updateCompareOptionsEnhanced() {
//     const select1 = document.getElementById('compareLabel1');
//     const select2 = document.getElementById('compareLabel2');
    
//     if (!select1 || !select2) return;
    
//     // Clear and rebuild options
//     select1.innerHTML = '<option value="">Select first label...</option>';
//     select2.innerHTML = '<option value="">Select second label...</option>';
    
//     // Add FDA labels if available
//     if (state.labels && state.labels.length > 0) {
//         const fdaGroup1 = document.createElement('optgroup');
//         fdaGroup1.label = 'FDA Labels';
//         const fdaGroup2 = document.createElement('optgroup');
//         fdaGroup2.label = 'FDA Labels';
        
//         state.labels.forEach(label => {
//             const brandName = label.openfda?.brand_name?.[0] || 'Unknown';
//             const option1 = new Option(brandName, label.id);
//             const option2 = new Option(brandName, label.id);
//             fdaGroup1.appendChild(option1);
//             fdaGroup2.appendChild(option2);
//         });
        
//         select1.appendChild(fdaGroup1);
//         select2.appendChild(fdaGroup2);
//     }
    
//     // Add uploaded labels
//     if (enhancedState.uploadedLabels.size > 0) {
//         const uploadGroup1 = document.createElement('optgroup');
//         uploadGroup1.label = 'Uploaded Labels';
//         const uploadGroup2 = document.createElement('optgroup');
//         uploadGroup2.label = 'Uploaded Labels';
        
//         enhancedState.uploadedLabels.forEach(label => {
//             const labelText = `${label.name} - v${label.metadata?.versionNumber || 'N/A'}`;
//             const option1 = new Option(labelText, label.id);
//             const option2 = new Option(labelText, label.id);
//             uploadGroup1.appendChild(option1);
//             uploadGroup2.appendChild(option2);
//         });
        
//         select1.appendChild(uploadGroup1);
//         select2.appendChild(uploadGroup2);
//     }
// }

function populateCompareOptions() {
    const select1 = document.getElementById('compareLabel1');
    const select2 = document.getElementById('compareLabel2');
    
    const options = ['<option value="">Select a label...</option>'];
    
    // Process state.labels - these come from your backend
    state.labels.forEach(label => {
        // The new backend structure has data nested differently
        // Try multiple paths to find the product name
        let productName = 'Unknown';
        let version = 'N/A';
        let effectiveDate = '';
        
        // Check if the label has the enhanced structure from the new backend
        if (label.data) {
            // New structure: label.data.metadata, label.data.productInfo, etc.
            productName = label.data.metadata?.title || 
                         label.data.metadata?.brandName ||
                         label.data.productInfo?.productName ||
                         label.productName ||
                         'Unknown';
            
            version = label.data.metadata?.versionNumber || 
                     label.version || 
                     'N/A';
            
            effectiveDate = label.data.metadata?.effectiveDate || 
                           label.effectiveDate || 
                           '';
        } else {
            // Fallback to direct properties
            productName = label.productName || 
                         label.title || 
                         label.name || 
                         label.brandName ||
                         'Unknown';
            
            version = label.version || 
                     label.versionNumber || 
                     'N/A';
            
            effectiveDate = label.effectiveDate || '';
        }
        
        // Clean up the label ID (remove 'label_' prefix if it exists)
        const labelId = label.id?.replace(/^label_/, '') || label.id;
        
        options.push(`
            <option value="label_${labelId}">
                ${productName} - v${version} (${formatDate(effectiveDate)})
            </option>
        `);
    });
    
    // Add uploaded labels
    state.uploadedLabels.forEach((label, index) => {
        options.push(`
            <option value="upload_${index}">
                [Uploaded] ${label.name}
            </option>
        `);
    });
    
    select1.innerHTML = options.join('');
    select2.innerHTML = options.join('');
    
    console.log(`Populated compare options with ${state.labels.length} FDA labels and ${state.uploadedLabels.length} uploaded labels`);
}

function updateCompareOptionsEnhanced() {
    const select1 = document.getElementById('compareLabel1');
    const select2 = document.getElementById('compareLabel2');
    
    if (!select1 || !select2) return;
    
    // Clear and rebuild options
    select1.innerHTML = '<option value="">Select first label...</option>';
    select2.innerHTML = '<option value="">Select second label...</option>';
    
    // Add FDA labels if available
    if (state.labels && state.labels.length > 0) {
        const fdaGroup1 = document.createElement('optgroup');
        fdaGroup1.label = 'FDA Labels';
        const fdaGroup2 = document.createElement('optgroup');
        fdaGroup2.label = 'FDA Labels';
        
        state.labels.forEach(label => {
            let brandName = 'Unknown';
            
            // Handle the new backend structure
            if (label.data) {
                // New enhanced structure from your backend
                brandName = label.data.metadata?.title ||
                           label.data.metadata?.brandName ||
                           label.data.productInfo?.productName ||
                           'Unknown';
                
                // Add manufacturer if available
                const manufacturer = label.data.metadata?.manufacturer || 
                                   label.data.metadata?.manufacturerName;
                if (manufacturer) {
                    brandName += ` (${manufacturer})`;
                }
            } else if (label.openfda) {
                // Original FDA API structure
                brandName = label.openfda.brand_name?.[0] || 
                           label.openfda.generic_name?.[0] || 
                           'Unknown';
            } else {
                // Direct properties fallback
                brandName = label.productName || 
                           label.brandName || 
                           label.name || 
                           label.title || 
                           'Unknown';
            }
            
            const option1 = new Option(brandName, label.id);
            const option2 = new Option(brandName, label.id);
            fdaGroup1.appendChild(option1);
            fdaGroup2.appendChild(option2);
        });
        
        select1.appendChild(fdaGroup1);
        select2.appendChild(fdaGroup2);
    }
    
    // Add uploaded labels
    if (enhancedState.uploadedLabels.size > 0) {
        const uploadGroup1 = document.createElement('optgroup');
        uploadGroup1.label = 'Uploaded Labels';
        const uploadGroup2 = document.createElement('optgroup');
        uploadGroup2.label = 'Uploaded Labels';
        
        enhancedState.uploadedLabels.forEach(label => {
            let labelText = label.name || 'Unnamed';
            
            // Check for metadata in uploaded labels
            if (label.metadata) {
                const version = label.metadata.versionNumber || label.metadata.version;
                if (version) {
                    labelText += ` - v${version}`;
                }
                
                // Add manufacturer if available
                if (label.metadata.manufacturer || label.metadata.manufacturerName) {
                    labelText += ` (${label.metadata.manufacturer || label.metadata.manufacturerName})`;
                }
            }
            
            const option1 = new Option(labelText, label.id);
            const option2 = new Option(labelText, label.id);
            uploadGroup1.appendChild(option1);
            uploadGroup2.appendChild(option2);
        });
        
        select1.appendChild(uploadGroup1);
        select2.appendChild(uploadGroup2);
    }
    
    console.log('Updated compare options with enhanced structure');
}

// Debug function to check the actual structure of your labels
function debugLabelStructure() {
    if (state.labels && state.labels.length > 0) {
        console.log('Sample label structure from state:');
        console.log('First label:', state.labels[0]);
        
        // Check what fields are actually present
        const firstLabel = state.labels[0];
        console.log('Direct properties:', Object.keys(firstLabel));
        
        if (firstLabel.data) {
            console.log('Data properties:', Object.keys(firstLabel.data));
            if (firstLabel.data.metadata) {
                console.log('Metadata properties:', Object.keys(firstLabel.data.metadata));
            }
            if (firstLabel.data.productInfo) {
                console.log('ProductInfo properties:', Object.keys(firstLabel.data.productInfo));
            }
        }
        
        // Check multiple labels to see consistency
        console.log('\nChecking all labels for product name fields:');
        state.labels.slice(0, 5).forEach((label, index) => {
            const productName = label.data?.metadata?.title ||
                              label.data?.metadata?.brandName ||
                              label.data?.productInfo?.productName ||
                              label.productName ||
                              label.title ||
                              label.name ||
                              label.brandName ||
                              'NOT FOUND';
            console.log(`Label ${index}: ${productName}`);
        });
    } else {
        console.log('No labels in state to debug');
    }
}

// Function to manually refresh the dropdowns after loading new data
async function refreshCompareDropdowns() {
    // Check if we need to fetch the labels first
    if (!state.labels || state.labels.length === 0) {
        console.log('No labels in state, fetching from backend...');
        
        try {
            const response = await fetch(`${API_BASE}/labels`);
            if (response.ok) {
                const labels = await response.json();
                state.labels = labels;
                console.log(`Loaded ${labels.length} labels from backend`);
            }
        } catch (error) {
            console.error('Error fetching labels:', error);
        }
    }
    
    // Now populate the dropdowns
    if (typeof updateCompareOptionsEnhanced === 'function') {
        updateCompareOptionsEnhanced();
    } else {
        populateCompareOptions();
    }
}

// Make functions available globally
window.populateCompareOptions = populateCompareOptions;
window.updateCompareOptionsEnhanced = updateCompareOptionsEnhanced;
window.debugLabelStructure = debugLabelStructure;
window.refreshCompareDropdowns = refreshCompareDropdowns;


function displayLabelDetails(label) {
    // Reuse existing label viewing logic
    const modalHtml = `
        <div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50" id="labelDetailModal">
            <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center p-6 border-b">
                    <h3 class="text-2xl font-bold">${label.name}</h3>
                    <button onclick="document.getElementById('labelDetailModal').remove()" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto">
                    <pre>${JSON.stringify(label, null, 2)}</pre>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
// Setup drag and drop for XML files
function setupDragAndDrop() {
    const modal = document.getElementById('enhancedUploadModal');
    const dropZone = modal.querySelector('.bg-gray-50');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('bg-blue-50', 'border-2', 'border-blue-400', 'border-dashed');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('bg-blue-50', 'border-2', 'border-blue-400', 'border-dashed');
        }, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
}

// Handle file drop
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0 && files[0].name.endsWith('.xml')) {
        document.getElementById('xmlUploadFile').files = files;
    }
}


// 1. Fix the upload function to prevent page reload by using event parameter:
function uploadXMLLabel(event) {
    // Prevent default form submission
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const fileInput = document.getElementById('xmlUploadFile');
    const file = fileInput.files[0];
    const name = document.getElementById('xmlLabelName').value;
    const description = document.getElementById('xmlLabelDescription').value;
    
    if (!file) {
        showNotification('Please select an XML file', 'error');
        return false; // Return false to prevent any default action
    }
    
    if (!file.name.endsWith('.xml')) {
        showNotification('Please select a valid XML file', 'error');
        return false;
    }
    
    // Use async function to handle the upload
    performXMLUpload(file, name, description);
    return false; // Prevent default
}

async function performXMLUpload(file, name, description) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name || file.name);
    formData.append('description', description || '');
    
    // Find the upload button and show loading state
    const uploadBtn = document.querySelector('#enhancedUploadModal button[onclick*="uploadXMLLabel"]');
    const originalText = uploadBtn ? uploadBtn.innerHTML : '';
    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        uploadBtn.disabled = true;
    }
    
    try {
        const response = await fetch(`${API_BASE}/upload-xml-label`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add to local state
            if (!window.enhancedState) {
                window.enhancedState = { uploadedLabels: new Map() };
            }
            enhancedState.uploadedLabels.set(result.label.id, result.label);
            
            // Update UI
            renderUploadedLabels();
            updateCompareOptionsEnhanced();
            
            // Clear form
            document.getElementById('xmlUploadFile').value = '';
            document.getElementById('xmlLabelName').value = '';
            document.getElementById('xmlLabelDescription').value = '';
            
            // Show success message
            showNotification('Label uploaded successfully!', 'success');
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Error uploading label: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (uploadBtn) {
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }
}
// Load uploaded labels from server
async function loadUploadedLabels() {
    try {
        const response = await fetch(`${API_BASE}/uploaded-labels`);
        const data = await response.json();
        
        enhancedState.uploadedLabels.clear();
        data.labels.forEach(label => {
            enhancedState.uploadedLabels.set(label.id, label);
        });
        
        renderUploadedLabels();
        updateCompareOptionsEnhanced();
    } catch (error) {
        console.error('Error loading uploaded labels:', error);
    }
}

// Render uploaded labels list
function renderUploadedLabels() {
    const container = document.getElementById('uploadedLabelsList');
    
    if (enhancedState.uploadedLabels.size === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No uploaded labels yet</p>';
        return;
    }
    
    container.innerHTML = Array.from(enhancedState.uploadedLabels.values()).map(label => `
        <div class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="font-medium text-gray-900">${label.name}</p>
                    <p class="text-xs text-gray-600">
                        Version: ${label.metadata?.versionNumber || 'N/A'} • 
                        ${label.sectionsCount || Object.keys(label.sectionsAvailable || {}).length} sections
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                        Uploaded: ${new Date(label.uploadDate).toLocaleDateString()}
                    </p>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewUploadedLabel('${label.id}')" 
                            class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="deleteUploadedLabel('${label.id}')" 
                            class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// View uploaded label details
async function viewUploadedLabel(labelId) {
    try {
        const response = await fetch(`${API_BASE}/uploaded-label/${labelId}`);
        const data = await response.json();
        
        // Display label details in a modal
        displayLabelDetails(data.label);
    } catch (error) {
        console.error('Error viewing label:', error);
        showNotification('Error loading label details', 'error');
    }
}

// Delete uploaded label
async function deleteUploadedLabel(labelId) {
    if (!confirm('Are you sure you want to delete this label?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/uploaded-label/${labelId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            enhancedState.uploadedLabels.delete(labelId);
            renderUploadedLabels();
            updateCompareOptionsEnhanced();
            showNotification('Label deleted successfully', 'success');
        } else {
            throw new Error('Failed to delete label');
        }
    } catch (error) {
        console.error('Error deleting label:', error);
        showNotification('Error deleting label', 'error');
    }
}
function displayComparison(data) {
    const resultDiv = document.getElementById('comparisonResult');
    
    if (!data || !data.comparison) {
        resultDiv.innerHTML = '<p class="text-center text-gray-500 py-8">No comparison data available</p>';
        return;
    }
    
    const { comparison, label1, label2 } = data;
    const stats = comparison.stats || { added: 0, removed: 0, modified: 0, unchanged: 0 };
    
    // Build the comparison display
    let html = `
        <div class="space-y-6">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <h4 class="font-bold text-gray-900 mb-2">Label 1</h4>
                        <p class="text-sm text-gray-600">ID: ${label1.id}</p>
                        <p class="text-sm text-gray-600">Sections: ${label1.sectionsFound}</p>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-900 mb-2">Label 2</h4>
                        <p class="text-sm text-gray-600">ID: ${label2.id}</p>
                        <p class="text-sm text-gray-600">Sections: ${label2.sectionsFound}</p>
                    </div>
                </div>
            </div>
            
            <!-- Statistics -->
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-green-700">${stats.added}</div>
                    <div class="text-sm text-green-600">Added</div>
                </div>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-red-700">${stats.removed}</div>
                    <div class="text-sm text-red-600">Removed</div>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-yellow-700">${stats.modified}</div>
                    <div class="text-sm text-yellow-600">Modified</div>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-gray-700">${stats.unchanged}</div>
                    <div class="text-sm text-gray-600">Unchanged</div>
                </div>
            </div>
            
            <!-- Section changes -->
            <div>
                <h3 class="font-bold text-gray-900 text-lg mb-4">Section Comparison</h3>
                <div class="space-y-3">
    `;
    
    // Add section comparisons
    if (comparison.sections && comparison.sections.length > 0) {
        comparison.sections.forEach(section => {
            if (section.status === 'unchanged') return; // Skip unchanged sections
            
            const statusColors = {
                'added': 'bg-green-50 border-green-300',
                'removed': 'bg-red-50 border-red-300',
                'modified': 'bg-yellow-50 border-yellow-300',
                'unchanged': 'bg-gray-50 border-gray-300'
            };
            
            const statusIcons = {
                'added': 'fa-plus-circle text-green-600',
                'removed': 'fa-minus-circle text-red-600',
                'modified': 'fa-edit text-yellow-600',
                'unchanged': 'fa-check-circle text-gray-600'
            };
            
            html += `
                <div class="border rounded-lg p-4 ${statusColors[section.status] || 'bg-gray-50'}">
                    <div class="flex items-center justify-between">
                        <h4 class="font-semibold flex items-center">
                            <i class="fas ${statusIcons[section.status] || 'fa-question-circle'} mr-2"></i>
                            ${section.name}
                        </h4>
                        <span class="px-2 py-1 text-xs rounded ${
                            section.status === 'added' ? 'bg-green-200 text-green-800' :
                            section.status === 'removed' ? 'bg-red-200 text-red-800' :
                            section.status === 'modified' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-gray-200 text-gray-800'
                        }">
                            ${section.status}
                        </span>
                    </div>
                    
                    ${section.content1 && section.content2 && section.status === 'modified' ? `
                        <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div class="p-2 bg-red-50 rounded">
                                <p class="font-medium text-red-700 mb-1">Previous:</p>
                                <p class="text-red-600">${section.content1.substring(0, 150)}...</p>
                            </div>
                            <div class="p-2 bg-green-50 rounded">
                                <p class="font-medium text-green-700 mb-1">Current:</p>
                                <p class="text-green-600">${section.content2.substring(0, 150)}...</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    } else {
        html += '<p class="text-gray-500 text-center py-4">No section differences found</p>';
    }
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// Retry comparison
function retryComparison() {
    performEnhancedComparison();
}
async function performEnhancedComparison(){
    compareLabels()
}


function normalizeSectionName(name) {
    if (!name) return '';
    
    // Remove leading numbers and dots (e.g., "1." or "1.1")
    let normalized = name.replace(/^\d+(\.\d+)*\s*/, '');
    
    // Remove "AND" vs "&" differences
    normalized = normalized.replace(/\sAND\s/gi, ' and ');
    normalized = normalized.replace(/\s&\s/gi, ' and ');
    
    // Standardize case
    normalized = normalized.toLowerCase().trim();
    
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    return normalized;
}

// Find matching section in the other label
function findMatchingSection(targetSection, sections) {
    const normalizedTarget = normalizeSectionName(targetSection);
    
    for (const sectionName of Object.keys(sections)) {
        const normalizedSection = normalizeSectionName(sectionName);
        if (normalizedTarget === normalizedSection) {
            return sectionName;
        }
    }
    
    return null;
}


// 6. Fix the comparison function to handle errors gracefully:
// async function performEnhancedComparison() {
//     const label1Id = document.getElementById('compareLabel1').value;
//     const label2Id = document.getElementById('compareLabel2').value;
    
//     if (!label1Id || !label2Id) {
//         showNotification('Please select two labels to compare', 'error');
//         return;
//     }
    
//     if (label1Id === label2Id) {
//         showNotification('Please select different labels to compare', 'error');
//         return;
//     }
    
//     // Show comparison modal
//     const modal = document.getElementById('enhancedComparisonModal');
//     if (modal) {
//         modal.classList.remove('hidden');
//     }
//     showComparisonLoading();
    
//     try {
//         // Remove 'label_' prefix if present for the API call
//         const cleanLabel1Id = label1Id.replace(/^label_/, '');
//         const cleanLabel2Id = label2Id.replace(/^label_/, '');
        
//         console.log(`Comparing: ${cleanLabel1Id} vs ${cleanLabel2Id}`);
        
//         // Use the correct backend endpoint: /compare/:label1/:label2 (no /api prefix)
//         const url = `${API_BASE}/compare/${cleanLabel1Id}/${cleanLabel2Id}`;
//         console.log('Fetching from:', url);
        
//         const response = await fetch(url);
        
//         if (!response.ok) {
//             let errorMessage = `HTTP error! status: ${response.status}`;
//             try {
//                 const errorData = await response.json();
//                 errorMessage = errorData.error || errorMessage;
//             } catch (e) {
//                 // If response is not JSON (like HTML error page)
//                 console.error('Response was not JSON:', e);
//             }
//             throw new Error(errorMessage);
//         }
        
//         const comparisonData = await response.json();
//         console.log('Comparison data received:', comparisonData);
        
//         // Display the comparison results
//         displayEnhancedComparison(comparisonData);
        
//     } catch (error) {
//         console.error('Comparison error:', error);
//         showNotification('Error comparing labels: ' + error.message, 'error');
        
//         // Show error in modal
//         const content = document.getElementById('comparisonContent');
//         if (content) {
//             content.innerHTML = `
//                 <div class="p-8 text-center">
//                     <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
//                     <p class="text-gray-700 mb-2">Failed to compare labels</p>
//                     <p class="text-sm text-gray-500">${error.message}</p>
//                     <button onclick="retryComparison()" 
//                             class="mt-4 mr-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
//                         <i class="fas fa-redo mr-1"></i>Retry
//                     </button>
//                     <button onclick="closeComparisonModal()" 
//                             class="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
//                         Close
//                     </button>
//                 </div>
//             `;
//         }
//     }
// }

// function displayEnhancedComparison(comparison) {
//     // Update header
//     const header = document.getElementById('comparisonHeader');
//     if (header) {
//         header.textContent = 
//             `${comparison.label1.name} v${comparison.label1.version} vs ${comparison.label2.name} v${comparison.label2.version}`;
//     }
    
//     // Update stats (with fallback if elements don't exist)
//     const updateStat = (id, value) => {
//         const elem = document.getElementById(id);
//         if (elem) elem.textContent = value;
//     };
    
//     updateStat('statsAdded', comparison.stats.added);
//     updateStat('statsRemoved', comparison.stats.removed);
//     updateStat('statsModified', comparison.stats.modified);
//     updateStat('statsUnchanged', comparison.stats.unchanged);
    
//     const totalChanges = comparison.stats.added + comparison.stats.removed + comparison.stats.modified;
//     updateStat('statsTotal', totalChanges);
    
//     // Display sections
//     const content = document.getElementById('comparisonContent');
//     if (!content) return;
    
//     if (!comparison.sections || comparison.sections.length === 0) {
//         content.innerHTML = '<p class="text-center text-gray-500 py-8">No sections to compare</p>';
//         return;
//     }
    
//     content.innerHTML = `
//         <div class="space-y-4 p-6">
//             ${comparison.sections.map(section => `
//                 <div class="border rounded-lg overflow-hidden ${
//                     section.status === 'unchanged' ? 'opacity-75' : ''
//                 }">
//                     <div class="px-4 py-2 bg-gray-50 flex justify-between items-center">
//                         <h4 class="font-semibold">${section.name}</h4>
//                         <span class="px-2 py-1 text-xs rounded ${
//                             section.status === 'added' ? 'bg-green-100 text-green-700' :
//                             section.status === 'removed' ? 'bg-red-100 text-red-700' :
//                             section.status === 'modified' ? 'bg-yellow-100 text-yellow-700' :
//                             'bg-gray-100 text-gray-700'
//                         }">
//                             ${section.status.toUpperCase()}
//                         </span>
//                     </div>
//                     <div class="p-4 bg-white">
//                         ${section.diff || '<span class="text-gray-500">No content</span>'}
//                     </div>
//                 </div>
//             `).join('')}
//         </div>
//     `;
// }



// Process label data to extract clean values (same as in viewFullLabel)
// Process label data with proper error handling
function processLabelData(labelData, labelId) {
    const processed = {
        id: labelId,
        metadata: {
            title: 'Unknown Product',
            setId: '',
            versionNumber: '1.0',
            effectiveDate: '',
            manufacturer: 'Not specified'
        },
        sections: {},
        productInfo: {},
        images: []
    };
    
    // Safely process metadata
    if (labelData && labelData.metadata) {
        processed.metadata = {
            title: extractValue(labelData.metadata.title) || 
                   extractValue(labelData.metadata.productName) || 
                   'Unknown Product',
            setId: extractValue(labelData.metadata.setId) || 
                   extractValue(labelData.metadata.splSetId) || 
                   extractValue(labelData.metadata.id) || 
                   '',
            versionNumber: extractValue(labelData.metadata.versionNumber) || 
                          extractValue(labelData.metadata.version) || 
                          '1.0',
            effectiveDate: extractValue(labelData.metadata.effectiveDate) || 
                          extractValue(labelData.metadata.effectivetime) || 
                          '',
            manufacturer: cleanManufacturerString(
                extractValue(labelData.metadata.manufacturer) ||
                extractValue(labelData.metadata.manufacturerName) ||
                ''
            ) || 'Not specified'
        };
    }
    
    // Safely process sections
    if (labelData && labelData.sections) {
        Object.entries(labelData.sections).forEach(([key, value]) => {
            try {
                const content = extractValue(value);
                // Only include if we have meaningful content
                if (content && content.length > 10 && !content.match(/^ID\d+$/)) {
                    processed.sections[key] = content;
                }
            } catch (e) {
                console.warn(`Error processing section ${key}:`, e);
            }
        });
    }
    
    // Safely process product info
    if (labelData && labelData.productInfo) {
        Object.entries(labelData.productInfo).forEach(([key, value]) => {
            try {
                const extracted = extractValue(value);
                if (extracted && !extracted.match(/^ID\d+$/)) {
                    processed.productInfo[key] = extracted;
                }
            } catch (e) {
                console.warn(`Error processing product info ${key}:`, e);
            }
        });
    }
    
    // Process images if available
    if (labelData && labelData.images) {
        processed.images = Array.isArray(labelData.images) ? labelData.images : [];
    }
    
    return processed;
}

// Safe extraction function with fallbacks
function extractValue(value) {
    if (!value) return '';
    
    // If it's already a clean string, return it
    if (typeof value === 'string' && !value.includes('[object')) {
        return value.trim();
    }
    
    // If it's an array, get the first meaningful element
    if (Array.isArray(value)) {
        for (let item of value) {
            const extracted = extractValue(item);
            if (extracted && extracted !== '') {
                return extracted;
            }
        }
        return '';
    }
    
    // If it's an object, extract based on common patterns
    if (typeof value === 'object') {
        // Check for direct text content
        if (value._ !== undefined && value._) return value._;
        if (value['#text'] !== undefined) return value['#text'];
        if (value.text !== undefined) return extractValue(value.text);
        if (value.content !== undefined) return extractValue(value.content);
        if (value.value !== undefined) return extractValue(value.value);
        if (value.name !== undefined) return extractValue(value.name);
        if (value.title !== undefined) return extractValue(value.title);
        
        // Check for attributes
        if (value.$ !== undefined) {
            if (value.$.value) return value.$.value;
            if (value.$.root) return value.$.root;
            if (value.$.displayName) return value.$.displayName;
        }
        
        // Try to find any string value
        for (const key in value) {
            if (typeof value[key] === 'string' && value[key].trim()) {
                return value[key].trim();
            }
        }
        
        return '';
    }
    
    return String(value).trim();
}

// Safe manufacturer string cleaning
function cleanManufacturerString(str) {
    if (!str) return '';
    
    // Remove OID numbers
    str = str.replace(/1\.3\.6\.1\.4\.1\.\d+\.\d+/g, '');
    
    // Remove numeric IDs
    str = str.replace(/\b\d{9,}\b/g, '');
    
    // Remove MANU tags
    str = str.replace(/\bMANU\b/g, '');
    
    // Clean up whitespace
    str = str.replace(/\s+/g, ' ').trim();
    
    return str || '';
}

// Perform detailed comparison between two processed labels
// Perform comparison with error handling
function performDetailedComparison(label1, label2) {
    const comparison = {
        metadata: {
            label1: label1.metadata || {},
            label2: label2.metadata || {}
        },
        stats: {
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0,
            total: 0
        },
        sections: [],
        changes: []
    };
    
    // Get all unique section names
    const sections1 = label1.sections || {};
    const sections2 = label2.sections || {};
    
    const allSections = new Set([
        ...Object.keys(sections1),
        ...Object.keys(sections2)
    ]);
    
    // Compare each section
    allSections.forEach(sectionName => {
        const content1 = sections1[sectionName] || '';
        const content2 = sections2[sectionName] || '';
        
        let status = 'unchanged';
        let changeType = '';
        
        if (!content1 && content2) {
            status = 'added';
            changeType = 'New section added';
            comparison.stats.added++;
        } else if (content1 && !content2) {
            status = 'removed';
            changeType = 'Section removed';
            comparison.stats.removed++;
        } else if (content1 !== content2) {
            status = 'modified';
            changeType = 'Content modified';
            comparison.stats.modified++;
        } else {
            comparison.stats.unchanged++;
        }
        
        comparison.sections.push({
            name: sectionName,
            status: status,
            changeType: changeType,
            content1: content1,
            content2: content2
        });
    });
    
    comparison.stats.total = allSections.size;
    
    // Sort sections by importance
    const sectionOrder = [
        'Boxed Warning',
        'Lactic Acidosis',
        'Contraindications',
        'Warnings and Precautions',
        'Indications and Usage',
        'Dosage and Administration',
        'Adverse Reactions',
        'Drug Interactions'
    ];
    
    comparison.sections.sort((a, b) => {
        const aIndex = sectionOrder.indexOf(a.name);
        const bIndex = sectionOrder.indexOf(b.name);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.name.localeCompare(b.name);
    });
    
    return comparison;
}

// Calculate similarity between two texts
function calculateSimilarity(text1, text2) {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = getEditDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
}

// Get edit distance between two strings (Levenshtein distance)
function getEditDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Find specific differences between two texts
function findDifferences(text1, text2) {
    // Simple implementation - can be enhanced with diff library
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const differences = [];
    
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines && i < 10; i++) { // Limit to first 10 differences
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
            differences.push({
                lineNumber: i + 1,
                old: line1.substring(0, 100) + (line1.length > 100 ? '...' : ''),
                new: line2.substring(0, 100) + (line2.length > 100 ? '...' : '')
            });
        }
    }
    
    return differences;
}

// Display the enhanced comparison
// function displayEnhancedComparison(comparison, label1, label2) {
//     const resultDiv = document.getElementById('comparisonResult');
    
//     // Create comparison header
//     const headerHtml = `
//         <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
//             <div class="grid grid-cols-2 gap-6">
//                 <div>
//                     <h3 class="font-bold text-gray-900 text-lg mb-2">
//                         <i class="fas fa-tag text-blue-600 mr-2"></i>${label1.metadata.title}
//                     </h3>
//                     <div class="text-sm text-gray-600 space-y-1">
//                         <p><span class="font-medium">Version:</span> ${label1.metadata.versionNumber}</p>
//                         <p><span class="font-medium">Manufacturer:</span> ${label1.metadata.manufacturer}</p>
//                         ${label1.metadata.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(label1.metadata.effectiveDate)}</p>` : ''}
//                     </div>
//                 </div>
//                 <div class="border-l pl-6">
//                     <h3 class="font-bold text-gray-900 text-lg mb-2">
//                         <i class="fas fa-tag text-purple-600 mr-2"></i>${label2.metadata.title}
//                     </h3>
//                     <div class="text-sm text-gray-600 space-y-1">
//                         <p><span class="font-medium">Version:</span> ${label2.metadata.versionNumber}</p>
//                         <p><span class="font-medium">Manufacturer:</span> ${label2.metadata.manufacturer}</p>
//                         ${label2.metadata.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(label2.metadata.effectiveDate)}</p>` : ''}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     `;
    
//     // Create statistics summary
//     const statsHtml = `
//         <div class="grid grid-cols-5 gap-4 mb-6">
//             <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
//                 <div class="text-2xl font-bold text-green-700">${comparison.stats.added}</div>
//                 <div class="text-sm text-green-600">Added</div>
//             </div>
//             <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
//                 <div class="text-2xl font-bold text-red-700">${comparison.stats.removed}</div>
//                 <div class="text-sm text-red-600">Removed</div>
//             </div>
//             <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
//                 <div class="text-2xl font-bold text-yellow-700">${comparison.stats.modified}</div>
//                 <div class="text-sm text-yellow-600">Modified</div>
//             </div>
//             <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
//                 <div class="text-2xl font-bold text-gray-700">${comparison.stats.unchanged}</div>
//                 <div class="text-sm text-gray-600">Unchanged</div>
//             </div>
//             <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
//                 <div class="text-2xl font-bold text-blue-700">${comparison.stats.total}</div>
//                 <div class="text-sm text-blue-600">Total Sections</div>
//             </div>
//         </div>
//     `;
    
//     // Create section comparison
//     const sectionsHtml = `
//         <div class="space-y-4">
//             <h3 class="font-bold text-gray-900 text-lg mb-4">
//                 <i class="fas fa-list-check mr-2"></i>Section-by-Section Comparison
//             </h3>
//             ${comparison.sections.map(section => {
//                 if (section.status === 'unchanged' && !document.getElementById('showUnchanged')?.checked) {
//                     return ''; // Skip unchanged sections unless requested
//                 }
                
//                 const statusColors = {
//                     added: 'bg-green-50 border-green-200',
//                     removed: 'bg-red-50 border-red-200',
//                     modified: 'bg-yellow-50 border-yellow-200',
//                     unchanged: 'bg-gray-50 border-gray-200'
//                 };
                
//                 const statusIcons = {
//                     added: 'fa-plus-circle text-green-600',
//                     removed: 'fa-minus-circle text-red-600',
//                     modified: 'fa-edit text-yellow-600',
//                     unchanged: 'fa-check-circle text-gray-600'
//                 };
                
//                 return `
//                     <div class="border rounded-lg overflow-hidden ${statusColors[section.status]}">
//                         <div class="p-4">
//                             <div class="flex items-center justify-between mb-3">
//                                 <h4 class="font-semibold text-gray-900 flex items-center">
//                                     <i class="fas ${statusIcons[section.status]} mr-2"></i>
//                                     ${section.name}
//                                 </h4>
//                                 <span class="text-sm text-gray-600">${section.changeType || 'No changes'}</span>
//                             </div>
                            
//                             ${section.status === 'modified' && section.differences ? `
//                                 <div class="bg-white rounded p-3 space-y-2">
//                                     <p class="text-sm font-medium text-gray-700 mb-2">Key Differences:</p>
//                                     ${section.differences.slice(0, 3).map(diff => `
//                                         <div class="text-xs space-y-1">
//                                             <div class="text-red-600">
//                                                 <span class="font-medium">- Line ${diff.lineNumber}:</span> 
//                                                 ${escapeHtml(diff.old)}
//                                             </div>
//                                             <div class="text-green-600">
//                                                 <span class="font-medium">+ Line ${diff.lineNumber}:</span> 
//                                                 ${escapeHtml(diff.new)}
//                                             </div>
//                                         </div>
//                                     `).join('')}
//                                     ${section.differences.length > 3 ? `
//                                         <p class="text-xs text-gray-500 italic">
//                                             ... and ${section.differences.length - 3} more differences
//                                         </p>
//                                     ` : ''}
//                                 </div>
//                             ` : ''}
                            
//                             ${section.status === 'added' ? `
//                                 <div class="bg-white rounded p-3">
//                                     <p class="text-sm text-green-700">
//                                         ${section.content2.substring(0, 200)}${section.content2.length > 200 ? '...' : ''}
//                                     </p>
//                                 </div>
//                             ` : ''}
                            
//                             ${section.status === 'removed' ? `
//                                 <div class="bg-white rounded p-3">
//                                     <p class="text-sm text-red-700 line-through opacity-75">
//                                         ${section.content1.substring(0, 200)}${section.content1.length > 200 ? '...' : ''}
//                                     </p>
//                                 </div>
//                             ` : ''}
//                         </div>
//                     </div>
//                 `;
//             }).filter(html => html !== '').join('')}
//         </div>
//     `;
    
//     // Add controls
//     const controlsHtml = `
//         <div class="mb-4 flex items-center justify-between">
//             <div class="flex items-center gap-4">
//                 <label class="flex items-center text-sm text-gray-700">
//                     <input type="checkbox" id="showUnchanged" onchange="compareLabels()" class="mr-2">
//                     Show unchanged sections
//                 </label>
//                 <button onclick="exportComparison()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
//                     <i class="fas fa-download mr-1"></i>Export Comparison
//                 </button>
//                 <button onclick="printComparison()" class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
//                     <i class="fas fa-print mr-1"></i>Print
//                 </button>
//             </div>
//         </div>
//     `;
    
//     // Combine all HTML
//     resultDiv.innerHTML = controlsHtml + headerHtml + statsHtml + sectionsHtml;
// }
//play comparison with safe access to properties
function displayEnhancedComparison(comparisonData) {
    console.log('Displaying comparison:', comparisonData);
    
    // Extract data from the backend response
    const comparison = comparisonData.comparison || {};
    const label1Data = comparisonData.label1 || {};
    const label2Data = comparisonData.label2 || {};
    
    // Update header
    const header = document.getElementById('comparisonHeader');
    if (header) {
        const label1Name = label1Data.metadata?.title || label1Data.metadata?.productName || 'Label 1';
        const label2Name = label2Data.metadata?.title || label2Data.metadata?.productName || 'Label 2';
        const label1Version = label1Data.metadata?.versionNumber || label1Data.metadata?.version || 'N/A';
        const label2Version = label2Data.metadata?.versionNumber || label2Data.metadata?.version || 'N/A';
        
        header.textContent = `${label1Name} v${label1Version} vs ${label2Name} v${label2Version}`;
    }
    
    // Update stats
    const stats = comparison.stats || { added: 0, removed: 0, modified: 0, unchanged: 0 };
    
    const updateStat = (id, value) => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = value || 0;
    };
    
    updateStat('statsAdded', stats.added);
    updateStat('statsRemoved', stats.removed);
    updateStat('statsModified', stats.modified);
    updateStat('statsUnchanged', stats.unchanged);
    
    const totalChanges = (stats.added || 0) + (stats.removed || 0) + (stats.modified || 0);
    updateStat('statsTotal', totalChanges);
    
    // Display sections comparison
    const content = document.getElementById('comparisonContent');
    if (!content) {
        console.error('Comparison content div not found');
        return;
    }
    
    const sections = comparison.sections || [];
    
    if (sections.length === 0) {
        content.innerHTML = `
            <div class="p-8 text-center">
                <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600">No sections to compare</p>
                <p class="text-sm text-gray-500 mt-2">
                    The labels may not have comparable content or the data extraction needs improvement.
                </p>
            </div>
        `;
        return;
    }
    
    // Generate the comparison HTML
    content.innerHTML = `
        <div class="space-y-4 p-6">
            <!-- Metadata comparison -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <h4 class="font-bold text-gray-900 mb-3">
                            <i class="fas fa-tag text-blue-600 mr-2"></i>
                            ${label1Data.metadata?.title || 'Label 1'}
                        </h4>
                        <div class="text-sm text-gray-600 space-y-1">
                            <p><span class="font-medium">Version:</span> ${label1Data.metadata?.versionNumber || 'N/A'}</p>
                            <p><span class="font-medium">Sections Found:</span> ${label1Data.sectionsFound || 0}</p>
                            ${label1Data.metadata?.manufacturer ? `
                                <p><span class="font-medium">Manufacturer:</span> ${label1Data.metadata.manufacturer}</p>
                            ` : ''}
                        </div>
                    </div>
                    <div class="border-l pl-6">
                        <h4 class="font-bold text-gray-900 mb-3">
                            <i class="fas fa-tag text-purple-600 mr-2"></i>
                            ${label2Data.metadata?.title || 'Label 2'}
                        </h4>
                        <div class="text-sm text-gray-600 space-y-1">
                            <p><span class="font-medium">Version:</span> ${label2Data.metadata?.versionNumber || 'N/A'}</p>
                            <p><span class="font-medium">Sections Found:</span> ${label2Data.sectionsFound || 0}</p>
                            ${label2Data.metadata?.manufacturer ? `
                                <p><span class="font-medium">Manufacturer:</span> ${label2Data.metadata.manufacturer}</p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Statistics -->
            <div class="grid grid-cols-4 gap-4 mb-6">
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-green-700">${stats.added || 0}</div>
                    <div class="text-sm text-green-600">Added</div>
                </div>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-red-700">${stats.removed || 0}</div>
                    <div class="text-sm text-red-600">Removed</div>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-yellow-700">${stats.modified || 0}</div>
                    <div class="text-sm text-yellow-600">Modified</div>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-gray-700">${stats.unchanged || 0}</div>
                    <div class="text-sm text-gray-600">Unchanged</div>
                </div>
            </div>
            
            <!-- Section-by-section comparison -->
            <div>
                <h3 class="font-bold text-gray-900 text-lg mb-4">Section Comparison</h3>
                ${sections.map(section => {
                    const statusColors = {
                        'added': 'bg-green-50 border-green-300',
                        'removed': 'bg-red-50 border-red-300',
                        'modified': 'bg-yellow-50 border-yellow-300',
                        'unchanged': 'bg-gray-50 border-gray-300'
                    };
                    
                    const statusIcons = {
                        'added': 'fa-plus-circle text-green-600',
                        'removed': 'fa-minus-circle text-red-600',
                        'modified': 'fa-edit text-yellow-600',
                        'unchanged': 'fa-check-circle text-gray-600'
                    };
                    
                    // Skip unchanged sections unless checkbox is checked
                    if (section.status === 'unchanged' && !document.getElementById('showUnchangedSections')?.checked) {
                        return '';
                    }
                    
                    return `
                        <div class="border rounded-lg overflow-hidden mb-3 ${statusColors[section.status] || 'bg-gray-50'}">
                            <div class="px-4 py-3">
                                <div class="flex justify-between items-center">
                                    <h4 class="font-semibold flex items-center">
                                        <i class="fas ${statusIcons[section.status] || 'fa-question-circle'} mr-2"></i>
                                        ${section.name || 'Unknown Section'}
                                    </h4>
                                    <span class="px-2 py-1 text-xs rounded ${
                                        section.status === 'added' ? 'bg-green-200 text-green-800' :
                                        section.status === 'removed' ? 'bg-red-200 text-red-800' :
                                        section.status === 'modified' ? 'bg-yellow-200 text-yellow-800' :
                                        'bg-gray-200 text-gray-800'
                                    }">
                                        ${section.status || 'unknown'}
                                    </span>
                                </div>
                                
                                ${section.status === 'added' && section.content2 ? `
                                    <div class="mt-3 p-3 bg-white rounded text-sm">
                                        <p class="text-green-700">
                                            ${escapeHtml(section.content2.substring(0, 300))}${section.content2.length > 300 ? '...' : ''}
                                        </p>
                                    </div>
                                ` : ''}
                                
                                ${section.status === 'removed' && section.content1 ? `
                                    <div class="mt-3 p-3 bg-white rounded text-sm">
                                        <p class="text-red-700 line-through opacity-75">
                                            ${escapeHtml(section.content1.substring(0, 300))}${section.content1.length > 300 ? '...' : ''}
                                        </p>
                                    </div>
                                ` : ''}
                                
                                ${section.status === 'modified' ? `
                                    <div class="mt-3 p-3 bg-white rounded">
                                        <p class="text-xs text-gray-600 mb-2">Content has been modified</p>
                                        ${section.content1 && section.content2 ? `
                                            <div class="grid grid-cols-2 gap-2 text-xs">
                                                <div class="p-2 bg-red-50 rounded">
                                                    <p class="font-medium text-red-700 mb-1">Previous:</p>
                                                    <p class="text-red-600">
                                                        ${escapeHtml(section.content1.substring(0, 150))}${section.content1.length > 150 ? '...' : ''}
                                                    </p>
                                                </div>
                                                <div class="p-2 bg-green-50 rounded">
                                                    <p class="font-medium text-green-700 mb-1">Current:</p>
                                                    <p class="text-green-600">
                                                        ${escapeHtml(section.content2.substring(0, 150))}${section.content2.length > 150 ? '...' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).filter(html => html !== '').join('')}
            </div>
            
            <!-- Controls -->
            <div class="mt-6 pt-4 border-t flex items-center justify-between">
                <label class="flex items-center text-sm text-gray-700">
                    <input type="checkbox" id="showUnchangedSections" onchange="performEnhancedComparison()" class="mr-2">
                    Show unchanged sections
                </label>
                <div class="flex gap-2">
                    <button onclick="exportComparison()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        <i class="fas fa-download mr-1"></i>Export
                    </button>
                    <button onclick="printComparison()" class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
                        <i class="fas fa-print mr-1"></i>Print
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export comparison to JSON
function exportComparison() {
    // Implementation for exporting comparison data
    console.log('Export comparison');
}

// Print comparison
function printComparison() {
    window.print();
}
// Render comparison content based on view mode
function renderComparisonContent(comparison) {
    const container = document.getElementById('comparisonContent');
    
    if (enhancedState.comparisonView === 'side-by-side') {
        renderSideBySideComparison(container, comparison);
    } else {
        renderUnifiedComparison(container, comparison);
    }
}
function renderUnifiedComparison(container, comparison) {
    // Simplified unified view
    const filteredSections = filterSections(comparison.sections);
    
    container.innerHTML = `
        <div class="p-6 overflow-y-auto">
            <div class="space-y-4">
                ${filteredSections.map(section => `
                    <div class="border rounded-lg p-4 ${
                        section.status === 'added' ? 'border-green-500 bg-green-50' :
                        section.status === 'removed' ? 'border-red-500 bg-red-50' :
                        section.status === 'modified' ? 'border-yellow-500 bg-yellow-50' :
                        'border-gray-300'
                    }">
                        <h3 class="font-bold">${section.name} - ${section.status}</h3>
                        ${section.differences.map(diff => `
                            <div class="mt-2 text-sm">
                                ${diff.type === 'added' ? '<span class="text-green-600">+ ' + diff.content2 + '</span>' :
                                  diff.type === 'removed' ? '<span class="text-red-600">- ' + diff.content1 + '</span>' :
                                  '<span class="text-yellow-600">~ ' + diff.content2 + '</span>'}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
// Render side-by-side comparison
function renderSideBySideComparison(container, comparison) {
    const filteredSections = filterSections(comparison.sections);
    
    container.innerHTML = `
        <div class="flex h-full">
            <!-- Label 1 Panel -->
            <div class="w-1/2 border-r border-gray-300 overflow-y-auto p-4">
                <h4 class="font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b">
                    ${comparison.metadata.label1.name}
                    <span class="text-sm font-normal text-gray-600 ml-2">
                        v${comparison.metadata.label1.version || 'N/A'}
                    </span>
                </h4>
                <div class="space-y-4">
                    ${filteredSections.map(section => renderSectionPanel(section, 'left')).join('')}
                </div>
            </div>
            
            <!-- Label 2 Panel -->
            <div class="w-1/2 overflow-y-auto p-4">
                <h4 class="font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b">
                    ${comparison.metadata.label2.name}
                    <span class="text-sm font-normal text-gray-600 ml-2">
                        v${comparison.metadata.label2.version || 'N/A'}
                    </span>
                </h4>
                <div class="space-y-4">
                    ${filteredSections.map(section => renderSectionPanel(section, 'right')).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Sync scroll positions
    const panels = container.querySelectorAll('.overflow-y-auto');
    panels.forEach(panel => {
        panel.addEventListener('scroll', () => {
            panels.forEach(otherPanel => {
                if (otherPanel !== panel) {
                    otherPanel.scrollTop = panel.scrollTop;
                }
            });
        });
    });
}

// Render section panel
function renderSectionPanel(section, side) {
    const content = side === 'left' ? section.content1 : section.content2;
    
    if (!content && section.status === 'removed' && side === 'right') {
        return `
            <div class="opacity-40 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h5 class="font-semibold text-gray-500 line-through">${section.name}</h5>
                <p class="text-sm text-gray-400 mt-2">Section removed</p>
            </div>
        `;
    }
    
    if (!content && section.status === 'added' && side === 'left') {
        return `
            <div class="opacity-40 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h5 class="font-semibold text-gray-500">${section.name}</h5>
                <p class="text-sm text-gray-400 mt-2">Section not present</p>
            </div>
        `;
    }
    
    if (!content) return '';
    
    const statusColors = {
        added: 'border-green-500 bg-green-50',
        removed: 'border-red-500 bg-red-50',
        modified: 'border-yellow-500 bg-yellow-50',
        unchanged: 'border-gray-300 bg-white'
    };
    
    return `
        <div class="border-l-4 ${statusColors[section.status]} p-4 rounded-lg">
            <div class="flex justify-between items-start mb-2">
                <h5 class="font-semibold text-gray-900">${section.name}</h5>
                ${section.status !== 'unchanged' ? `
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${
                        section.status === 'added' ? 'bg-green-100 text-green-700' :
                        section.status === 'removed' ? 'bg-red-100 text-red-700' :
                        section.status === 'modified' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                    }">
                        ${section.status}
                    </span>
                ` : ''}
            </div>
            <div class="text-sm text-gray-700 whitespace-pre-wrap ${
                section.status === 'removed' ? 'line-through opacity-60' : ''
            }">
                ${highlightDifferences(content.text, section.differences, side)}
            </div>
        </div>
    `;
}

// Highlight differences in text
function highlightDifferences(text, differences, side) {
    if (!differences || differences.length === 0) return text;
    
    let highlightedText = text;
    differences.forEach(diff => {
        if (diff.type === 'modified' && side === 'right') {
            // Highlight modified content
            highlightedText = highlightedText.replace(
                diff.content2,
                `<mark class="bg-yellow-200">${diff.content2}</mark>`
            );
        }
    });
    
    return highlightedText;
}

// Filter sections based on current filter
function filterSections(sections) {
    if (enhancedState.sectionFilter === 'all') {
        return sections;
    }
    
    if (enhancedState.sectionFilter === 'changed') {
        return sections.filter(s => s.status !== 'unchanged');
    }
    
    return sections.filter(s => s.status === enhancedState.sectionFilter);
}

// Filter comparison sections
function filterComparisonSections(filter) {
    enhancedState.sectionFilter = filter;
    
    // Update button styles
    document.querySelectorAll('#enhancedComparisonModal button').forEach(btn => {
        if (btn.textContent.toLowerCase().includes(filter)) {
            btn.className = btn.className.replace('bg-gray-200 text-gray-700', 'bg-blue-600 text-white');
        } else if (btn.onclick && btn.onclick.toString().includes('filterComparisonSections')) {
            btn.className = btn.className.replace('bg-blue-600 text-white', 'bg-gray-200 text-gray-700');
        }
    });
    
    // Re-render comparison
    if (enhancedState.currentComparison) {
        renderComparisonContent(enhancedState.currentComparison);
    }
}

// Toggle diff view
function toggleDiffView() {
    enhancedState.comparisonView = enhancedState.comparisonView === 'side-by-side' ? 'unified' : 'side-by-side';
    if (enhancedState.currentComparison) {
        renderComparisonContent(enhancedState.currentComparison);
    }
}

// Export comparison
function exportComparison() {
    if (!enhancedState.currentComparison) return;
    
    const comparison = enhancedState.currentComparison;
    const report = generateComparisonReport(comparison);
    
    const blob = new Blob([report], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `label_comparison_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

// Generate comparison report
function generateComparisonReport(comparison) {
    return `
      
        <head>
            <title>Label Comparison Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { background: #f0f0f0; padding: 10px; margin-bottom: 20px; }
                .stats { display: flex; gap: 20px; margin-bottom: 20px; }
                .stat { padding: 10px; background: #f9f9f9; border-radius: 5px; }
                .section { margin-bottom: 20px; padding: 10px; border-left: 3px solid #ddd; }
                .added { border-color: #22c55e; background: #f0fdf4; }
                .removed { border-color: #ef4444; background: #fef2f2; }
                .modified { border-color: #fbbf24; background: #fffbeb; }
            </style>
        </head>
        <div>
            <div class="header">
                <h1>Label Comparison Report</h1>
                <p>${comparison.metadata.label1.name} vs ${comparison.metadata.label2.name}</p>
                <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
            <div class="stats">
                <div class="stat">Added: ${comparison.statistics.sectionsAdded}</div>
                <div class="stat">Removed: ${comparison.statistics.sectionsRemoved}</div>
                <div class="stat">Modified: ${comparison.statistics.sectionsModified}</div>
                <div class="stat">Unchanged: ${comparison.statistics.sectionsUnchanged}</div>
            </div>
            ${comparison.sections.map(section => `
                <div class="section ${section.status}">
                    <h3>${section.name} (${section.status})</h3>
                    ${section.content1 ? `<div><strong>Label 1:</strong> ${section.content1.text}</div>` : ''}
                    ${section.content2 ? `<div><strong>Label 2:</strong> ${section.content2.text}</div>` : ''}
                </div>
            `).join('')}
        </div>
     
    `;
}

// Update compare options to include uploaded labels
function updateCompareOptions() {
    const select1 = document.getElementById('compareLabel1');
    const select2 = document.getElementById('compareLabel2');
    
    if (!select1 || !select2) return;
    
    const uploadedOptions = Array.from(enhancedState.uploadedLabels.values()).map(label => `
        <option value="${label.id}">
            [Uploaded] ${label.name} - v${label.metadata?.versionNumber || 'N/A'}
        </option>
    `).join('');
    
    // Keep existing options and add uploaded ones
    const existingOptions1 = Array.from(select1.options).filter(opt => !opt.value.startsWith('upload_'));
    const existingOptions2 = Array.from(select2.options).filter(opt => !opt.value.startsWith('upload_'));
    
    select1.innerHTML = existingOptions1.map(opt => opt.outerHTML).join('') + uploadedOptions;
    select2.innerHTML = existingOptions2.map(opt => opt.outerHTML).join('') + uploadedOptions;
}

// Show notification
function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' :
                'fa-info-circle'
            } mr-2"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-slide-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}


// Modal control functions
function openEnhancedUploadModal() {
    uploadModal = document.getElementById('enhancedUploadModal')
    if (!uploadModal) {
                // Create the modal element
        uploadModal = document.createElement('div');
        uploadModal.id = 'enhancedUploadModal';
        uploadModal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        // Set the innerHTML properly (using = not backticks)
        uploadModal.innerHTML = `
<div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
            <h3 class="text-2xl font-bold text-gray-900">
                <i class="fas fa-file-code mr-2 text-green-600"></i>XML Label Management
            </h3>
            <button onclick="closeEnhancedUploadModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1">
            <!-- Upload Section -->
            <div class="mb-6 bg-gray-50 rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-4">Upload New XML Label</h4>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Select XML File</label>
                        <input type="file" id="xmlUploadFile" accept=".xml" class="w-full p-2 border rounded-lg">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Label Name</label>
                            <input type="text" id="xmlLabelName" placeholder="e.g., Product Name v2.0" 
                                   class="w-full px-4 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <input type="text" id="xmlLabelDescription" placeholder="Optional description" 
                                   class="w-full px-4 py-2 border rounded-lg">
                        </div>
                    </div>
                    <!-- <button onclick="uploadXMLLabel()" class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold">
                        <i class="fas fa-cloud-upload-alt mr-2"></i>Upload XML Label
                    </button> -->
                    <button type="button" onclick="return uploadXMLLabel(event)" 
        class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold">
    <i class="fas fa-cloud-upload-alt mr-2"></i>Upload XML Label
</button>
                </div>
            </div>
            
            <!-- Uploaded Labels Management -->
            <div>
                <h4 class="font-semibold text-gray-900 mb-4">Uploaded Labels</h4>
                <div id="uploadedLabelsList" class="space-y-3 max-h-64 overflow-y-auto">
                    <!-- Uploaded labels will be displayed here -->
                </div>
            </div>
        </div>
    </div>
        `;
        
        // Append to body
        document.body.appendChild(uploadModal);
    }
    uploadModal.classList.remove('hidden');
    loadUploadedLabels();
}

function closeEnhancedUploadModal() {
    document.getElementById('enhancedUploadModal').classList.add('hidden');
}

function closeComparisonModal() {
    document.getElementById('enhancedComparisonModal').classList.add('hidden');
}

function showComparisonLoading() {
    const content = document.getElementById('comparisonContent');
    content.innerHTML = `
        <div class="flex items-center justify-center h-full">
            <div class="text-center">
                <div class="loader mx-auto mb-4"></div>
                <p class="text-gray-600">Analyzing labels...</p>
            </div>
        </div>
    `;
}

// Update the main compare button to use enhanced comparison
document.addEventListener('DOMContentLoaded', () => {
    // Replace the old compare button function
    const compareBtn = document.querySelector('button[onclick*="compareLabels"]');
    if (compareBtn) {
        compareBtn.onclick = performEnhancedComparison;
    }
    
    // Replace the upload button function
    const uploadBtn = document.querySelector('button[onclick*="uploadModal"]');
    if (uploadBtn) {
        uploadBtn.onclick = openEnhancedUploadModal;
    }
});

// Add animation styles
const styleElement = document.createElement('style');
styleElement.textContent = `
    @keyframes slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .animate-slide-in { animation: slide-in 0.3s ease-out; }
    .animate-slide-out { animation: slide-out 0.3s ease-out; }
    mark { padding: 2px 4px; border-radius: 3px; }
`;
document.head.appendChild(styleElement);


        // Quick search
        function quickSearch(drug) {
            document.getElementById('mainSearch').value = drug;
            performSearch();
        }

        // Enhanced search with better data processing
        async function performSearch() {
            const searchTerm = document.getElementById('mainSearch').value.trim();
            if (!searchTerm) {
                alert('Please enter a search term');
                return;
            }

            state.currentSearch = searchTerm;
            showLabelLoading(true);

            try {
                const response = await fetch(`${API_BASE}/comprehensive-search/${encodeURIComponent(searchTerm)}`);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }

                // Process and enhance the data
                processSearchData(data);
                
                if (state.applications.length === 0 && state.labels.length === 0) {
                    showNoResults();
                } else {
                    displayResults();
                }
            } catch (error) {
                console.error('Search error:', error);
                // alert(error);
                showLabelLoading(false);
            }
        }

        // Process and enhance search data
        function processSearchData(data) {
            state.drugData = data;
            state.applications = data.applications || [];
            state.labels = data.labels || [];
            state.ndcCodes = data.ndcCodes || [];
            
            // Process companies with enhanced data
            processCompanies(data);
            
            // Generate enhanced timeline with change analysis
            generateEnhancedTimeline(data);
            
            // Analyze label changes and reasons
            analyzeLabelChanges();
        }

        // Process companies with relationship mapping
// function processCompanies(data) {
//     state.companies.clear();
    
//     // Create a map of products to their applications and labels
//     const productMap = new Map();
    
//     // Map applications to products
//     state.applications.forEach(app => {
//         const productName = normalizeProductName(app.productName);
//         if (!productMap.has(productName)) {
//             productMap.set(productName, { applications: [], labels: [] });
//         }
//         productMap.get(productName).applications.push(app);
//     });
    
//     // Map labels to products
//     state.labels.forEach(label => {
//         const productName = normalizeProductName(label.productName);
//         if (!productMap.has(productName)) {
//             productMap.set(productName, { applications: [], labels: [] });
//         }
//         productMap.get(productName).labels.push(label);
//     });
    
//     // Now build companies based on product relationships
//     state.applications.forEach(app => {
//         const companyName = app.sponsorName || 'Unknown';
//         const productName = normalizeProductName(app.productName);
        
//         if (!state.companies.has(companyName)) {
//             state.companies.set(companyName, {
//                 name: companyName,
//                 applications: [],
//                 labels: [],
//                 products: new Set(),
//                 timeline: []
//             });
//         }
        
//         const company = state.companies.get(companyName);
//         company.applications.push(app);
//         company.products.add(app.productName);
        
//         // Add labels for this product to this company
//         const productData = productMap.get(productName);
//         if (productData && productData.labels.length > 0) {
//             // Add labels that match this product to the company
//             productData.labels.forEach(label => {
//                 if (!company.labels.some(l => l.id === label.id)) {
//                     company.labels.push(label);
//                 }
//             });
//         }
//     });
    
//     // Also process labels that don't have matching applications
//     state.labels.forEach(label => {
//         const companyName = label.manufacturerName || 'Unknown';
//         const productName = normalizeProductName(label.productName);
//         const productData = productMap.get(productName);
        
//         // If this product has applications, skip (already handled above)
//         if (productData && productData.applications.length > 0) {
//             return;
//         }
        
//         // This is a label without a matching application (repackager)
//         if (!state.companies.has(companyName)) {
//             state.companies.set(companyName, {
//                 name: companyName,
//                 applications: [],
//                 labels: [],
//                 products: new Set(),
//                 timeline: []
//             });
//         }
        
//         const company = state.companies.get(companyName);
//         if (!company.labels.some(l => l.id === label.id)) {
//             company.labels.push(label);
//             company.products.add(label.productName);
//         }
//     });
    
//     // Generate company timelines
//     state.companies.forEach(company => {
//         company.timeline = generateCompanyTimeline(company);
//     });
    
//     console.log('Company processing complete:', {
//         totalCompanies: state.companies.size,
//         companiesWithBoth: Array.from(state.companies.values()).filter(c => c.applications.length > 0 && c.labels.length > 0).length,
//         companiesWithAppsOnly: Array.from(state.companies.values()).filter(c => c.applications.length > 0 && c.labels.length === 0).length,
//         companiesWithLabelsOnly: Array.from(state.companies.values()).filter(c => c.applications.length === 0 && c.labels.length > 0).length
//     });
// }
// Process companies with relationship mapping
function processCompanies(data) {
    state.companies.clear();
    
    // First, map companies by their original sources
    state.applications.forEach(app => {
        const companyName = app.sponsorName || 'Unknown';
        if (!state.companies.has(companyName)) {
            state.companies.set(companyName, {
                name: companyName,
                applications: [],
                labels: [],
                products: new Set(),
                timeline: []
            });
        }
        const company = state.companies.get(companyName);
        company.applications.push(app);
        if (app.productName) company.products.add(app.productName);
    });
    
    // Map labels to companies - DON'T duplicate them
    state.labels.forEach(label => {
        const companyName = label.manufacturerName || 'Unknown';
        if (!state.companies.has(companyName)) {
            state.companies.set(companyName, {
                name: companyName,
                applications: [],
                labels: [],
                products: new Set(),
                timeline: []
            });
        }
        const company = state.companies.get(companyName);
        company.labels.push(label);
        if (label.productName) company.products.add(label.productName);
    });
    
    // Generate company timelines
    state.companies.forEach(company => {
        company.timeline = generateCompanyTimeline(company);
    });
}
// Normalize product names for matching
function normalizeProductName(name) {
    if (!name) return 'unknown';
    
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[®™]/g, '')
        .replace(/\btablet(s)?\b/gi, '')
        .replace(/\bcapsule(s)?\b/gi, '')
        .replace(/\boral\b/gi, '')
        .replace(/\b(mg|mcg|%)\b/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
        // Generate enhanced timeline with change analysis
        function generateEnhancedTimeline(data) {
            const events = [];
            
            // Process applications
            state.applications.forEach(app => {
                if (app.approvalDate) {
                    events.push({
                        date: new Date(app.approvalDate),
                        type: 'approval',
                        subtype: 'initial',
                        title: 'FDA Approval',
                        description: `${app.productName} (${app.applicationNumber})`,
                        data: app,
                        importance: 'high'
                    });
                }
            });
            
            // Process labels with change detection
            const labelsByProduct = new Map();
            state.labels.forEach(label => {
                const key = label.productName || 'Unknown';
                if (!labelsByProduct.has(key)) {
                    labelsByProduct.set(key, []);
                }
                labelsByProduct.get(key).push(label);
            });
            
            // Analyze changes between label versions
            labelsByProduct.forEach((labels, productName) => {
                const sortedLabels = labels.sort((a, b) => 
                    new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0)
                );
                
                sortedLabels.forEach((label, index) => {
                    if (label.effectiveDate) {
                        const event = {
                            date: new Date(label.effectiveDate),
                            type: 'label',
                            subtype: index === 0 ? 'initial' : 'update',
                            title: `Label ${index === 0 ? 'Release' : 'Update'} v${label.version || index + 1}`,
                            description: productName,
                            data: label,
                            importance: 'medium'
                        };
                        
                        // Analyze what changed
                        if (index > 0) {
                            const previousLabel = sortedLabels[index - 1];
                            const changes = detectLabelChanges(previousLabel, label);
                            event.changes = changes;
                            event.changeReason = inferChangeReason(changes);
                            
                            if (changes.some(c => c.type === 'safety')) {
                                event.importance = 'high';
                                event.subtype = 'safety';
                            }
                        }
                        
                        events.push(event);
                    }
                });
            });
            
            // Sort by date
            state.timeline = events.sort((a, b) => b.date - a.date);
        }

        // Detect changes between label versions
        function detectLabelChanges(oldLabel, newLabel) {
            const changes = [];
            
            // Check boxed warning changes
            if (oldLabel.sections?.boxedWarning !== newLabel.sections?.boxedWarning) {
                changes.push({
                    type: 'safety',
                    section: 'Boxed Warning',
                    description: newLabel.sections?.boxedWarning ? 'Added/Modified boxed warning' : 'Removed boxed warning'
                });
            }
            
            // Check other critical sections
            const sectionsToCheck = [
                { key: 'contraindications', type: 'safety', name: 'Contraindications' },
                { key: 'warningsAndPrecautions', type: 'safety', name: 'Warnings and Precautions' },
                { key: 'adverseReactions', type: 'safety', name: 'Adverse Reactions' },
                { key: 'indicationsAndUsage', type: 'indication', name: 'Indications' },
                { key: 'dosageAndAdministration', type: 'dosage', name: 'Dosage' },
                { key: 'drugInteractions', type: 'safety', name: 'Drug Interactions' },
                { key: 'clinicalStudies', type: 'efficacy', name: 'Clinical Studies' }
            ];
            
            sectionsToCheck.forEach(section => {
                const oldContent = oldLabel.sections?.[section.key];
                const newContent = newLabel.sections?.[section.key];
                
                if (oldContent !== newContent) {
                    changes.push({
                        type: section.type,
                        section: section.name,
                        description: `${section.name} section updated`
                    });
                }
            });
            
            return changes;
        }

        // Infer reason for label change
        function inferChangeReason(changes) {
            if (changes.some(c => c.type === 'safety')) {
                return 'Safety Update - New safety information or risk identified';
            }
            if (changes.some(c => c.type === 'indication')) {
                return 'Indication Change - New indication added or existing modified';
            }
            if (changes.some(c => c.type === 'efficacy')) {
                return 'Efficacy Update - New clinical data or studies';
            }
            if (changes.some(c => c.type === 'dosage')) {
                return 'Dosage Modification - Dosing recommendations updated';
            }
            return 'Routine Update - Standard label maintenance';
        }

        // Analyze all label changes
        function analyzeLabelChanges() {
            state.labelChanges.clear();
            state.changeReasons.clear();
            
            let totalChanges = 0;
            state.timeline.forEach(event => {
                if (event.changes && event.changes.length > 0) {
                    totalChanges += event.changes.length;
                    event.changes.forEach(change => {
                        const count = state.labelChanges.get(change.type) || 0;
                        state.labelChanges.set(change.type, count + 1);
                    });
                    
                    const reason = event.changeReason;
                    const reasonCount = state.changeReasons.get(reason) || 0;
                    state.changeReasons.set(reason, reasonCount + 1);
                }
            });
            
            document.getElementById('statChanges').textContent = totalChanges;
        }

        // Generate company timeline
        function generateCompanyTimeline(company) {
            const timeline = [];
            
            company.applications.forEach(app => {
                if (app.approvalDate) {
                    timeline.push({
                        date: new Date(app.approvalDate),
                        type: 'approval',
                        title: `${app.productName} Approved`,
                        description: app.applicationNumber
                    });
                }
            });
            
            company.labels.forEach(label => {
                if (label.effectiveDate) {
                    timeline.push({
                        date: new Date(label.effectiveDate),
                        type: 'label',
                        title: `${label.productName} Label Update`,
                        description: `Version ${label.version || 'N/A'}`
                    });
                }
            });
            
            return timeline.sort((a, b) => b.date - a.date);
        }

        // Display results
        function displayResults() {
            showLabelLoading(false);
            document.getElementById('mainContent').classList.remove('hidden');
            document.getElementById('noResults').classList.add('hidden');

            updateStatistics();
            populateOverview();
            renderEnhancedTimeline();
            renderCompaniesAnalysis();
            populateCompareOptions();
            populateLabels();
            switchLabelTab('overview');
        }

        // Update statistics
        function updateStatistics() {
            document.getElementById('statApps').textContent = state.applications.length;
            document.getElementById('statCompanies').textContent = state.companies.size;
            document.getElementById('statLabels').textContent = state.labels.length;
            
            const latestDate = state.timeline.length > 0 ? state.timeline[0].date : new Date(0);
            document.getElementById('statUpdate').textContent = latestDate.getTime() > 0 
                ? latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A';
        }

        // Populate overview with enhanced application cards
        function populateOverview() {
            const container = document.getElementById('applicationsList');
            container.innerHTML = '';

            if (state.applications.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-4">No applications found</p>';
            } else {
                state.applications.forEach(app => {
                    const card = document.createElement('div');
                    card.className = 'bg-white border border-gray-200 rounded-lg p-4 hover-lift cursor-pointer';
                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="font-semibold text-gray-900">${app.applicationNumber || 'N/A'}</p>
                                <p class="text-sm text-gray-600">${app.productName || 'Unknown Product'}</p>
                                <p class="text-xs text-gray-500 mt-1">
                                    <i class="fas fa-building mr-1"></i>${app.sponsorName || 'Unknown Sponsor'}
                                </p>
                                <p class="text-xs text-gray-500">
                                    <i class="fas fa-calendar mr-1"></i>${formatDate(app.approvalDate)}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="viewApplicationDetails('${app.applicationNumber}')" 
                                        class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                                    <i class="fas fa-info-circle mr-1"></i>Details
                                </button>
                                <button onclick="viewApplicationTimeline('${app.applicationNumber}')" 
                                        class="hidden px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                                    <i class="fas fa-history mr-1"></i>Timeline
                                </button>
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }

            updateChart();
        }

        // Render enhanced timeline with horizontal scroll and grouping
// Render enhanced timeline with horizontal scroll and grouping
function renderEnhancedTimeline() {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';
    container.style.height = 'auto'; // Remove fixed height
    container.style.maxHeight = '600px'; // Set max height instead
    container.style.overflowY = 'auto'; // Allow vertical scrolling
    
    const filteredEvents = filterTimelineEvents();
    
    if (state.timelineGrouping === 'application') {
        renderGroupedTimeline(container, filteredEvents);
    } else if (state.timelineGrouping === 'year') {
        renderYearlyTimeline(container, filteredEvents);
    } else {
        renderHorizontalTimeline(container, filteredEvents);
    }
}

        // Filter timeline events
        function filterTimelineEvents() {
            if (state.timelineFilter === 'all') {
                return state.timeline;
            }
            
            return state.timeline.filter(event => {
                if (event.changes) {
                    return event.changes.some(c => c.type === state.timelineFilter);
                }
                return false;
            });
        }

        // Render horizontal scrollable timeline
// Render horizontal scrollable timeline
function renderHorizontalTimeline(container, events) {
    if (events.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No timeline events available</p>';
        return;
    }

    // Create a vertical timeline instead of horizontal for better readability
    container.innerHTML = '';
    container.style.overflow = 'auto';
    container.style.position = 'relative';
    
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'relative';
    timelineWrapper.style.paddingLeft = '50px';
    
    // Create vertical line
    const line = document.createElement('div');
    line.style.position = 'absolute';
    line.style.left = '25px';
    line.style.top = '0';
    line.style.bottom = '0';
    line.style.width = '3px';
    line.style.background = 'linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%)';
    timelineWrapper.appendChild(line);
    
    // Sort events by date (newest first)
    const sortedEvents = [...events].sort((a, b) => b.date - a.date);
    
    // Create event nodes
    sortedEvents.forEach((event, index) => {
        const eventNode = document.createElement('div');
        eventNode.className = 'relative mb-6 ml-4';
        
        // Node icon based on type
        const iconClass = event.type === 'approval' ? 'fa-check-circle text-green-600' :
                         event.subtype === 'safety' ? 'fa-exclamation-triangle text-red-600' :
                         event.type === 'label' ? 'fa-tag text-blue-600' :
                         'fa-circle text-gray-600';
        
        // Node size based on importance
        const nodeSize = event.importance === 'high' ? 'w-10 h-10' : 'w-8 h-8';
        
        eventNode.innerHTML = `
            <div class="absolute -left-8 top-2 ${nodeSize} bg-white rounded-full flex items-center justify-center border-2 border-gray-300 shadow-md z-10">
                <i class="fas ${iconClass} text-sm"></i>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 ml-4 hover:shadow-md transition-all cursor-pointer">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-semibold text-gray-900">${event.title}</p>
                        <p class="text-sm text-gray-600">${event.description}</p>
                    </div>
                    <span class="text-xs text-gray-500 whitespace-nowrap ml-4">${formatDate(event.date)}</span>
                </div>
                ${event.changes && event.changes.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <div class="flex flex-wrap gap-1">
                            ${event.changes.map(c => `
                                <span class="change-badge change-${c.type}">${c.type}</span>
                            `).join('')}
                        </div>
                        ${event.changeReason ? `
                            <p class="text-xs text-gray-600 mt-2 italic">${event.changeReason}</p>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        
        eventNode.onclick = () => showEventDetails(event);
        timelineWrapper.appendChild(eventNode);
    });
    
    container.appendChild(timelineWrapper);
}
        // Render grouped timeline by application
        function renderGroupedTimeline(container, events) {
            const grouped = new Map();
            
            events.forEach(event => {
                const key = event.data?.applicationNumber || event.data?.productName || 'Unknown';
                if (!grouped.has(key)) {
                    grouped.set(key, []);
                }
                grouped.get(key).push(event);
            });
            
            container.innerHTML = '';
            container.style.overflow = 'auto';
            
            grouped.forEach((groupEvents, key) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'mb-8';
                groupDiv.innerHTML = `
                    <h4 class="font-semibold text-gray-900 mb-4 sticky top-0 bg-white z-10 py-2">
                        <i class="fas fa-pills text-blue-600 mr-2"></i>${key}
                    </h4>
                    <div class="product-timeline">
                        ${groupEvents.map(event => `
                            <div class="product-event">
                                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover-lift">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-gray-900">${event.title}</p>
                                            <p class="text-sm text-gray-600">${event.description}</p>
                                            <p class="text-xs text-gray-500 mt-1">${formatDate(event.date)}</p>
                                        </div>
                                        ${event.changes ? `
                                            <div class="flex gap-1">
                                                ${event.changes.map(c => `
                                                    <span class="change-badge change-${c.type}">${c.type}</span>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${event.changeReason ? `
                                        <p class="text-xs text-gray-600 mt-2 italic border-l-2 border-blue-300 pl-2">
                                            ${event.changeReason}
                                        </p>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(groupDiv);
            });
        }

        // Render yearly timeline
        function renderYearlyTimeline(container, events) {
            const grouped = new Map();
            
            events.forEach(event => {
                const year = event.date.getFullYear();
                if (!grouped.has(year)) {
                    grouped.set(year, []);
                }
                grouped.get(year).push(event);
            });
            
            container.innerHTML = '';
            container.style.overflow = 'auto';
            
            const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
            
            sortedYears.forEach(year => {
                const yearEvents = grouped.get(year);
                const yearDiv = document.createElement('div');
                yearDiv.className = 'mb-8';
                yearDiv.innerHTML = `
                    <h4 class="text-xl font-bold text-gray-900 mb-4 sticky top-0 bg-white z-10 py-2 border-b">
                        ${year} <span class="text-sm font-normal text-gray-600">(${yearEvents.length} events)</span>
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${yearEvents.map(event => `
                            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover-lift">
                                <div class="flex items-start justify-between mb-2">
                                    <i class="fas ${event.type === 'approval' ? 'fa-check-circle text-green-600' : 
                                                    event.subtype === 'safety' ? 'fa-exclamation-triangle text-red-600' :
                                                    'fa-tag text-blue-600'} text-lg"></i>
                                    <span class="text-xs text-gray-500">${formatDate(event.date)}</span>
                                </div>
                                <p class="font-medium text-gray-900 text-sm">${event.title}</p>
                                <p class="text-xs text-gray-600 mt-1">${event.description}</p>
                                ${event.changes ? `
                                    <div class="mt-2 flex flex-wrap gap-1">
                                        ${event.changes.map(c => `
                                            <span class="change-badge change-${c.type}">${c.type}</span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(yearDiv);
            });
        }

        // Render enhanced companies analysis
        function renderCompaniesAnalysis() {
            const container = document.getElementById('companiesContent');
            container.innerHTML = '';
            
            if (state.companies.size === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">No company data available</p>';
                return;
            }
            
            // Create company cards with full analysis
            state.companies.forEach(company => {
                const companyCard = document.createElement('div');
                companyCard.className = 'bg-white rounded-xl shadow-lg border border-gray-200 mb-6 overflow-hidden';
                
                companyCard.innerHTML = `
                    <div class="p-6 bg-gradient-to-r from-purple-50 to-blue-50">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-xl font-bold text-gray-900">
                                    <i class="fas fa-building text-purple-600 mr-2"></i>${company.name}
                                </h3>
                                <p class="text-sm text-gray-600 mt-1">
                                    ${company.applications.length} applications • ${company.labels.length} labels • ${company.products.size} products
                                </p>
                            </div>
                            <button onclick="openCompanyModal('${company.name}')" 
                                    class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all">
                                <i class="fas fa-chart-line mr-2"></i>Full Analysis
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="company-metric">
                                <p class="text-xs text-gray-600 uppercase">Total Applications</p>
                                <p class="text-2xl font-bold text-gray-900">${company.applications.length}</p>
                            </div>
                            <div class="company-metric">
                                <p class="text-xs text-gray-600 uppercase">Active Products</p>
                                <p class="text-2xl font-bold text-gray-900">${company.products.size}</p>
                            </div>
                            <div class="company-metric">
                                <p class="text-xs text-gray-600 uppercase">Label Updates</p>
                                <p class="text-2xl font-bold text-gray-900">${company.labels.length}</p>
                            </div>
                        </div>
                        
                        ${company.applications.length > 0 && company.labels.length === 0 ? `
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <p class="text-sm text-yellow-800">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    This company has ${company.applications.length} application(s) but no label data found. 
                                    This may indicate pending approvals or data availability issues.
                                </p>
                            </div>
                        ` : ''}
                        
                        ${company.labels.length > 0 && company.applications.length === 0 ? `
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p class="text-sm text-blue-800">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    Found ${company.labels.length} label(s) but no application data. 
                                    The application data may be under a different sponsor name.
                                </p>
                            </div>
                        ` : ''}
                        
                        <div class="space-y-3">
                            <h4 class="font-semibold text-gray-900">Recent Activity</h4>
                            ${company.timeline.slice(0, 3).map(event => `
                                <div class="flex items-start space-x-3 text-sm">
                                    <i class="fas ${event.type === 'approval' ? 'fa-check-circle text-green-600' : 'fa-tag text-blue-600'} mt-1"></i>
                                    <div>
                                        <p class="text-gray-900">${event.title}</p>
                                        <p class="text-xs text-gray-500">${formatDate(event.date)}</p>
                                    </div>
                                </div>
                            `).join('') || '<p class="text-gray-500 text-sm">No recent activity</p>'}
                        </div>
                    </div>
                `;
                
                container.appendChild(companyCard);
            });
        }
// async function compareLabels() {
//     // Call the enhanced version instead
//    return performEnhancedComparison();
// }
// Fixed compare function with better error handling
// async function compareLabels() {
//     const label1Id = document.getElementById('compareLabel1').value;
//     const label2Id = document.getElementById('compareLabel2').value;
    
//     if (!label1Id || !label2Id) {
//         alert('Please select two labels to compare');
//         return;
//     }
    
//     if (label1Id === label2Id) {
//         alert('Please select different labels to compare');
//         return;
//     }
    
//     const resultDiv = document.getElementById('comparisonResult');
//     resultDiv.innerHTML = `
//         <div class="text-center py-8">
//             <div class="loader mx-auto mb-4"></div>
//             <p class="text-gray-600">Loading labels for comparison...</p>
//         </div>
//     `;
    
//     try {
//         // Clean the label IDs
//         const cleanLabel1Id = label1Id.replace(/^label_/, '');
//         const cleanLabel2Id = label2Id.replace(/^label_/, '');
        
//         console.log('Fetching label 1:', cleanLabel1Id);
//         console.log('Fetching label 2:', cleanLabel2Id);
        
//         // Fetch both labels
//         const [response1, response2] = await Promise.all([
//             fetch(`${API_BASE}/label-content/${cleanLabel1Id}`),
//             fetch(`${API_BASE}/label-content/${cleanLabel2Id}`)
//         ]);
        
//         let labelData1 = null;
//         let labelData2 = null;
        
//         if (response1.ok) {
//             labelData1 = await response1.json();
//         } else {
//             console.error('Failed to load label 1');
//         }
        
//         if (response2.ok) {
//             labelData2 = await response2.json();
//         } else {
//             console.error('Failed to load label 2');
//         }
        
//         // Display the improved comparison
//         displayImprovedComparison(labelData1, labelData2, cleanLabel1Id, cleanLabel2Id);
        
//     } catch (error) {
//         console.error('Comparison error:', error);
//         resultDiv.innerHTML = `
//             <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
//                 <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-3"></i>
//                 <p class="text-red-700 font-semibold">Error loading labels</p>
//                 <p class="text-sm text-red-600 mt-2">${error.message}</p>
//                 <button onclick="compareLabels()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
//                     <i class="fas fa-redo mr-1"></i>Retry
//                 </button>
//             </div>
//         `;
//     }
// }

async function compareLabels() {
    const label1Id = document.getElementById('compareLabel1').value;
    const label2Id = document.getElementById('compareLabel2').value;
    
    if (!label1Id || !label2Id) {
        alert('Please select two labels to compare');
        return;
    }
    
    if (label1Id === label2Id) {
        alert('Please select different labels to compare');
        return;
    }
    
    const resultDiv = document.getElementById('comparisonResult');
    resultDiv.innerHTML = `
        <div class="text-center py-8">
            <div class="loader mx-auto mb-4"></div>
            <p class="text-gray-600">Loading labels for comparison...</p>
        </div>
    `;
    
    try {
        // Clean the label IDs
        const cleanLabel1Id = label1Id.replace(/^label_/, '');
        const cleanLabel2Id = label2Id.replace(/^label_/, '');
        
        console.log('Fetching label 1:', cleanLabel1Id);
        console.log('Fetching label 2:', cleanLabel2Id);
        
        // Fetch both labels
        const [response1, response2] = await Promise.all([
            fetch(`${API_BASE}/label-content/${cleanLabel1Id}`),
            fetch(`${API_BASE}/label-content/${cleanLabel2Id}`)
        ]);
        
        let labelData1 = null;
        let labelData2 = null;
        
        if (response1.ok) {
            labelData1 = await response1.json();
            console.log('Label 1 XML:', labelData1.xml?.raw ? 'Available' : 'Not available');
        } else {
            console.error('Failed to load label 1');
        }
        
        if (response2.ok) {
            labelData2 = await response2.json();
            console.log('Label 2 XML:', labelData2.xml?.raw ? 'Available' : 'Not available');
        } else {
            console.error('Failed to load label 2');
        }
        
        // Display the labels side by side using the XML formatting
        displaySideBySideLabels(labelData1, labelData2, cleanLabel1Id, cleanLabel2Id);
        
    } catch (error) {
        console.error('Comparison error:', error);
        resultDiv.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-3"></i>
                <p class="text-red-700 font-semibold">Error loading labels</p>
                <p class="text-sm text-red-600 mt-2">${error.message}</p>
                <button onclick="compareLabels()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                    <i class="fas fa-redo mr-1"></i>Retry
                </button>
            </div>
        `;
    }
}

function displaySideBySideLabels(labelData1, labelData2, labelId1, labelId2) {
    const resultDiv = document.getElementById('comparisonResult');
    
    // Get the formatted HTML for each label using the XML formatter
    let formattedLabel1 = '';
    let formattedLabel2 = '';
    
    // Format Label 1
    if (labelData1?.xml?.raw) {
        formattedLabel1 = formatPharmaceuticalXML(labelData1.xml.raw);
    } else if (labelData1?.data) {
        // Fallback to displaying parsed data if no XML
        formattedLabel1 = formatParsedLabelData(labelData1.data, labelId1);
    } else {
        formattedLabel1 = `
            <div class="no-data-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>No XML data available for this label</p>
                <p class="label-id">Label ID: ${labelId1}</p>
            </div>
        `;
    }
    
    // Format Label 2
    if (labelData2?.xml?.raw) {
        formattedLabel2 = formatPharmaceuticalXML(labelData2.xml.raw);
    } else if (labelData2?.data) {
        // Fallback to displaying parsed data if no XML
        formattedLabel2 = formatParsedLabelData(labelData2.data, labelId2);
    } else {
        formattedLabel2 = `
            <div class="no-data-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>No XML data available for this label</p>
                <p class="label-id">Label ID: ${labelId2}</p>
            </div>
        `;
    }
    
    // Create the side-by-side layout
    resultDiv.innerHTML = `
        <div class="comparison-container">
            ${getSideBySideStyles()}
            
            <!-- Comparison Header -->
            <div class="comparison-header">
                <h2 class="comparison-title">
                    <i class="fas fa-balance-scale"></i>
                    Label Comparison
                </h2>
                <div class="comparison-controls">
                    <button onclick="syncScroll()" class="sync-btn" id="syncScrollBtn">
                        <i class="fas fa-link"></i>
                        Sync Scrolling
                    </button>
                    <button onclick="swapLabels()" class="swap-btn">
                        <i class="fas fa-exchange-alt"></i>
                        Swap Labels
                    </button>

                </div>
            </div>
            
            <!-- Side by Side Labels -->
            <div class="labels-grid">
                <!-- Label 1 Container -->
                <div class="label-container" id="label1Container">
                    <div class="label-header-bar">
                        <span class="label-badge">Label 1</span>
                        <span class="label-id-display">${labelId1}</span>
                    </div>
                    <div class="label-content-wrapper" id="label1Content">
                        ${formattedLabel1}
                    </div>
                </div>
                
                <!-- Divider -->
                <div class="comparison-divider">
                    <div class="divider-line"></div>
                </div>
                
                <!-- Label 2 Container -->
                <div class="label-container" id="label2Container">
                    <div class="label-header-bar">
                        <span class="label-badge">Label 2</span>
                        <span class="label-id-display">${labelId2}</span>
                    </div>
                    <div class="label-content-wrapper" id="label2Content">
                        ${formattedLabel2}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize scroll sync if needed
    initializeComparisonFeatures();
}

function formatParsedLabelData(data, labelId) {
    // Fallback formatter for when XML is not available but parsed data is
    let html = `
        <div class="parsed-label-container">
            <div class="parsed-header">
                <h2>${data.metadata?.title || 'Pharmaceutical Label'}</h2>
                <div class="parsed-metadata">
    `;
    
    if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
            if (value) {
                html += `
                    <div class="meta-row">
                        <span class="meta-key">${key}:</span>
                        <span class="meta-value">${value}</span>
                    </div>
                `;
            }
        });
    }
    
    html += `
                </div>
            </div>
            <div class="parsed-sections">
    `;
    
    if (data.sections) {
        Object.entries(data.sections).forEach(([sectionTitle, sectionContent]) => {
            html += `
                <div class="parsed-section">
                    <h3 class="parsed-section-title">${sectionTitle}</h3>
                    <div class="parsed-section-content">
                        ${sectionContent}
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function getSideBySideStyles() {
    return `
        <style>
            .comparison-container {
                background: #f8f9fa;
                border-radius: 10px;
                overflow: hidden;
            }
            
            .comparison-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .comparison-title {
                font-size: 1.8em;
                font-weight: 600;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .comparison-controls {
                display: flex;
                gap: 10px;
            }
            
            .comparison-controls button {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                background: rgba(255,255,255,0.2);
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.9em;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .comparison-controls button:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-2px);
            }
            
            .sync-btn.active {
                background: rgba(76, 175, 80, 0.5);
            }
            
            .labels-grid {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                background: white;
                min-height: 600px;
            }
            
            .label-container {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .label-header-bar {
                background: #f0f0f0;
                padding: 12px 20px;
                border-bottom: 2px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            
            .label-badge {
                background: #667eea;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.85em;
                font-weight: 600;
            }
            
            .label-id-display {
                color: #6c757d;
                font-size: 0.85em;
                font-family: monospace;
            }
            
            .label-content-wrapper {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                max-height: calc(100vh - 300px);
            }
            
            .comparison-divider {
                width: 2px;
                background: #dee2e6;
                position: relative;
            }
            
            .divider-line {
                width: 100%;
                height: 100%;
                background: linear-gradient(180deg, 
                    transparent 0%, 
                    #dee2e6 10%, 
                    #dee2e6 90%, 
                    transparent 100%);
            }
            
            /* Override pharma label styles for side-by-side view */
            .label-content-wrapper .pharma-label-container {
                max-width: none;
                margin: 0;
            }
            
            .label-content-wrapper .label-header {
                border-radius: 10px;
                margin-bottom: 20px;
            }
            
            .label-content-wrapper .content-wrapper {
                grid-template-columns: 1fr;
            }
            
            .label-content-wrapper .sidebar {
                display: none;
            }
            
            .label-content-wrapper .main-content {
                padding: 0;
                max-height: none;
                overflow: visible;
            }
            
            /* No data message styles */
            .no-data-message {
                text-align: center;
                padding: 60px 20px;
                color: #6c757d;
            }
            
            .no-data-message i {
                font-size: 3em;
                margin-bottom: 20px;
                color: #dee2e6;
            }
            
            .no-data-message p {
                margin: 10px 0;
                font-size: 1.1em;
            }
            
            .no-data-message .label-id {
                font-size: 0.9em;
                font-family: monospace;
                color: #adb5bd;
            }
            
            /* Parsed data fallback styles */
            .parsed-label-container {
                padding: 20px;
            }
            
            .parsed-header {
                background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
            }
            
            .parsed-header h2 {
                color: #333;
                margin: 0 0 15px 0;
            }
            
            .parsed-metadata {
                display: grid;
                gap: 8px;
            }
            
            .meta-row {
                display: flex;
                gap: 10px;
                font-size: 0.9em;
            }
            
            .meta-key {
                font-weight: 600;
                color: #667eea;
                min-width: 120px;
            }
            
            .meta-value {
                color: #495057;
            }
            
            .parsed-section {
                margin-bottom: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
            }
            
            .parsed-section-title {
                color: #667eea;
                margin: 0 0 15px 0;
                padding-bottom: 10px;
                border-bottom: 2px solid #dee2e6;
            }
            
            .parsed-section-content {
                color: #495057;
                line-height: 1.6;
            }
            
            /* Responsive design */
            @media (max-width: 1200px) {
                .labels-grid {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto 1fr auto 1fr;
                }
                
                .comparison-divider {
                    width: 100%;
                    height: 2px;
                    grid-column: 1;
                }
                
                .label-container {
                    border-bottom: 2px solid #dee2e6;
                }
                
                .label-container:last-child {
                    border-bottom: none;
                }
            }
            
            @media print {
                .comparison-controls {
                    display: none;
                }
                
                .labels-grid {
                    display: block;
                }
                
                .label-container {
                    page-break-after: always;
                }
            }
        </style>
    `;
}

function initializeComparisonFeatures() {
    // Initialize any interactive features
    window.syncScrollEnabled = false;
    
    // Store original label data for swapping
    window.comparisonData = {
        label1: document.getElementById('label1Content').innerHTML,
        label2: document.getElementById('label2Content').innerHTML,
        label1Id: document.querySelector('#label1Container .label-id-display').textContent,
        label2Id: document.querySelector('#label2Container .label-id-display').textContent
    };
}

function syncScroll() {
    const btn = document.getElementById('syncScrollBtn');
    const label1Content = document.getElementById('label1Content');
    const label2Content = document.getElementById('label2Content');
    
    window.syncScrollEnabled = !window.syncScrollEnabled;
    
    if (window.syncScrollEnabled) {
        btn.classList.add('active');
        
        // Add scroll listeners
        label1Content.addEventListener('scroll', syncLabel2);
        label2Content.addEventListener('scroll', syncLabel1);
    } else {
        btn.classList.remove('active');
        
        // Remove scroll listeners
        label1Content.removeEventListener('scroll', syncLabel2);
        label2Content.removeEventListener('scroll', syncLabel1);
    }
    
    function syncLabel2() {
        if (window.syncScrollEnabled) {
            label2Content.scrollTop = label1Content.scrollTop;
        }
    }
    
    function syncLabel1() {
        if (window.syncScrollEnabled) {
            label1Content.scrollTop = label2Content.scrollTop;
        }
    }
}

function swapLabels() {
    if (!window.comparisonData) return;
    
    const label1Content = document.getElementById('label1Content');
    const label2Content = document.getElementById('label2Content');
    const label1IdDisplay = document.querySelector('#label1Container .label-id-display');
    const label2IdDisplay = document.querySelector('#label2Container .label-id-display');
    
    // Swap content
    const tempContent = label1Content.innerHTML;
    label1Content.innerHTML = label2Content.innerHTML;
    label2Content.innerHTML = tempContent;
    
    // Swap IDs
    const tempId = label1IdDisplay.textContent;
    label1IdDisplay.textContent = label2IdDisplay.textContent;
    label2IdDisplay.textContent = tempId;
    
    // Update stored data
    const tempData = window.comparisonData.label1;
    window.comparisonData.label1 = window.comparisonData.label2;
    window.comparisonData.label2 = tempData;
    
    const tempDataId = window.comparisonData.label1Id;
    window.comparisonData.label1Id = window.comparisonData.label2Id;
    window.comparisonData.label2Id = tempDataId;
}

function exportComparison() {
    // Create a combined HTML document for export
    const label1Content = document.getElementById('label1Content').innerHTML;
    const label2Content = document.getElementById('label2Content').innerHTML;
    const label1Id = document.querySelector('#label1Container .label-id-display').textContent;
    const label2Id = document.querySelector('#label2Container .label-id-display').textContent;
    
    const exportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Label Comparison: ${label1Id} vs ${label2Id}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .label-section { page-break-after: always; margin-bottom: 40px; }
                .label-header { background: #f0f0f0; padding: 10px; margin-bottom: 20px; }
                h1 { color: #333; }
            </style>
        </head>
        <body>
            <h1>Label Comparison Export</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            
            <div class="label-section">
                <div class="label-header">
                    <h2>Label 1: ${label1Id}</h2>
                </div>
                ${label1Content}
            </div>
            
            <div class="label-section">
                <div class="label-header">
                    <h2>Label 2: ${label2Id}</h2>
                </div>
                ${label2Content}
            </div>
        </body>
        </html>
    `;
    
    // Download the file
    const blob = new Blob([exportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `label_comparison_${label1Id}_vs_${label2Id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.compareLabels = compareLabels

function displayImprovedComparison(labelData1, labelData2, id1, id2) {
    const resultDiv = document.getElementById('comparisonResult');
    
    // Extract metadata
    const meta1 = labelData1?.metadata || {};
    const meta2 = labelData2?.metadata || {};
    
    const title1 = extractValue(meta1.title) || extractValue(meta1.productName) || `Label ${id1.substring(0, 8)}...`;
    const title2 = extractValue(meta2.title) || extractValue(meta2.productName) || `Label ${id2.substring(0, 8)}...`;
    
    const version1 = extractValue(meta1.versionNumber) || extractValue(meta1.version) || 'N/A';
    const version2 = extractValue(meta2.versionNumber) || extractValue(meta2.version) || 'N/A';
    
    const manufacturer1 = cleanManufacturerString(extractValue(meta1.manufacturer)) || 'Not specified';
    const manufacturer2 = cleanManufacturerString(extractValue(meta2.manufacturer)) || 'Not specified';
    
    // Get sections
    const sections1 = labelData1?.sections || {};
    const sections2 = labelData2?.sections || {};
    
    // Create a map of normalized section names to track matches
    const sectionMap = new Map();
    
    // Process sections from label 1
    Object.keys(sections1).forEach(section => {
        const normalized = normalizeSectionName(section);
        if (!sectionMap.has(normalized)) {
            sectionMap.set(normalized, { label1: section, label2: null });
        } else {
            sectionMap.get(normalized).label1 = section;
        }
    });
    
    // Process sections from label 2
    Object.keys(sections2).forEach(section => {
        const normalized = normalizeSectionName(section);
        if (!sectionMap.has(normalized)) {
            sectionMap.set(normalized, { label1: null, label2: section });
        } else {
            sectionMap.get(normalized).label2 = section;
        }
    });
    
    // Sort sections in FDA order
    const sectionOrder = [
        'boxed warning', 'lactic acidosis', 'indications and usage', 'dosage and administration',
        'dosage forms and strengths', 'contraindications', 'warnings and precautions',
        'adverse reactions', 'drug interactions', 'use in specific populations',
        'drug abuse and dependence', 'overdosage', 'description', 'clinical pharmacology',
        'nonclinical toxicology', 'clinical studies', 'references',
        'how supplied/storage and handling', 'how supplied', 'patient counseling information',
        'medication guide'
    ];
    
    const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => {
        const indexA = sectionOrder.indexOf(a[0]);
        const indexB = sectionOrder.indexOf(b[0]);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a[0].localeCompare(b[0]);
    });
    
    // Calculate statistics
    const commonSections = sortedSections.filter(([_, data]) => data.label1 && data.label2).length;
    const onlyLabel1 = sortedSections.filter(([_, data]) => data.label1 && !data.label2).length;
    const onlyLabel2 = sortedSections.filter(([_, data]) => !data.label1 && data.label2).length;
    
    // Build HTML
    let html = `
        <div class="space-y-6">
            <!-- Header with metadata -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 class="font-bold text-blue-900 text-lg mb-3">
                        <i class="fas fa-tag text-blue-600 mr-2"></i>${title1}
                    </h3>
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><span class="font-medium">Version:</span> ${version1}</p>
                        <p><span class="font-medium">Manufacturer:</span> ${manufacturer1}</p>
                        <p><span class="font-medium">Sections:</span> ${Object.keys(sections1).length}</p>
                        ${meta1.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(extractValue(meta1.effectiveDate))}</p>` : ''}
                    </div>
                </div>
                
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 class="font-bold text-purple-900 text-lg mb-3">
                        <i class="fas fa-tag text-purple-600 mr-2"></i>${title2}
                    </h3>
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><span class="font-medium">Version:</span> ${version2}</p>
                        <p><span class="font-medium">Manufacturer:</span> ${manufacturer2}</p>
                        <p><span class="font-medium">Sections:</span> ${Object.keys(sections2).length}</p>
                        ${meta2.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(extractValue(meta2.effectiveDate))}</p>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Improved Statistics -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Comparison Overview</h4>
                <div class="grid grid-cols-4 gap-3 text-center">
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-green-600">${commonSections}</div>
                        <div class="text-xs text-gray-600">Common Sections</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-blue-600">${onlyLabel1}</div>
                        <div class="text-xs text-gray-600">Only in Label 1</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-purple-600">${onlyLabel2}</div>
                        <div class="text-xs text-gray-600">Only in Label 2</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-gray-600">${sortedSections.length}</div>
                        <div class="text-xs text-gray-600">Total Unique Sections</div>
                    </div>
                </div>
            </div>
            
            <!-- Side-by-side sections -->
            <div class="space-y-4">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="font-bold text-gray-900 text-lg">Section-by-Section Comparison</h3>
                    <label class="flex items-center text-sm">
                        <input type="checkbox" id="showFullContent" onchange="toggleContentLength()" class="mr-2">
                        Show full content (may be long)
                    </label>
                </div>
                
                ${sortedSections.map(([normalizedName, data]) => {
                    const section1Name = data.label1 || '';
                    const section2Name = data.label2 || '';
                    const content1 = section1Name ? extractValue(sections1[section1Name]) : '';
                    const content2 = section2Name ? extractValue(sections2[section2Name]) : '';
                    
                    // Skip if both are empty or just ID references
                    if ((!content1 && !content2) || 
                        (content1.match(/^ID\d+$/) && content2.match(/^ID\d+$/))) {
                        return '';
                    }
                    
                    // Determine status
                    let status = 'both';
                    let statusColor = 'green';
                    let statusIcon = 'fa-check-circle';
                    let statusText = 'In both labels';
                    
                    if (content1 && !content2) {
                        status = 'only-left';
                        statusColor = 'blue';
                        statusIcon = 'fa-arrow-left';
                        statusText = 'Only in Label 1';
                    } else if (!content1 && content2) {
                        status = 'only-right';
                        statusColor = 'purple';
                        statusIcon = 'fa-arrow-right';
                        statusText = 'Only in Label 2';
                    } else if (content1 !== content2) {
                        status = 'different';
                        statusColor = 'yellow';
                        statusIcon = 'fa-exclamation-triangle';
                        statusText = 'Different content';
                    } else {
                        statusText = 'Identical content';
                    }
                    
                    // Use the proper display name (prefer the one with better formatting)
                    const displayName = section2Name || section1Name;
                    const isImportant = normalizedName.includes('warning') || 
                                       normalizedName.includes('contraindication') || 
                                       normalizedName.includes('lactic acidosis');
                    
                    return `
                        <div class="border ${isImportant ? 'border-red-300 bg-red-50' : 'border-gray-200'} rounded-lg overflow-hidden">
                            <div class="px-4 py-3 ${isImportant ? 'bg-red-100' : 'bg-gray-100'} border-b">
                                <div class="flex items-center justify-between">
                                    <h4 class="font-semibold ${isImportant ? 'text-red-900' : 'text-gray-900'} flex items-center">
                                        ${isImportant ? '<i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>' : ''}
                                        ${displayName}
                                    </h4>
                                    <span class="text-sm text-${statusColor}-600 flex items-center">
                                        <i class="fas ${statusIcon} mr-1"></i>
                                        ${statusText}
                                    </span>
                                </div>
                                ${section1Name && section2Name && section1Name !== section2Name ? `
                                    <p class="text-xs text-gray-500 mt-1">
                                        Label 1: "${section1Name}" | Label 2: "${section2Name}"
                                    </p>
                                ` : ''}
                            </div>
                            
                            <div class="grid grid-cols-2 divide-x">
                                <div class="p-4 ${!content1 ? 'bg-gray-50' : 'bg-white'}">
                                    ${content1 ? `
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar content-area">
                                            ${formatSectionContent(content1)}
                                        </div>
                                    ` : `
                                        <p class="text-gray-400 italic text-center py-8">
                                            Section not present in this label
                                        </p>
                                    `}
                                </div>
                                
                                <div class="p-4 ${!content2 ? 'bg-gray-50' : 'bg-white'}">
                                    ${content2 ? `
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar content-area">
                                            ${formatSectionContent(content2)}
                                        </div>
                                    ` : `
                                        <p class="text-gray-400 italic text-center py-8">
                                            Section not present in this label
                                        </p>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).filter(html => html !== '').join('')}
            </div>
            
            <!-- Export/Print Controls -->
            <div class="flex justify-between items-center pt-4 border-t">
                <div class="flex gap-2">
                    <button onclick="exportComparison()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        <i class="fas fa-download mr-1"></i>Export Comparison
                    </button>
                    <button onclick="printComparison()" class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
                        <i class="fas fa-print mr-1"></i>Print
                    </button>
                </div>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}
// Toggle between truncated and full content
function toggleContentLength() {
    const showFull = document.getElementById('showFullContent').checked;
    const contentAreas = document.querySelectorAll('.content-area');
    
    contentAreas.forEach(area => {
        if (showFull) {
            area.style.maxHeight = 'none';
        } else {
            area.style.maxHeight = '24rem'; // Restore max-h-96
        }
    });
}
// async function compareLabels() {
//     const label1Id = document.getElementById('compareLabel1').value;
//     const label2Id = document.getElementById('compareLabel2').value;
    
//     if (!label1Id || !label2Id) {
//         alert('Please select two labels to compare');
//         return;
//     }
    
//     if (label1Id === label2Id) {
//         alert('Please select different labels to compare');
//         return;
//     }
    
//     const resultDiv = document.getElementById('comparisonResult');
//     resultDiv.innerHTML = `
//         <div class="text-center py-8">
//             <div class="loader mx-auto mb-4"></div>
//             <p class="text-gray-600">Loading labels for comparison...</p>
//         </div>
//     `;
    
//     try {
//         // Clean the label IDs (remove 'label_' prefix if present)
//         const cleanLabel1Id = label1Id.replace(/^label_/, '');
//         const cleanLabel2Id = label2Id.replace(/^label_/, '');
        
//         console.log('Fetching label 1:', cleanLabel1Id);
//         console.log('Fetching label 2:', cleanLabel2Id);
        
//         // Fetch both labels using the working endpoint
//         const [response1, response2] = await Promise.all([
//             fetch(`${API_BASE}/label-content/${cleanLabel1Id}`),
//             fetch(`${API_BASE}/label-content/${cleanLabel2Id}`)
//         ]);
        
//         let labelData1 = null;
//         let labelData2 = null;
//         let label1Error = null;
//         let label2Error = null;
        
//         // Handle first label response
//         if (response1.ok) {
//             labelData1 = await response1.json();
//         } else {
//             label1Error = `Failed to load label 1 (${response1.status})`;
//         }
        
//         // Handle second label response
//         if (response2.ok) {
//             labelData2 = await response2.json();
//         } else {
//             label2Error = `Failed to load label 2 (${response2.status})`;
//         }
        
//         // Display the side-by-side comparison
//         displaySideBySideComparison(labelData1, labelData2, label1Error, label2Error, cleanLabel1Id, cleanLabel2Id);
        
//     } catch (error) {
//         console.error('Comparison error:', error);
//         resultDiv.innerHTML = `
//             <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
//                 <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-3"></i>
//                 <p class="text-red-700 font-semibold">Error loading labels</p>
//                 <p class="text-sm text-red-600 mt-2">${error.message}</p>
//                 <button onclick="compareLabels()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
//                     <i class="fas fa-redo mr-1"></i>Retry
//                 </button>
//             </div>
//         `;
//     }
// }








function displaySideBySideComparison(labelData1, labelData2, error1, error2, id1, id2) {
    const resultDiv = document.getElementById('comparisonResult');
    
    // Extract and clean metadata
    const meta1 = labelData1?.metadata || {};
    const meta2 = labelData2?.metadata || {};
    
    const title1 = extractValue(meta1.title) || extractValue(meta1.productName) || `Label ${id1.substring(0, 8)}...`;
    const title2 = extractValue(meta2.title) || extractValue(meta2.productName) || `Label ${id2.substring(0, 8)}...`;
    
    const version1 = extractValue(meta1.versionNumber) || extractValue(meta1.version) || 'N/A';
    const version2 = extractValue(meta2.versionNumber) || extractValue(meta2.version) || 'N/A';
    
    const manufacturer1 = cleanManufacturerString(extractValue(meta1.manufacturer)) || 'Not specified';
    const manufacturer2 = cleanManufacturerString(extractValue(meta2.manufacturer)) || 'Not specified';
    
    // Get all unique section names from both labels
    const sections1 = labelData1?.sections || {};
    const sections2 = labelData2?.sections || {};
    
    const allSectionNames = new Set([
        ...Object.keys(sections1),
        ...Object.keys(sections2)
    ]);
    
    // FDA section order
    const sectionOrder = [
        'Boxed Warning',
        'Lactic Acidosis',
        'Indications and Usage',
        'Dosage and Administration',
        'Dosage Forms and Strengths',
        'Contraindications',
        'Warnings and Precautions',
        'Adverse Reactions',
        'Drug Interactions',
        'Use in Specific Populations',
        'Drug Abuse and Dependence',
        'Overdosage',
        'Description',
        'Clinical Pharmacology',
        'Nonclinical Toxicology',
        'Clinical Studies',
        'References',
        'How Supplied/Storage and Handling',
        'Patient Counseling Information',
        'Medication Guide'
    ];
    
    // Sort sections according to FDA order
    const sortedSections = Array.from(allSectionNames).sort((a, b) => {
        const indexA = sectionOrder.indexOf(a);
        const indexB = sectionOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });
    
    // Build the comparison HTML
    let html = `
        <div class="space-y-6">
            <!-- Header with metadata -->
            <div class="grid grid-cols-2 gap-4">
                <!-- Label 1 Metadata -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 class="font-bold text-blue-900 text-lg mb-3">
                        <i class="fas fa-tag text-blue-600 mr-2"></i>${title1}
                    </h3>
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><span class="font-medium">Version:</span> ${version1}</p>
                        <p><span class="font-medium">Manufacturer:</span> ${manufacturer1}</p>
                        <p><span class="font-medium">Sections:</span> ${Object.keys(sections1).length}</p>
                        ${meta1.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(extractValue(meta1.effectiveDate))}</p>` : ''}
                    </div>
                    ${error1 ? `<div class="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">${error1}</div>` : ''}
                </div>
                
                <!-- Label 2 Metadata -->
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 class="font-bold text-purple-900 text-lg mb-3">
                        <i class="fas fa-tag text-purple-600 mr-2"></i>${title2}
                    </h3>
                    <div class="text-sm text-gray-700 space-y-1">
                        <p><span class="font-medium">Version:</span> ${version2}</p>
                        <p><span class="font-medium">Manufacturer:</span> ${manufacturer2}</p>
                        <p><span class="font-medium">Sections:</span> ${Object.keys(sections2).length}</p>
                        ${meta2.effectiveDate ? `<p><span class="font-medium">Effective:</span> ${formatDate(extractValue(meta2.effectiveDate))}</p>` : ''}
                    </div>
                    ${error2 ? `<div class="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">${error2}</div>` : ''}
                </div>
            </div>
            
            <!-- Comparison Statistics -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Comparison Overview</h4>
                <div class="grid grid-cols-4 gap-3 text-center">
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-blue-600">${sortedSections.length}</div>
                        <div class="text-xs text-gray-600">Total Sections</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-green-600">${Object.keys(sections1).length}</div>
                        <div class="text-xs text-gray-600">Label 1 Sections</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-purple-600">${Object.keys(sections2).length}</div>
                        <div class="text-xs text-gray-600">Label 2 Sections</div>
                    </div>
                    <div class="bg-white rounded p-3">
                        <div class="text-lg font-bold text-gray-600">
                            ${sortedSections.filter(s => sections1[s] && sections2[s]).length}
                        </div>
                        <div class="text-xs text-gray-600">Common Sections</div>
                    </div>
                </div>
            </div>
            
            <!-- Side-by-side sections -->
            <div class="space-y-4">
                <h3 class="font-bold text-gray-900 text-lg">Section-by-Section Comparison</h3>
                
                ${sortedSections.map(sectionName => {
                    const content1 = extractValue(sections1[sectionName]) || '';
                    const content2 = extractValue(sections2[sectionName]) || '';
                    
                    // Skip if both are empty or just ID references
                    if ((!content1 && !content2) || 
                        (content1.match(/^ID\d+$/) && content2.match(/^ID\d+$/))) {
                        return '';
                    }
                    
                    // Determine status
                    let status = 'both';
                    let statusColor = 'gray';
                    let statusIcon = 'fa-check-circle';
                    
                    if (content1 && !content2) {
                        status = 'only-left';
                        statusColor = 'blue';
                        statusIcon = 'fa-arrow-left';
                    } else if (!content1 && content2) {
                        status = 'only-right';
                        statusColor = 'purple';
                        statusIcon = 'fa-arrow-right';
                    } else if (content1 !== content2) {
                        status = 'different';
                        statusColor = 'yellow';
                        statusIcon = 'fa-exclamation-triangle';
                    }
                    
                    const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(sectionName);
                    
                    return `
                        <div class="border ${isImportant ? 'border-red-300 bg-red-50' : 'border-gray-200'} rounded-lg overflow-hidden">
                            <!-- Section Header -->
                            <div class="px-4 py-3 ${isImportant ? 'bg-red-100' : 'bg-gray-100'} border-b">
                                <div class="flex items-center justify-between">
                                    <h4 class="font-semibold ${isImportant ? 'text-red-900' : 'text-gray-900'} flex items-center">
                                        ${isImportant ? '<i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>' : ''}
                                        ${sectionName}
                                    </h4>
                                    <span class="text-sm text-${statusColor}-600 flex items-center">
                                        <i class="fas ${statusIcon} mr-1"></i>
                                        ${status === 'both' ? 'Both labels' : 
                                          status === 'only-left' ? 'Only in Label 1' : 
                                          status === 'only-right' ? 'Only in Label 2' : 
                                          'Different content'}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Section Content -->
                            <div class="grid grid-cols-2 divide-x">
                                <!-- Label 1 Content -->
                                <div class="p-4 ${!content1 ? 'bg-gray-50' : 'bg-white'}">
                                    ${content1 ? `
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                                            ${formatSectionContent(content1)}
                                        </div>
                                    ` : `
                                        <p class="text-gray-400 italic text-center py-8">
                                            Section not present in this label
                                        </p>
                                    `}
                                </div>
                                
                                <!-- Label 2 Content -->
                                <div class="p-4 ${!content2 ? 'bg-gray-50' : 'bg-white'}">
                                    ${content2 ? `
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                                            ${formatSectionContent(content2)}
                                        </div>
                                    ` : `
                                        <p class="text-gray-400 italic text-center py-8">
                                            Section not present in this label
                                        </p>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).filter(html => html !== '').join('')}
            </div>
            
            <!-- Export/Print Controls -->
            <div class="flex justify-between items-center pt-4 border-t">
                <div class="flex gap-2">
                    <button onclick="exportComparison()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        <i class="fas fa-download mr-1"></i>Export Comparison
                    </button>
                    <button onclick="printComparison()" class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
                        <i class="fas fa-print mr-1"></i>Print
                    </button>
                </div>
                <button onclick="toggleComparisonView()" class="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                    <i class="fas fa-columns mr-1"></i>Toggle View
                </button>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}
function formatSectionContent(content) {
    if (!content) return '';
    
    // Clean up the content
    let formatted = content;
    
    // Replace [object Object]
    formatted = formatted.replace(/\[object Object\]/g, '[See full document]');
    
    // Replace ID references
    formatted = formatted.replace(/^ID\d+$/g, '[Content reference - see full document]');
    
    // Clean up [See full document] references
    formatted = formatted.replace(/\[See full document\]/g, '<span class="text-blue-600 text-xs italic">[See full document]</span>');
    
    // Format tables
    formatted = formatted.replace(/\[Table\]/g, '<div class="bg-gray-100 p-2 rounded my-2 text-xs">📊 Table Content</div>');
    
    // Format images
    formatted = formatted.replace(/\[Image: ([^\]]+)\]/g, '<div class="bg-blue-100 p-2 rounded my-2 text-xs">🖼️ Image: $1</div>');
    
    // Limit length for very long sections
    if (formatted.length > 5000) {
        formatted = formatted.substring(0, 5000) + '\n\n<span class="text-blue-600 italic">... [Content truncated for display. Export for full text]</span>';
    }
    
    return formatted;
}
        // Enhanced label comparison
        // async function compareLabels() {
        //     const label1Id = document.getElementById('compareLabel1').value;
        //     const label2Id = document.getElementById('compareLabel2').value;
            
        //     if (!label1Id || !label2Id) {
        //         alert('Please select two labels to compare');
        //         return;
        //     }
            
        //     const resultDiv = document.getElementById('comparisonResult');
        //     resultDiv.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div></div>';
            
        //     try {
        //         const response = await fetch(`${API_BASE}/compare-labels`, {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({ label1: label1Id, label2: label2Id })
        //         });
                
        //         const comparison = await response.json();
        //         renderEnhancedComparison(comparison, label1Id, label2Id);
        //     } catch (error) {
        //         console.error('Comparison error:', error);
        //         resultDiv.innerHTML = '<p class="text-red-600 text-center py-8">Error comparing labels</p>';
        //     }
        // }

        // Render enhanced side-by-side comparison
        function renderEnhancedComparison(comparison, label1Id, label2Id) {
            const resultDiv = document.getElementById('comparisonResult');
            
            const label1 = state.labels.find(l => `label_${l.id}` === label1Id) || { productName: 'Label 1' };
            const label2 = state.labels.find(l => `label_${l.id}` === label2Id) || { productName: 'Label 2' };
            
            if (state.comparisonView === 'side-by-side') {
                resultDiv.innerHTML = `
                    <div class="label-compare-container">
                        <div class="label-panel custom-scrollbar">
                            <h4 class="font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b">
                                ${label1.productName} - ${label1.version || 'N/A'}
                            </h4>
                            <div id="label1Content">
                                ${renderLabelSections(comparison, 'left')}
                            </div>
                        </div>
                        <div class="label-panel custom-scrollbar">
                            <h4 class="font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b">
                                ${label2.productName} - ${label2.version || 'N/A'}
                            </h4>
                            <div id="label2Content">
                                ${renderLabelSections(comparison, 'right')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-900 mb-3">Comparison Summary</h4>
                        <div class="grid grid-cols-4 gap-4">
                            <div class="text-center">
                                <p class="text-2xl font-bold text-green-600">${comparison.stats?.added || 0}</p>
                                <p class="text-xs text-gray-600">Sections Added</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-red-600">${comparison.stats?.removed || 0}</p>
                                <p class="text-xs text-gray-600">Sections Removed</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-yellow-600">${comparison.stats?.modified || 0}</p>
                                <p class="text-xs text-gray-600">Sections Modified</p>
                            </div>
                            <div class="text-center">
                                <p class="text-2xl font-bold text-gray-600">${comparison.stats?.unchanged || 0}</p>
                                <p class="text-xs text-gray-600">Unchanged</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Unified diff view
                resultDiv.innerHTML = `
                    <div class="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                        <h4 class="font-bold text-gray-900 mb-4">Unified Comparison View</h4>
                        ${renderUnifiedDiff(comparison)}
                    </div>
                `;
            }
        }

        // Render label sections for comparison
        function renderLabelSections(comparison, side) {
            if (!comparison.sections) return '<p class="text-gray-500">No sections available</p>';
            
            return comparison.sections.map(section => {
                const statusClass = section.status === 'added' ? 'diff-added' :
                                   section.status === 'removed' ? 'diff-removed' :
                                   section.status === 'modified' ? 'diff-modified' : '';
                
                return `
                    <div class="mb-6 ${statusClass}">
                        <div class="flex justify-between items-center mb-2">
                            <h5 class="font-semibold text-gray-900">${section.name}</h5>
                            <span class="change-badge change-${section.status === 'modified' ? 'dosage' : section.status === 'added' ? 'efficacy' : 'safety'}">
                                ${section.status}
                            </span>
                        </div>
                        <div class="text-sm text-gray-700 whitespace-pre-wrap">
                            ${section.content || 'No content'}
                        </div>
                        <button onclick="addNoteToSection('${section.name}')" class="mt-2 text-xs text-blue-600 hover:text-blue-800">
                            <i class="fas fa-sticky-note mr-1"></i>Add Note
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Render unified diff view
        function renderUnifiedDiff(comparison) {
            if (!comparison.sections) return '<p class="text-gray-500">No differences found</p>';
            
            return comparison.sections.map(section => `
                <div class="mb-6 border-l-4 ${
                    section.status === 'added' ? 'border-green-500' :
                    section.status === 'removed' ? 'border-red-500' :
                    section.status === 'modified' ? 'border-yellow-500' :
                    'border-gray-300'
                } pl-4">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-900">${section.name}</h5>
                        <div class="flex items-center gap-2">
                            <span class="change-badge change-${section.status === 'modified' ? 'dosage' : section.status}">
                                ${section.status}
                            </span>
                            <button onclick="highlightSection('${section.name}')" class="text-yellow-600 hover:text-yellow-700">
                                <i class="fas fa-highlighter"></i>
                            </button>
                        </div>
                    </div>
                    <div class="${section.status === 'removed' ? 'line-through opacity-60' : ''} text-sm text-gray-700">
                        ${section.content || 'Content not available'}
                    </div>
                </div>
            `).join('');
        }

        // Toggle comparison view
        function toggleCompareView() {
            state.comparisonView = state.comparisonView === 'side-by-side' ? 'unified' : 'side-by-side';
            compareLabels(); // Re-render with new view
        }

        // Highlight differences
        function highlightDifferences() {
            const panels = document.querySelectorAll('.label-panel');
            panels.forEach(panel => {
                const sections = panel.querySelectorAll('.diff-added, .diff-removed, .diff-modified');
                sections.forEach(section => {
                    section.classList.add('diff-highlight');
                    setTimeout(() => section.classList.remove('diff-highlight'), 2000);
                });
            });
        }

        // View application details
function viewApplicationDetails(applicationNumber) {
    const app = state.applications.find(a => a.applicationNumber === applicationNumber);
    if (!app) return;

    let modal = document.getElementById('applicationModal');
    if (!modal) {
        // Create the modal element
        modal = document.createElement('div');
        modal.id = 'applicationModal';
        modal.className = 'hidden fixed inset-0 modal-backdrop flex items-center justify-center z-50';
        
        // Set the innerHTML properly (using = not backticks)
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
                    <div>
                        <h3 class="text-2xl font-bold text-gray-900" id="appModalTitle">Application Details</h3>
                        <p class="text-sm text-gray-600 mt-1" id="appModalSubtitle"></p>
                    </div>
                      <button onclick="closeApplicationModal()" 
                    class="p-2 rounded-lg bg-white shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 group">
                <i class="fas fa-times text-xl text-gray-500 group-hover:text-gray-700"></i>
            </button>
                </div>
                <div id="appModalContent" class="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    <!-- Application details will be rendered here -->
                </div>
            </div>
        `;
        
        // Append to body
        document.body.appendChild(modal);
        
        // Add the modal backdrop styles if they don't exist
        if (!document.getElementById('modalBackdropStyles')) {
            const style = document.createElement('style');
            style.id = 'modalBackdropStyles';
            style.textContent = `
                .modal-backdrop {
                    background-color: rgba(0, 0, 0, 0.5);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                .change-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .change-safety {
                    background-color: #fee2e2;
                    color: #991b1b;
                }
                .change-efficacy {
                    background-color: #dbeafe;
                    color: #1e40af;
                }
                .change-dosage {
                    background-color: #fef3c7;
                    color: #92400e;
                }
                .product-timeline {
                    position: relative;
                    padding-left: 20px;
                }
                .product-event {
                    position: relative;
                    margin-bottom: 12px;
                }
                .product-event::before {
                    content: '';
                    position: absolute;
                    left: -12px;
                    top: 8px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #6b7280;
                }
            `;
            document.head.appendChild(style);
        }
    }
            
            document.getElementById('appModalTitle').textContent = app.productName || 'Application Details';
            document.getElementById('appModalSubtitle').textContent = `Application ${applicationNumber}`;
            
            const content = document.getElementById('appModalContent');
            content.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="font-semibold text-gray-900 mb-3">Basic Information</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Product Name</span>
                                <span class="text-sm font-medium">${app.productName || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Generic Name</span>
                                <span class="text-sm font-medium">${app.genericName || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Sponsor</span>
                                <span class="text-sm font-medium">${app.sponsorName || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Approval Date</span>
                                <span class="text-sm font-medium">${formatDate(app.approvalDate)}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Status</span>
                                <span class="text-sm font-medium">${app.status || 'Active'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-gray-900 mb-3">Formulation Details</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Dosage Form</span>
                                <span class="text-sm font-medium">${app.dosageForm || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Route</span>
                                <span class="text-sm font-medium">${app.route || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b">
                                <span class="text-sm text-gray-600">Strength</span>
                                <span class="text-sm font-medium">${app.strength || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6">
                    <h4 class="font-semibold text-gray-900 mb-3">Associated Labels</h4>
                    <div class="space-y-2">
                        ${state.labels.filter(l => l.applicationNumber === applicationNumber || l.productName === app.productName)
                            .map(label => `
                                <div class="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                        <p class="text-sm font-medium">${label.productName}</p>
                                        <p class="text-xs text-gray-600">Version ${label.version || 'N/A'} - ${formatDate(label.effectiveDate)}</p>
                                    </div>
                                    <button onclick="viewFullLabel('${label.id}')" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                        View Label
                                    </button>
                                </div>
                            `).join('') || '<p class="text-gray-500 text-sm">No associated labels found</p>'}
                    </div>
                </div>
                
                <div class="mt-6">
                    <h4 class="font-semibold text-gray-900 mb-3">Timeline</h4>
                    <div class="product-timeline">
                        ${state.timeline.filter(e => e.data?.applicationNumber === applicationNumber)
                            .slice(0, 5)
                            .map(event => `
                                <div class="product-event">
                                    <div class="bg-gray-50 rounded-lg p-3">
                                        <div class="flex justify-between items-start">
                                            <div>
                                                <p class="text-sm font-medium">${event.title}</p>
                                                <p class="text-xs text-gray-600">${formatDate(event.date)}</p>
                                            </div>
                                            ${event.changes ? `
                                                <span class="change-badge change-${event.changes[0]?.type || 'safety'}">
                                                    ${event.changes[0]?.type || 'update'}
                                                </span>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('') || '<p class="text-gray-500 text-sm">No timeline events found</p>'}
                    </div>
                </div>
            `;
            
            document.getElementById('applicationModal').classList.remove('hidden');
        }

        // View application-specific timeline
        function viewApplicationTimeline(applicationNumber) {
            const app = state.applications.find(a => a.applicationNumber === applicationNumber);
            if (!app) return;
            
            // Filter timeline for this application
            const appEvents = state.timeline.filter(e => 
                e.data?.applicationNumber === applicationNumber ||
                e.data?.productName === app.productName
            );
            
            // Switch to timeline tab and render filtered events
            switchLabelTab('timeline');
            
            // Temporarily override the timeline with filtered events
            const originalTimeline = state.timeline;
            state.timeline = appEvents;
            renderEnhancedTimeline();
            
            // Add a reset button
            const container = document.getElementById('timelineContainer');
            const resetBtn = document.createElement('button');
            resetBtn.className = 'absolute top-4 right-4 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm z-20';
            resetBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Show All Events';
            resetBtn.onclick = () => {
                state.timeline = originalTimeline;
                renderEnhancedTimeline();
            };
            container.insertBefore(resetBtn, container.firstChild);
        }

{/* <div id="companyModal" class="hidden fixed inset-0 modal-backdrop flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
            <div>
                <h3 class="text-2xl font-bold text-gray-900" id="companyModalTitle">Company Analysis</h3>
                <p class="text-sm text-gray-600 mt-1" id="companyModalSubtitle"></p>
            </div>
            <button onclick="closeCompanyModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        <div id="companyModalContent" class="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <!-- Company analysis will be rendered here -->
        </div>
    </div>
</div> */}

        // Open company analysis modal
        function openCompanyModal(companyName) {
            const company = state.companies.get(companyName);
            if (!company) return;

                let modal = document.getElementById('companyModal');
    if (!modal) {
        // Create the modal element
        modal = document.createElement('div');
        modal.id = 'companyModal';
        modal.className = 'hidden fixed inset-0 modal-backdrop flex items-center justify-center z-50';
        
        // Set the innerHTML properly (using = not backticks)
        modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
            <div>
                <h3 class="text-2xl font-bold text-gray-900" id="companyModalTitle">Company Analysis</h3>
                <p class="text-sm text-gray-600 mt-1" id="companyModalSubtitle"></p>
            </div>
            <button onclick="closeCompanyModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        <div id="companyModalContent" class="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <!-- Company analysis will be rendered here -->
        </div>
    </div>
        `;
        
        // Append to body
        document.body.appendChild(modal);
        
    }
            
            document.getElementById('companyModalTitle').textContent = company.name;
            document.getElementById('companyModalSubtitle').textContent = 
                `${company.applications.length} Applications • ${company.labels.length} Labels • ${company.products.size} Products`;
            
            const content = document.getElementById('companyModalContent');
            content.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div class="company-metric">
                        <p class="text-xs text-gray-600 uppercase">Total Applications</p>
                        <p class="text-3xl font-bold text-gray-900">${company.applications.length}</p>
                        <p class="text-xs text-gray-500 mt-1">
                            ${company.applications.filter(a => a.status === 'Active').length} active
                        </p>
                    </div>
                    <div class="company-metric">
                        <p class="text-xs text-gray-600 uppercase">Label Updates</p>
                        <p class="text-3xl font-bold text-gray-900">${company.labels.length}</p>
                        <p class="text-xs text-gray-500 mt-1">
                            Avg ${(company.labels.length / company.products.size).toFixed(1)} per product
                        </p>
                    </div>
                    <div class="hidden company-metric">
                        <p class="text-xs text-gray-600 uppercase">Update Frequency</p>
                        <p class="text-3xl font-bold text-gray-900">
                            ${calculateUpdateFrequency(company.timeline)}
                        </p>
                        <p class="text-xs text-gray-500 mt-1">months average</p>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-900 mb-3">Product Portfolio</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${Array.from(company.products).map(product => {
                            const productApps = company.applications.filter(a => a.productName === product);
                            const productLabels = company.labels.filter(l => l.productName === product);
                            return `
                                <div class="bg-gray-50 rounded-lg p-4 hover-lift">
                                    <p class="font-medium text-gray-900">${product}</p>
                                    <div class="flex gap-4 mt-2 text-xs text-gray-600">
                                        <span><i class="fas fa-file-medical mr-1"></i>${productApps.length} apps</span>
                                        <span><i class="fas fa-tags mr-1"></i>${productLabels.length} labels</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-900 mb-3">Complete Timeline</h4>
                    <div class="product-timeline max-h-96 overflow-y-auto custom-scrollbar">
                        ${company.timeline.map(event => `
                            <div class="product-event">
                                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-gray-900">${event.title}</p>
                                            <p class="text-sm text-gray-600">${event.description}</p>
                                            <p class="text-xs text-gray-500 mt-1">${formatDate(event.date)}</p>
                                        </div>
                                        <i class="fas ${event.type === 'approval' ? 'fa-check-circle text-green-600' : 'fa-tag text-blue-600'}"></i>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${company.applications.length > 0 && company.labels.length === 0 ? `
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div class="flex">
                            <i class="fas fa-exclamation-triangle text-yellow-400 mr-3"></i>
                            <div>
                                <p class="text-sm font-medium text-yellow-800">Data Discrepancy Detected</p>
                                <p class="text-xs text-yellow-700 mt-1">
                                    This company has ${company.applications.length} FDA application(s) but no corresponding label data was found in the databases.
                                    Possible reasons:
                                </p>
                                <ul class="text-xs text-yellow-700 mt-2 ml-4 list-disc">
                                    <li>Labels pending publication in DailyMed</li>
                                    <li>Application recently approved</li>
                                    <li>Data synchronization delay</li>
                                    <li>Different manufacturer name in label database</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${company.labels.length > 0 && company.applications.length === 0 ? `
                    <div class="bg-blue-50 border-l-4 border-blue-400 p-4">
                        <div class="flex">
                            <i class="fas fa-info-circle text-blue-400 mr-3"></i>
                            <div>
                                <p class="text-sm font-medium text-blue-800">Application Data Not Found</p>
                                <p class="text-xs text-blue-700 mt-1">
                                    Found ${company.labels.length} label(s) but no corresponding FDA application data.
                                    This may occur when:
                                </p>
                                <ul class="text-xs text-blue-700 mt-2 ml-4 list-disc">
                                    <li>Application filed under parent company or different entity</li>
                                    <li>Legacy product with historical approval</li>
                                    <li>OTC product not requiring NDA/ANDA</li>
                                    <li>Name variation between databases</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                ` : ''}
            `;
            
            document.getElementById('companyModal').classList.remove('hidden');
        }

        // Calculate update frequency
        function calculateUpdateFrequency(timeline) {
            if (timeline.length < 2) return 'N/A';
            
            const labelEvents = timeline.filter(e => e.type === 'label');
            if (labelEvents.length < 2) return 'N/A';
            
            const dates = labelEvents.map(e => e.date).sort((a, b) => a - b);
            const intervals = [];
            
            for (let i = 1; i < dates.length; i++) {
                const monthsDiff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24 * 30);
                intervals.push(monthsDiff);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            return avgInterval.toFixed(1);
        }

        // Filter timeline
        function filterTimeline(filter) {
            state.timelineFilter = filter;
            
            // Update button styles
            const buttons = document.querySelectorAll('#contentTimeline button');
            buttons.forEach(btn => {
                if (btn.textContent.toLowerCase().includes(filter) || 
                    (filter === 'all' && btn.textContent.includes('All Changes'))) {
                    btn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm';
                } else if (btn.textContent.includes('Safety') || 
                          btn.textContent.includes('Efficacy') || 
                          btn.textContent.includes('Indication') ||
                          btn.textContent.includes('All Changes')) {
                    btn.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300';
                }
            });
            
            renderEnhancedTimeline();
        }

        // Update timeline view
        function updateTimelineView() {
            state.timelineGrouping = document.getElementById('timelineGrouping').value;
            renderEnhancedTimeline();
        }

        // Show event details
        function showEventDetails(event) {
            console.log('Event details:', event);
            // Could open a modal with full event details
        }

        // Highlight section
        function highlightSection(sectionName) {
            const sections = document.querySelectorAll(`h5:contains("${sectionName}")`).forEach(header => {
                const parent = header.closest('div');
                parent.classList.add('diff-highlight');
                setTimeout(() => parent.classList.remove('diff-highlight'), 2000);
            });
        }

        // Notes management
        function loadNotes() {
            const saved = localStorage.getItem('pharmaLabelNotes');
            if (saved) {
                state.notes = JSON.parse(saved);
                updateNotesCount();
            }
        }

        function saveNotes() {
            localStorage.setItem('pharmaLabelNotes', JSON.stringify(state.notes));
            updateNotesCount();
        }

        function addNote() {
            const noteText = document.getElementById('newNote').value.trim();
            if (!noteText) return;
            
            const note = {
                id: Date.now(),
                text: noteText,
                timestamp: new Date().toISOString(),
                context: state.currentSearch,
                section: null
            };
            
            state.notes.push(note);
            saveNotes();
            renderNotes();
            document.getElementById('newNote').value = '';
        }

        function addNoteToSection(sectionName) {
            const noteText = prompt(`Add note for ${sectionName}:`);
            if (!noteText) return;
            
            const note = {
                id: Date.now(),
                text: noteText,
                timestamp: new Date().toISOString(),
                context: state.currentSearch,
                section: sectionName
            };
            
            state.notes.push(note);
            saveNotes();
            
            // Add visual marker
            const marker = document.createElement('span');
            marker.className = 'note-marker';
            marker.innerHTML = state.notes.length;
            marker.onclick = () => showNoteTooltip(note);
        }

        function renderNotes() {
            const container = document.getElementById('notesList');
            container.innerHTML = '';
            
            if (state.notes.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center">No notes yet</p>';
                return;
            }
            
            state.notes.reverse().forEach(note => {
                const noteDiv = document.createElement('div');
                noteDiv.className = 'bg-yellow-50 rounded-lg p-3 mb-3';
                noteDiv.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <p class="text-sm text-gray-900">${note.text}</p>
                            <p class="text-xs text-gray-500 mt-1">
                                ${note.section ? `Section: ${note.section} • ` : ''}
                                ${formatDate(note.timestamp)}
                            </p>
                        </div>
                        <button onclick="deleteNote(${note.id})" class="text-red-600 hover:text-red-700 ml-2">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                `;
                container.appendChild(noteDiv);
            });
        }

        function deleteNote(noteId) {
            state.notes = state.notes.filter(n => n.id !== noteId);
            saveNotes();
            renderNotes();
        }

        function updateNotesCount() {
            document.getElementById('notesCount').textContent = state.notes.length;
        }

        function openNotesPanel() {
            document.getElementById('notesPanel').classList.remove('hidden');
            renderNotes();
        }

        function closeNotesPanel() {
            document.getElementById('notesPanel').classList.add('hidden');
        }

        // Populate compare options
        // function populateCompareOptions() {
        //     const select1 = document.getElementById('compareLabel1');
        //     const select2 = document.getElementById('compareLabel2');
            
        //     const options = ['<option value="">Select a label...</option>'];
            
        //     state.labels.forEach(label => {
        //         options.push(`
        //             <option value="label_${label.id}">
        //                 ${label.productName || 'Unknown'} - v${label.version || 'N/A'} (${formatDate(label.effectiveDate)})
        //             </option>
        //         `);
        //     });
            
        //     state.uploadedLabels.forEach((label, index) => {
        //         options.push(`
        //             <option value="upload_${index}">
        //                 [Uploaded] ${label.name}
        //             </option>
        //         `);
        //     });
            
        //     select1.innerHTML = options.join('');
        //     select2.innerHTML = options.join('');
        // }#

        function populateCompareOptions() {
    const select1 = document.getElementById('compareLabel1');
    const select2 = document.getElementById('compareLabel2');
    
    const options = ['<option value="">Select a label...</option>'];
    
    // Process state.labels - these come from your backend
    state.labels.forEach(label => {
        // The new backend structure has data nested differently
        // Try multiple paths to find the product name
        let productName = 'Unknown';
        let version = 'N/A';
        let effectiveDate = '';
        
        // Check if the label has the enhanced structure from the new backend
        if (label.data) {
            // New structure: label.data.metadata, label.data.productInfo, etc.
            productName = label.data.metadata?.title || 
                         label.data.metadata?.brandName ||
                         label.data.productInfo?.productName ||
                         label.productName ||
                         'Unknown';
            
            version = label.data.metadata?.versionNumber || 
                     label.version || 
                     'N/A';
            
            effectiveDate = label.data.metadata?.effectiveDate || 
                           label.effectiveDate || 
                           '';
        } else {
            // Fallback to direct properties
            productName = label.productName || 
                         label.title || 
                         label.name || 
                         label.brandName ||
                         'Unknown';
            
            version = label.version || 
                     label.versionNumber || 
                     'N/A';
            
            effectiveDate = label.effectiveDate || '';
        }
        
        // Clean up the label ID (remove 'label_' prefix if it exists)
        const labelId = label.id?.replace(/^label_/, '') || label.id;
        
        options.push(`
            <option value="label_${labelId}">
                ${productName} - v${version} (${formatDate(effectiveDate)})
            </option>
        `);
    });
    
    // Add uploaded labels
    state.uploadedLabels.forEach((label, index) => {
        options.push(`
            <option value="upload_${index}">
                [Uploaded] ${label.name}
            </option>
        `);
    });
    
    select1.innerHTML = options.join('');
    select2.innerHTML = options.join('');
    
    console.log(`Populated compare options with ${state.labels.length} FDA labels and ${state.uploadedLabels.length} uploaded labels`);
}


        // Populate labels tab
        function populateLabels() {
            const container = document.getElementById('labelsGrid');
            container.innerHTML = '';

            if (state.labels.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">No labels available</p>';
            } else {
                state.labels.forEach(label => {
                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover-lift';
                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-semibold text-gray-900">${label.productName || 'Unknown Product'}</h4>
                                <p class="text-sm text-gray-600 mt-1">Version: ${label.version || 'N/A'}</p>
                                <p class="text-sm text-gray-600">Manufacturer: ${label.manufacturerName || 'Unknown'}</p>
                                <p class="text-sm text-gray-600">Effective: ${formatDate(label.effectiveDate)}</p>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    ${label.sections ? Object.keys(label.sections).filter(s => label.sections[s]).map(section => `
                                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                            ${section.replace(/_/g, ' ')}
                                        </span>
                                    `).join('') : ''}
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <button onclick="viewFullLabel('${label.id}')" 
                                        class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-eye mr-1"></i>View Label
                                </button>

                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        }

        // View full label
// async function viewFullLabel(labelId) {
//     const label = state.labels.find(l => l.id === labelId);
//     if (!label) return;

//     const modalHtml = `
//         <div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50" id="labelViewModal">
//             <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col">
//                 <!-- Header -->
//                 <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-green-50 flex-shrink-0">
//                     <div>
//                         <h3 class="text-2xl font-bold text-gray-900">${label.productName || 'Label Details'}</h3>
//                         <div class="flex items-center gap-4 mt-2">
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-code-branch mr-1"></i>Version ${label.version || 'N/A'}
//                             </span>
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-calendar mr-1"></i>Effective: ${formatDate(label.effectiveDate)}
//                             </span>
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-building mr-1"></i>${label.manufacturerName || 'Unknown Manufacturer'}
//                             </span>
//                         </div>
//                     </div>
//                     <button onclick="document.getElementById('labelViewModal').remove()" 
//                             class="text-gray-400 hover:text-gray-600 transition-colors">
//                         <i class="fas fa-times text-xl"></i>
//                     </button>
//                 </div>
                
//                 <!-- Tab Navigation -->
//                 <div class="border-b px-6 pt-3 bg-gray-50 flex-shrink-0">
//                     <div class="flex gap-1">
//                         <button onclick="switchLabelTab('sections')" 
//                                 id="Labeltab-sections"
//                                 class="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 bg-white rounded-t-lg">
//                             <i class="fas fa-file-medical mr-1"></i>Label Sections
//                         </button>
//                         <button onclick="switchLabelTab('metadata')" 
//                                 id="Labeltab-metadata"
//                                 class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-t-lg transition-colors">
//                             <i class="fas fa-info-circle mr-1"></i>Metadata
//                         </button>
//                         <button onclick="switchLabelTab('raw')" 
//                                 id="Labeltab-raw"
//                                 class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-t-lg transition-colors">
//                             <i class="fas fa-code mr-1"></i>Raw XML
//                         </button>
//                     </div>
//                 </div>
                
//                 <!-- Content Area -->
//                 <div class="flex-1 overflow-hidden flex">
//                     <!-- Section Navigation Sidebar -->
//                     <div id="sectionNav" class="w-64 border-r bg-gray-50 overflow-y-auto flex-shrink-0">
//                         <div class="p-4">
//                             <h4 class="text-sm font-semibold text-gray-700 mb-3">Quick Navigation</h4>
//                             <div id="sectionLinks" class="space-y-1">
//                                 <div class="text-center py-4">
//                                     <div class="loader mx-auto"></div>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
                    
//                     <!-- Main Content -->
//                     <div id="labelContent" class="flex-1 overflow-y-auto custom-scrollbar p-6">
//                         <div class="text-center py-8">
//                             <div class="loader mx-auto"></div>
//                             <p class="text-gray-500 mt-4">Loading label content...</p>
//                         </div>
//                     </div>
//                 </div>
                
//                 <!-- Footer Actions -->
//                 <div class="border-t px-6 py-3 bg-gray-50 flex justify-between items-center flex-shrink-0">
//                     <div class="flex gap-2">
//                         <button onclick="printLabel('${labelId}')" 
//                                 class="hidden px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
//                             <i class="fas fa-print mr-1"></i>Print
//                         </button>
//                         <button onclick="downloadLabel('${labelId}')" 
//                                 class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
//                             <i class="fas fa-download mr-1"></i>Download PDF
//                         </button>
//                         <button onclick="exportLabelData('${labelId}')" 
//                                 class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
//                             <i class="fas fa-file-export mr-1"></i>Export Data
//                         </button>
//                     </div>
//                     <button onclick="document.getElementById('labelViewModal').remove()" 
//                             class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
//                         Close
//                     </button>
//                 </div>
//             </div>
//         </div>
//     `;
    
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
    
//     try {
//         const response = await fetch(`${API_BASE}/label-content/${labelId}`);
//         const reply = await response.json();
//         const data = reply.data
//         if (data.sections || data.metadata || data.rawXML) {
//             renderLabelContent(data, labelId);
//         } else {
//             document.getElementById('labelContent').innerHTML = `
//                 <div class="text-center py-12">
//                     <i class="fas fa-exclamation-circle text-4xl text-gray-400 mb-4"></i>
//                     <p class="text-gray-500">Unable to load label content</p>
//                     <button onclick="retryLoadLabel('${labelId}')" 
//                             class="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
//                         <i class="fas fa-redo mr-1"></i>Retry
//                     </button>
//                 </div>
//             `;
//         }
//     } catch (error) {
//         console.error('Error loading label:', error);
//         document.getElementById('labelContent').innerHTML = `
//             <div class="text-center py-12">
//                 <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
//                 <p class="text-red-500">Error loading label content</p>
//                 <p class="text-sm text-gray-500 mt-2">${error.message}</p>
//             </div>
//         `;
//     }
// }

// async function viewFullLabel(labelId) {
//     const label = state.labels.find(l => l.id === labelId);
//     if (!label) return;

//     const modalHtml = `
//         <div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50" id="labelViewModal">
//             <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col">
//                 <!-- Header -->
//                 <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-green-50 flex-shrink-0">
//                     <div>
//                         <h3 class="text-2xl font-bold text-gray-900">${label.productName || 'Label Details'}</h3>
//                         <div class="flex items-center gap-4 mt-2">
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-code-branch mr-1"></i>Version ${label.version || 'N/A'}
//                             </span>
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-calendar mr-1"></i>Effective: ${formatDate(label.effectiveDate)}
//                             </span>
//                             <span class="text-sm text-gray-600">
//                                 <i class="fas fa-building mr-1"></i>${label.manufacturerName || 'Unknown Manufacturer'}
//                             </span>
//                         </div>
//                     </div>
//                     <button onclick="document.getElementById('labelViewModal').remove()" 
//                             class="text-gray-400 hover:text-gray-600 transition-colors">
//                         <i class="fas fa-times text-xl"></i>
//                     </button>
//                 </div>
                
//                 <!-- Tab Navigation -->
//                 <div class="border-b px-6 pt-3 bg-gray-50 flex-shrink-0">
//                     <div class="flex gap-1">
//                         <button onclick="switchLabelTab('sections')" 
//                                 id="Labeltab-sections"
//                                 class="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 bg-white rounded-t-lg">
//                             <i class="fas fa-file-medical mr-1"></i>Label Sections
//                         </button>
//                         <button onclick="switchLabelTab('metadata')" 
//                                 id="Labeltab-metadata"
//                                 class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-t-lg transition-colors">
//                             <i class="fas fa-info-circle mr-1"></i>Metadata
//                         </button>
//                         <button onclick="switchLabelTab('raw')" 
//                                 id="Labeltab-raw"
//                                 class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-t-lg transition-colors">
//                             <i class="fas fa-code mr-1"></i>Raw XML
//                         </button>
//                     </div>
//                 </div>
                
//                 <!-- Content Area -->
//                 <div class="flex-1 overflow-hidden flex">
//                     <!-- Section Navigation Sidebar -->
//                     <div id="sectionNav" class="w-64 border-r bg-gray-50 overflow-y-auto flex-shrink-0">
//                         <div class="p-4">
//                             <h4 class="text-sm font-semibold text-gray-700 mb-3">Quick Navigation</h4>
//                             <div id="sectionLinks" class="space-y-1">
//                                 <div class="text-center py-4">
//                                     <div class="loader mx-auto"></div>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
                    
//                     <!-- Main Content -->
//                     <div id="labelContent" class="flex-1 overflow-y-auto custom-scrollbar p-6">
//                         <div class="text-center py-8">
//                             <div class="loader mx-auto"></div>
//                             <p class="text-gray-500 mt-4">Loading label content...</p>
//                         </div>
//                     </div>
//                 </div>
                
//                 <!-- Footer Actions -->
//                 <div class="border-t px-6 py-3 bg-gray-50 flex justify-between items-center flex-shrink-0">
//                     <div class="flex gap-2">
//                         <button onclick="printLabel('${labelId}')" 
//                                 class="hidden px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
//                             <i class="fas fa-print mr-1"></i>Print
//                         </button>
//                         <button onclick="downloadLabel('${labelId}')" 
//                                 class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
//                             <i class="fas fa-download mr-1"></i>Download PDF
//                         </button>
//                         <button onclick="exportLabelData('${labelId}')" 
//                                 class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
//                             <i class="fas fa-file-export mr-1"></i>Export Data
//                         </button>
//                     </div>
//                     <button onclick="document.getElementById('labelViewModal').remove()" 
//                             class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
//                         Close
//                     </button>
//                 </div>
//             </div>
//         </div>
//     `;
    
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
    
//     try {
//         const response = await fetch(`${API_BASE}/label-content/${labelId}`);
//         const reply = await response.json();
        
//         // Console log the XML as requested
//         if (reply.xml && reply.xml.raw) {
//             console.log('Full XML Content:', reply.xml.raw);
//             console.log('XML Length:', reply.xml.raw.length, 'characters');
//         } else {
//             console.log('No XML content available in response');
//         }
        
//         // Extract data from the new response structure
//         const data = reply.data;
        
//         // Store the XML in the data object for potential use by other functions
//         if (reply.xml) {
//             data.rawXML = reply.xml.raw;
//             data.cleanedXML = reply.xml.cleaned;
//             data.originalXML = reply.xml.original;
//         }
        
//         if (data && (data.sections || data.metadata || data.rawXML)) {
//             renderLabelContent(data, labelId);
//         } else {
//             document.getElementById('labelContent').innerHTML = `
//                 <div class="text-center py-12">
//                     <i class="fas fa-exclamation-circle text-4xl text-gray-400 mb-4"></i>
//                     <p class="text-gray-500">Unable to load label content</p>
//                     <button onclick="retryLoadLabel('${labelId}')" 
//                             class="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
//                         <i class="fas fa-redo mr-1"></i>Retry
//                     </button>
//                 </div>
//             `;
//         }
//     } catch (error) {
//         console.error('Error loading label:', error);
//         document.getElementById('labelContent').innerHTML = `
//             <div class="text-center py-12">
//                 <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
//                 <p class="text-red-500">Error loading label content</p>
//                 <p class="text-sm text-gray-500 mt-2">${error.message}</p>
//             </div>
//         `;
//     }
// }

async function viewFullLabel(labelId) {
    const label = state.labels.find(l => l.id === labelId);
    if (!label) return;

    const modalHtml = `
        <div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50" id="labelViewModal">
            <div class="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col">
                <!-- Header -->
                <div class="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-green-50 flex-shrink-0">
                    <div>
                        <h3 class="text-2xl font-bold text-gray-900">${label.productName || 'Label XML View'}</h3>
                        <div class="flex items-center gap-4 mt-2">
                            <span class="text-sm text-gray-600">
                                <i class="fas fa-code-branch mr-1"></i>Version ${label.version || 'N/A'}
                            </span>
                            <span class="text-sm text-gray-600">
                                <i class="fas fa-calendar mr-1"></i>Effective: ${formatDate(label.effectiveDate)}
                            </span>
                            <span class="text-sm text-gray-600">
                                <i class="fas fa-building mr-1"></i>${label.manufacturerName || 'Unknown Manufacturer'}
                            </span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('labelViewModal').remove()" 
                            class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Metadata Section -->
                <div id="metadataSection" class="hidden border-b bg-gray-50 px-6 py-4 flex-shrink-0">
                    <div class="text-center">
                        <div class="inline-flex items-center">
                            <div class="loader mr-2"></div>
                            <span class="text-sm text-gray-600">Loading metadata...</span>
                        </div>
                    </div>
                </div>
                
                <!-- XML Tree Content Area -->
                <div class="flex-1 overflow-hidden flex flex-col">
                    <div class="px-6 py-3 bg-gray-100 border-b flex justify-between items-center flex-shrink-0">
                        <h4 class="text-lg font-semibold text-gray-800">
                            <i class="fas fa-code mr-2 text-blue-600"></i>XML Structure
                        </h4>
                        <div class="flex gap-2">
                            <button onclick="expandAllXML()" 
                                    class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                <i class="fas fa-expand-alt mr-1"></i>Expand All
                            </button>
                            <button onclick="collapseAllXML()" 
                                    class="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                                <i class="fas fa-compress-alt mr-1"></i>Collapse All
                            </button>

                        </div>
                    </div>
                    
                    <div id="xmlTreeContent" class="flex-1 overflow-y-auto p-6 bg-white font-mono text-sm">
                        <div class="text-center py-8">
                            <div class="loader mx-auto"></div>
                            <p class="text-gray-500 mt-4">Loading XML content...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Footer Actions -->
                <div class="border-t px-6 py-3 bg-gray-50 flex justify-between items-center flex-shrink-0">
                    <div class="flex gap-2">

                    </div>
                    <button onclick="document.getElementById('labelViewModal').remove()" 
                            class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    try {
        const response = await fetch(`${API_BASE}/label-content/${labelId}`);
        const reply = await response.json();
        
        // Store the data globally for other functions to use
        window.currentLabelData = reply;
        
        // Display metadata
        if (reply.data && reply.data.metadata) {
            displayMetadata(reply.data.metadata);
        }

        if (reply.xml && reply.xml.raw) {
    const formattedContent = formatPharmaceuticalXML(reply.xml.raw);
    document.getElementById('xmlTreeContent').innerHTML = formattedContent;
}
        
        // Display XML tree
        // if (reply.xml && reply.xml.raw) {
        //     console.log('Full XML Content:', reply.xml.raw);
        //     console.log('XML Length:', reply.xml.raw.length, 'characters');
        //     renderXMLTree(reply.xml.raw);
        // } 
        else {
            console.log('No XML content available in response');
            document.getElementById('xmlTreeContent').innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No XML content available</p>
                    <p class="text-sm text-gray-400 mt-2">The label was loaded from FDA API which doesn't provide XML format</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading label:', error);
        document.getElementById('xmlTreeContent').innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                <p class="text-red-500">Error loading label content</p>
                <p class="text-sm text-gray-500 mt-2">${error.message}</p>
            </div>
        `;
    }
}


function formatPharmaceuticalXML(xmlString) {
    // Parse the XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        return `
            <div class="error-container">
                <h2>Error Parsing XML</h2>
                <p>${parseError.textContent}</p>
            </div>
        `;
    }
    
    // Extract key document information
    const documentInfo = extractDocumentInfo(xmlDoc);
    const sections = extractSections(xmlDoc);
    
    // Build the formatted HTML
    let html = `
        <div class="pharma-label-container">
            ${buildHeader(documentInfo)}
            ${buildNavigation(sections)}
            <div class="content-wrapper">
                ${buildSidebar(sections)}
                <main class="main-content">
                    ${buildSections(sections)}
                </main>
            </div>
        </div>
        ${getStyles()}
    `;
    
    return html;
}

function extractDocumentInfo(xmlDoc) {
    const info = {
        title: '',
        setId: '',
        versionNumber: '',
        effectiveDate: '',
        productName: '',
        manufacturer: '',
        ndc: '',
        schedule: '',
        routes: [],
        strengths: [],
        approval: ''
    };
    
    // Extract title
    const titleNode = xmlDoc.querySelector('title');
    if (titleNode) {
        info.title = cleanText(titleNode.textContent);
    }
    
    // Extract document metadata
    const setIdNode = xmlDoc.querySelector('setId');
    if (setIdNode) {
        info.setId = setIdNode.getAttribute('root') || '';
    }
    
    const versionNode = xmlDoc.querySelector('versionNumber');
    if (versionNode) {
        info.versionNumber = versionNode.getAttribute('value') || '';
    }
    
    const effectiveNode = xmlDoc.querySelector('effectiveTime');
    if (effectiveNode) {
        info.effectiveDate = formatDate(effectiveNode.getAttribute('value'));
    }
    
    // Extract product information
    const productNode = xmlDoc.querySelector('manufacturedProduct');
    if (productNode) {
        const nameNode = productNode.querySelector('name');
        if (nameNode) {
            info.productName = cleanText(nameNode.textContent);
        }
        
        const codeNode = productNode.querySelector('code');
        if (codeNode) {
            info.ndc = codeNode.getAttribute('code') || '';
        }
    }
    
    // Extract manufacturer
    const orgNode = xmlDoc.querySelector('representedOrganization name');
    if (orgNode) {
        info.manufacturer = cleanText(orgNode.textContent);
    }
    
    // Extract DEA schedule
    const scheduleNode = xmlDoc.querySelector('policy[classCode="DEADrugSchedule"] code');
    if (scheduleNode) {
        const scheduleCode = scheduleNode.getAttribute('displayName') || scheduleNode.getAttribute('code');
        info.schedule = scheduleCode;
    }
    
    // Extract approval info
    const approvalNode = xmlDoc.querySelector('approval id');
    if (approvalNode) {
        info.approval = approvalNode.getAttribute('extension') || '';
    }
    
    // Extract routes of administration
    xmlDoc.querySelectorAll('routeCode').forEach(route => {
        const routeName = route.getAttribute('displayName') || route.getAttribute('code');
        if (routeName && !info.routes.includes(routeName)) {
            info.routes.push(routeName);
        }
    });
    
    // Extract strengths
    xmlDoc.querySelectorAll('ingredient[classCode="ACTIM"] quantity').forEach(qty => {
        const numerator = qty.querySelector('numerator');
        const denominator = qty.querySelector('denominator');
        if (numerator && denominator) {
            const strength = `${numerator.getAttribute('value')} ${numerator.getAttribute('unit')}/${denominator.getAttribute('value')} ${denominator.getAttribute('unit')}`;
            if (!info.strengths.includes(strength)) {
                info.strengths.push(strength);
            }
        }
    });
    
    return info;
}

function extractSections(xmlDoc) {
    const sections = [];
    const sectionNodes = xmlDoc.querySelectorAll('component > section');
    
    sectionNodes.forEach((section, index) => {
        const sectionData = {
            id: section.querySelector('id')?.getAttribute('root') || `section-${index}`,
            code: section.querySelector('code')?.getAttribute('code') || '',
            displayName: section.querySelector('code')?.getAttribute('displayName') || '',
            title: '',
            content: '',
            subsections: []
        };
        
        // Get section title
        const titleNode = section.querySelector('title');
        if (titleNode) {
            sectionData.title = cleanText(titleNode.textContent);
        }
        
        // Get section text content
        const textNode = section.querySelector('text');
        if (textNode) {
            sectionData.content = parseTextContent(textNode);
        }
        
        // Get highlights/excerpt if available
        const excerptNode = section.querySelector('excerpt highlight text');
        if (excerptNode) {
            sectionData.highlight = parseTextContent(excerptNode);
        }
        
        // Only add sections with content
        if (sectionData.title || sectionData.content) {
            sections.push(sectionData);
        }
    });
    
    return sections;
}

function parseTextContent(textNode) {
    let html = '';
    
    // Process paragraphs
    textNode.querySelectorAll('paragraph').forEach(p => {
        const text = cleanText(p.textContent);
        if (text) {
            html += `<p>${text}</p>`;
        }
    });
    
    // Process lists
    textNode.querySelectorAll('list').forEach(list => {
        const listType = list.getAttribute('listType') === 'ordered' ? 'ol' : 'ul';
        html += `<${listType}>`;
        list.querySelectorAll('item').forEach(item => {
            const itemText = cleanText(item.textContent);
            if (itemText) {
                html += `<li>${itemText}</li>`;
            }
        });
        html += `</${listType}>`;
    });
    
    // Process tables
    textNode.querySelectorAll('table').forEach(table => {
        html += '<table class="data-table">';
        
        // Caption
        const caption = table.querySelector('caption');
        if (caption) {
            html += `<caption>${cleanText(caption.textContent)}</caption>`;
        }
        
        // Table body
        const tbody = table.querySelector('tbody');
        if (tbody) {
            html += '<tbody>';
            tbody.querySelectorAll('tr').forEach((row, rowIndex) => {
                html += '<tr>';
                row.querySelectorAll('td, th').forEach(cell => {
                    const cellTag = rowIndex === 0 ? 'th' : 'td';
                    html += `<${cellTag}>${cleanText(cell.textContent)}</${cellTag}>`;
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }
        
        html += '</table>';
    });
    
    // If no structured content found, return cleaned text content
    if (!html && textNode.textContent) {
        html = `<p>${cleanText(textNode.textContent)}</p>`;
    }
    
    return html;
}

function buildHeader(info) {
    return `
        <header class="label-header">
            <h1>${info.productName || 'Pharmaceutical Product'}</h1>
            ${info.title ? `<p class="subtitle">${info.title}</p>` : ''}
            
            <div class="header-metadata">
                ${info.manufacturer ? `
                    <div class="meta-item">
                        <span class="meta-label">Manufacturer</span>
                        <span class="meta-value">${info.manufacturer}</span>
                    </div>
                ` : ''}
                ${info.ndc ? `
                    <div class="meta-item">
                        <span class="meta-label">NDC</span>
                        <span class="meta-value">${info.ndc}</span>
                    </div>
                ` : ''}
                ${info.schedule ? `
                    <div class="meta-item">
                        <span class="meta-label">DEA Schedule</span>
                        <span class="meta-value">${info.schedule}</span>
                    </div>
                ` : ''}
                ${info.approval ? `
                    <div class="meta-item">
                        <span class="meta-label">Approval</span>
                        <span class="meta-value">${info.approval}</span>
                    </div>
                ` : ''}
                ${info.effectiveDate ? `
                    <div class="meta-item">
                        <span class="meta-label">Effective Date</span>
                        <span class="meta-value">${info.effectiveDate}</span>
                    </div>
                ` : ''}
                ${info.versionNumber ? `
                    <div class="meta-item">
                        <span class="meta-label">Version</span>
                        <span class="meta-value">${info.versionNumber}</span>
                    </div>
                ` : ''}
            </div>
            
            ${info.routes.length > 0 ? `
                <div class="routes-container">
                    <span class="routes-label">Routes:</span>
                    ${info.routes.map(route => `<span class="route-badge">${route}</span>`).join('')}
                </div>
            ` : ''}
            
            ${info.strengths.length > 0 ? `
                <div class="strengths-container">
                    <span class="strengths-label">Available Strengths:</span>
                    ${info.strengths.map(strength => `<span class="strength-badge">${strength}</span>`).join('')}
                </div>
            ` : ''}
        </header>
    `;
}

function buildNavigation(sections) {
    // Group sections by type for better organization
    const importantSections = ['CONTRAINDICATIONS', 'WARNINGS', 'BOXED WARNING'];
    const mainSections = [];
    const highlights = [];
    
    sections.forEach(section => {
        const displayName = section.displayName?.toUpperCase() || section.title?.toUpperCase() || '';
        
        if (displayName.includes('HIGHLIGHT') || displayName.includes('RECENT')) {
            highlights.push(section);
        } else {
            mainSections.push(section);
        }
    });
    
    return ''; // Navigation built in sidebar
}

function buildSidebar(sections) {
    // Number the main sections
    const numberedSections = [];
    let sectionNumber = 1;
    
    sections.forEach(section => {
        const title = section.title || section.displayName || 'Untitled Section';
        
        // Skip metadata sections
        if (title.includes('SPL UNCLASSIFIED') || title.includes('data elements')) {
            return;
        }
        
        // Extract section number if present
        const numberMatch = title.match(/^(\d+)\s+(.+)/);
        if (numberMatch) {
            section.number = numberMatch[1];
            section.displayTitle = numberMatch[2];
        } else {
            section.displayTitle = title;
        }
        
        numberedSections.push(section);
    });
    
    return `
        <aside class="sidebar">
            <h3>Table of Contents</h3>
            <nav class="toc">
                ${numberedSections.map(section => `
                    <a href="#${section.id}" class="toc-link" onclick="scrollToSection('${section.id}'); return false;">
                        ${section.number ? `<span class="toc-number">${section.number}</span>` : ''}
                        <span class="toc-title">${section.displayTitle}</span>
                    </a>
                `).join('')}
            </nav>
        </aside>
    `;
}

function buildSections(sections) {
    let html = '';
    
    sections.forEach(section => {
        const title = section.title || section.displayName || '';
        
        // Skip metadata sections
        if (title.includes('SPL UNCLASSIFIED') || title.includes('data elements') || !title) {
            return;
        }
        
        const isWarning = title.toUpperCase().includes('WARNING') || 
                         title.toUpperCase().includes('CONTRAINDICATION');
        const isHighlight = title.toUpperCase().includes('HIGHLIGHT');
        
        html += `
            <section id="${section.id}" class="content-section ${isWarning ? 'warning-section' : ''} ${isHighlight ? 'highlight-section' : ''}">
                <h2 class="section-title">
                    ${section.number ? `<span class="section-number">${section.number}</span>` : ''}
                    ${section.displayTitle || title}
                </h2>
                
                ${section.highlight ? `
                    <div class="section-highlight">
                        ${section.highlight}
                    </div>
                ` : ''}
                
                <div class="section-content">
                    ${section.content}
                </div>
            </section>
        `;
    });
    
    return html;
}

function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

function LabelformatDate(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr;
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Update active state in TOC
        document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });
    }
}

function getStyles() {
    return `
        <style>
            .pharma-label-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1400px;
                margin: 0 auto;
                background: #fff;
            }
            
            .label-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
            }
            
            .label-header h1 {
                margin: 0 0 10px 0;
                font-size: 2.5em;
                font-weight: 700;
            }
            
            .subtitle {
                font-size: 1.1em;
                opacity: 0.95;
                margin: 10px 0;
            }
            
            .header-metadata {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 25px;
            }
            
            .meta-item {
                background: rgba(255,255,255,0.15);
                padding: 10px 15px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
            }
            
            .meta-label {
                display: block;
                font-size: 0.85em;
                opacity: 0.9;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 3px;
            }
            
            .meta-value {
                display: block;
                font-size: 1.1em;
                font-weight: 600;
            }
            
            .routes-container, .strengths-container {
                margin-top: 20px;
                padding: 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
            }
            
            .routes-label, .strengths-label {
                font-weight: 600;
                margin-right: 10px;
                text-transform: uppercase;
                font-size: 0.9em;
                letter-spacing: 1px;
            }
            
            .route-badge, .strength-badge {
                display: inline-block;
                background: rgba(255,255,255,0.25);
                padding: 5px 12px;
                border-radius: 20px;
                margin: 5px;
                font-size: 0.95em;
            }
            
            .content-wrapper {
                display: grid;
                grid-template-columns: 280px 1fr;
                min-height: 600px;
            }
            
            .sidebar {
                background: #f8f9fa;
                padding: 25px;
                border-right: 1px solid #dee2e6;
            }
            
            .sidebar h3 {
                margin: 0 0 20px 0;
                color: #667eea;
                font-size: 1.1em;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .toc {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .toc-link {
                display: flex;
                align-items: center;
                padding: 10px 15px;
                color: #495057;
                text-decoration: none;
                border-radius: 8px;
                transition: all 0.3s ease;
                font-size: 0.95em;
            }
            
            .toc-link:hover {
                background: #e9ecef;
                color: #667eea;
                transform: translateX(5px);
            }
            
            .toc-link.active {
                background: #667eea;
                color: white;
            }
            
            .toc-number {
                display: inline-block;
                min-width: 25px;
                margin-right: 10px;
                font-weight: 600;
            }
            
            .main-content {
                padding: 30px;
                overflow-y: auto;
                max-height: calc(100vh - 200px);
            }
            
            .content-section {
                margin-bottom: 40px;
                padding-bottom: 30px;
                border-bottom: 1px solid #dee2e6;
            }
            
            .content-section:last-child {
                border-bottom: none;
            }
            
            .section-title {
                display: flex;
                align-items: center;
                margin: 0 0 20px 0;
                color: #2c3e50;
                font-size: 1.8em;
                font-weight: 600;
            }
            
            .section-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #667eea;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                margin-right: 15px;
                font-size: 1.2em;
                flex-shrink: 0;
            }
            
            .section-content {
                color: #495057;
                line-height: 1.8;
            }
            
            .section-content p {
                margin: 0 0 15px 0;
            }
            
            .section-content ul, .section-content ol {
                margin: 15px 0;
                padding-left: 30px;
            }
            
            .section-content li {
                margin-bottom: 8px;
            }
            
            .section-highlight {
                background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
                border-left: 4px solid #667eea;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .warning-section .section-title {
                color: #d32f2f;
            }
            
            .warning-section .section-number {
                background: #d32f2f;
            }
            
            .warning-section .section-content {
                background: #fff3e0;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #ff9800;
            }
            
            .highlight-section {
                background: #f0f4ff;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 0.95em;
            }
            
            .data-table caption {
                padding: 10px;
                font-weight: 600;
                text-align: left;
                color: #667eea;
            }
            
            .data-table th {
                background: #667eea;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
            }
            
            .data-table td {
                padding: 12px;
                border-bottom: 1px solid #dee2e6;
            }
            
            .data-table tr:hover {
                background: #f8f9fa;
            }
            
            @media (max-width: 768px) {
                .content-wrapper {
                    grid-template-columns: 1fr;
                }
                
                .sidebar {
                    display: none;
                }
                
                .header-metadata {
                    grid-template-columns: 1fr;
                }
                
                .section-title {
                    font-size: 1.4em;
                }
            }
            
            @media print {
                .sidebar {
                    display: none;
                }
                
                .content-wrapper {
                    grid-template-columns: 1fr;
                }
                
                .label-header {
                    background: none;
                    color: black;
                    border: 2px solid #333;
                }
            }
        </style>
    `;
}

// Usage example for integration with your existing code
function renderPharmaLabel(xmlString, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = formatPharmaceuticalXML(xmlString);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatPharmaceuticalXML, renderPharmaLabel };
}


function displayMetadata(metadata) {
    const metadataHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-lg px-3 py-2 border border-gray-200">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Set ID</div>
                <div class="text-sm font-semibold text-gray-900 truncate" title="${metadata.setId || 'N/A'}">
                    ${metadata.setId || 'N/A'}
                </div>
            </div>
            <div class="bg-white rounded-lg px-3 py-2 border border-gray-200">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Version</div>
                <div class="text-sm font-semibold text-gray-900">
                    ${metadata.versionNumber || 'N/A'}
                </div>
            </div>
            <div class="bg-white rounded-lg px-3 py-2 border border-gray-200">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Effective Date</div>
                <div class="text-sm font-semibold text-gray-900">
                    ${metadata.effectiveDate ? LabelformatDate(metadata.effectiveDate) : 'N/A'}
                </div>
            </div>
            <div class="bg-white rounded-lg px-3 py-2 border border-gray-200">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Title</div>
                <div class="text-sm font-semibold text-gray-900 truncate" title="${metadata.title || 'N/A'}">
                    ${metadata.title || 'N/A'}
                </div>
            </div>
        </div>
    `;
    document.getElementById('metadataSection').innerHTML = metadataHtml;
}

function renderXMLTree(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        document.getElementById('xmlTreeContent').innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-4xl text-yellow-400 mb-4"></i>
                <p class="text-yellow-600">XML parsing error</p>
                <p class="text-sm text-gray-500 mt-2">The XML structure could not be parsed correctly</p>
                <details class="mt-4 text-left max-w-2xl mx-auto">
                    <summary class="cursor-pointer text-blue-600 hover:text-blue-700">Show raw XML</summary>
                    <pre class="mt-2 p-4 bg-gray-100 rounded overflow-x-auto text-xs">${escapeHtml(xmlString.substring(0, 5000))}...</pre>
                </details>
            </div>
        `;
        return;
    }
    
    let nodeId = 0;
    
    function renderNode(node, depth = 0) {
        if (node.nodeType === 3) { // Text node
            const text = node.nodeValue.trim();
            if (!text) return '';
            return `<span class="text-gray-700">${escapeHtml(text)}</span>`;
        }
        
        if (node.nodeType !== 1) return ''; // Skip non-element nodes
        
        const currentNodeId = `node-${nodeId++}`;
        const hasChildren = node.childNodes.length > 0;
        const hasElementChildren = [...node.childNodes].some(child => child.nodeType === 1);
        const indent = depth * 20;
        
        let html = `<div class="xml-node" style="margin-left: ${indent}px;">`;
        
        // Render opening tag
        if (hasElementChildren) {
            html += `
                <span class="cursor-pointer hover:bg-yellow-50 inline-block" onclick="toggleXMLNode('${currentNodeId}')">
                    <span class="text-gray-500" id="${currentNodeId}-toggle">▼</span>
                    <span class="text-blue-600">&lt;</span><span class="text-blue-800 font-semibold">${node.nodeName}</span>`;
        } else {
            html += `
                <span class="inline-block">
                    <span class="text-blue-600">&lt;</span><span class="text-blue-800 font-semibold">${node.nodeName}</span>`;
        }
        
        // Render attributes
        if (node.attributes && node.attributes.length > 0) {
            for (let attr of node.attributes) {
                html += ` <span class="text-purple-600">${attr.name}</span>=<span class="text-green-600">"${escapeHtml(attr.value)}"</span>`;
            }
        }
        
        html += `<span class="text-blue-600">&gt;</span></span>`;
        
        // Render children
        if (hasChildren) {
            const childrenHtml = [...node.childNodes]
                .map(child => renderNode(child, depth + 1))
                .filter(h => h)
                .join('');
            
            if (hasElementChildren) {
                html += `<div id="${currentNodeId}-content" class="xml-children">${childrenHtml}</div>`;
                html += `<div style="margin-left: ${indent}px;">`;
            } else {
                html += childrenHtml;
            }
            
            html += `<span class="text-blue-600">&lt;/</span><span class="text-blue-800 font-semibold">${node.nodeName}</span><span class="text-blue-600">&gt;</span>`;
            
            if (hasElementChildren) {
                html += `</div>`;
            }
        } else {
            html += `<span class="text-blue-600">/&gt;</span>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    const treeHtml = renderNode(xmlDoc.documentElement);
    document.getElementById('xmlTreeContent').innerHTML = `
        <div class="xml-tree">
            ${treeHtml}
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleXMLNode(nodeId) {
    const content = document.getElementById(`${nodeId}-content`);
    const toggle = document.getElementById(`${nodeId}-toggle`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
    }
}

function expandAllXML() {
    document.querySelectorAll('.xml-children').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelectorAll('[id$="-toggle"]').forEach(el => {
        el.textContent = '▼';
    });
}

function collapseAllXML() {
    document.querySelectorAll('.xml-children').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('[id$="-toggle"]').forEach(el => {
        el.textContent = '▶';
    });
}

function copyXMLToClipboard(labelId) {
    if (window.currentLabelData && window.currentLabelData.xml && window.currentLabelData.xml.raw) {
        navigator.clipboard.writeText(window.currentLabelData.xml.raw).then(() => {
            // Show success message
            const btn = event.target.closest('button');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
            btn.classList.remove('bg-green-600');
            btn.classList.add('bg-green-700');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('bg-green-700');
                btn.classList.add('bg-green-600');
            }, 2000);
        });
    }
}

function downloadXML(labelId) {
    if (window.currentLabelData && window.currentLabelData.xml && window.currentLabelData.xml.raw) {
        const blob = new Blob([window.currentLabelData.xml.raw], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `label_${labelId}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function downloadParsedData(labelId) {
    if (window.currentLabelData && window.currentLabelData.data) {
        const blob = new Blob([JSON.stringify(window.currentLabelData.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `label_${labelId}_parsed.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Add some CSS for better XML tree visualization
const xmlstyle = document.createElement('style');
xmlstyle.textContent = `
    .xml-tree {
        font-family: 'Courier New', Courier, monospace;
        line-height: 1.6;
    }
    .xml-node {
        margin: 2px 0;
    }
    .xml-children {
        margin-left: 20px;
        border-left: 1px solid #e5e7eb;
        padding-left: 4px;
    }
    .xml-node:hover > span:first-child {
        background-color: #fef3c7;
    }
`;
document.head.appendChild(xmlstyle);

function extractValue(value) {
    if (!value) return '';
    
    // If it's already a clean string, return it
    if (typeof value === 'string' && !value.includes('Object]')) {
        return value.trim();
    }
    
    // If it's an array, get the first meaningful element
    if (Array.isArray(value)) {
        for (let item of value) {
            const extracted = extractValue(item);
            if (extracted && extracted !== '[Complex Data]') {
                return extracted;
            }
        }
        return value.length > 0 ? extractValue(value[0]) : '';
    }
    
    // If it's an object, extract based on SPL structure
    if (typeof value === 'object') {
        // Check for text content nodes first
        if (value._ !== undefined && value._ !== '') return value._;
        if (value['#text'] !== undefined) return value['#text'];
        if (value.text !== undefined) return extractValue(value.text);
        if (value.content !== undefined) return extractValue(value.content);
        
        // For attributes (common in SPL)
        if (value.$ !== undefined) {
            if (value.$.value) return value.$.value;
            if (value.$.root) return value.$.root;
            if (value.$.extension) return value.$.extension;
            if (value.$.displayName) return value.$.displayName;
            if (value.$.code) return value.$.code;
        }
        
        // For specific SPL elements
        if (value.value !== undefined) return extractValue(value.value);
        if (value.name !== undefined) return extractValue(value.name);
        if (value.title !== undefined) return extractValue(value.title);
        if (value.root !== undefined) return value.root;
        if (value.extension !== undefined) return value.extension;
        if (value.displayName !== undefined) return value.displayName;
        
        // For version numbers
        if (value.versionNumber !== undefined) return extractValue(value.versionNumber);
        if (value.versionnumber !== undefined) return extractValue(value.versionnumber);
        
        // For dates
        if (value.effectiveTime !== undefined) return extractValue(value.effectiveTime);
        if (value.effectivetime !== undefined) return extractValue(value.effectivetime);
        
        // For manufacturer/organization
        if (value.representedOrganization !== undefined) {
            return extractOrganizationName(value.representedOrganization);
        }
        if (value.representedorganization !== undefined) {
            return extractOrganizationName(value.representedorganization);
        }
        
        // Try to find any meaningful string in the object
        for (const key in value) {
            if (key !== '$' && key !== 'id' && key !== 'code') {
                const val = value[key];
                if (typeof val === 'string' && val.trim() && !val.includes('1.3.6.1.4.1.519.1')) {
                    return val.trim();
                }
            }
        }
        
        // Last resort - return empty instead of [Complex Data]
        return '';
    }
    
    // Default return
    return String(value).trim();
}

// Specialized function to extract organization/manufacturer name
function extractOrganizationName(org) {
    if (!org) return '';
    
    // If it's a string, return it
    if (typeof org === 'string') return org;
    
    // Look for name in the organization structure
    if (org.name) {
        const name = extractValue(org.name);
        // Filter out OID numbers and codes
        if (name && !name.includes('1.3.6.1.4.1') && !name.match(/^\d+$/)) {
            return name;
        }
    }
    
    // Check for nested representedOrganization
    if (org.representedOrganization) {
        return extractOrganizationName(org.representedOrganization);
    }
    
    // Look through all properties for a meaningful name
    for (const key in org) {
        if (key === 'name' || key.toLowerCase().includes('name')) {
            const val = extractValue(org[key]);
            if (val && !val.includes('1.3.6.1.4.1') && !val.match(/^\d+$/) && val !== 'MANU') {
                return val;
            }
        }
    }
    
    return '';
}

// Improved function to clean manufacturer string
function cleanManufacturerString(str) {
    if (!str) return '';
    
    // Remove OID numbers (1.3.6.1.4.1.519.1 format)
    str = str.replace(/1\.3\.6\.1\.4\.1\.\d+\.\d+/g, '');
    
    // Remove numeric IDs
    str = str.replace(/\b\d{9,}\b/g, '');
    
    // Remove MANU tags
    str = str.replace(/\bMANU\b/g, '');
    
    // Remove duplicate entries
    const parts = str.split(/\s+/).filter(p => p.trim());
    const unique = [...new Set(parts)];
    
    // Join and clean
    str = unique.join(' ').trim();
    
    // If we still have a meaningful string, return it
    if (str && str.length > 2) {
        return str;
    }
    
    return 'Not specified';
}

// // Function to render label content with proper FDA formatting
// function renderLabelContent(data, labelId) {
//     const content = document.getElementById('labelContent');
//     const sectionLinks = document.getElementById('sectionLinks');
    
//     // Define section order as per FDA guidelines
//     const sectionOrder = [
//         'Boxed Warning',
//         'Lactic Acidosis', // For specific drugs like Metformin
//         'Indications and Usage',
//         'Dosage and Administration',
//         'Dosage Forms and Strengths',
//         'Contraindications',
//         'Warnings and Precautions',
//         'Adverse Reactions',
//         'Drug Interactions',
//         'Use in Specific Populations',
//         'Drug Abuse and Dependence',
//         'Overdosage',
//         'Description',
//         'Clinical Pharmacology',
//         'Nonclinical Toxicology',
//         'Clinical Studies',
//         'References',
//         'How Supplied/Storage and Handling',
//         'Patient Counseling Information',
//         'Medication Guide'
//     ];
    
//     // Sort sections according to FDA order
//     const sortedSections = {};
//     sectionOrder.forEach(sectionName => {
//         if (data.sections && data.sections[sectionName]) {
//             sortedSections[sectionName] = data.sections[sectionName];
//         }
//     });
    
//     // Add any remaining sections not in the standard order
//     if (data.sections) {
//         Object.entries(data.sections).forEach(([key, value]) => {
//             if (!sortedSections[key] && value) {
//                 sortedSections[key] = value;
//             }
//         });
//     }
    
//     // Generate navigation links
//     const navLinksHtml = Object.keys(sortedSections).map((section, index) => {
//         const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
//         const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions'].includes(section);
        
//         return `
//             <a href="#${sectionId}" 
//                onclick="scrollToSection('${sectionId}')"
//                class="block px-3 py-2 text-sm rounded transition-colors ${
//                    isImportant 
//                    ? 'text-red-700 hover:bg-red-50 font-medium' 
//                    : 'text-gray-700 hover:bg-gray-100'
//                }">
//                 ${isImportant ? '<i class="fas fa-exclamation-triangle text-xs mr-1"></i>' : ''}
//                 ${index + 1}. ${section}
//             </a>
//         `;
//     }).join('');
    
//     sectionLinks.innerHTML = navLinksHtml || '<p class="text-sm text-gray-500">No sections available</p>';
    
//     // Generate main content
//     const contentHtml = Object.entries(sortedSections).map(([section, text], index) => {
//         const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
//         const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(section);
        
//         return `
//             <div id="${sectionId}" class="mb-8 scroll-mt-4">
//                 ${isImportant ? `
//                     <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
//                         <h4 class="font-bold text-red-800 text-xl mb-3 flex items-center">
//                             <i class="fas fa-exclamation-triangle mr-2"></i>
//                             ${index + 1}. ${section.toUpperCase()}
//                         </h4>
//                         <div class="text-red-700 leading-relaxed whitespace-pre-wrap">
//                             ${formatLabelText(text)}
//                         </div>
//                     </div>
//                 ` : `
//                     <div class="mb-6">
//                         <h4 class="font-bold text-gray-900 text-lg mb-3 pb-2 border-b border-gray-200">
//                             ${index + 1}. ${section}
//                         </h4>
//                         <div class="text-gray-700 leading-relaxed whitespace-pre-wrap">
//                             ${formatLabelText(text)}
//                         </div>
//                     </div>
//                 `}
//             </div>
//         `;
//     }).join('');
    
//     // Add metadata section if available
//     const metadataHtml = data.metadata ? `
//         <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
//             <h4 class="font-bold text-blue-900 text-lg mb-4">
//                 <i class="fas fa-info-circle mr-2"></i>Label Information
//             </h4>
//             <div class="grid grid-cols-2 gap-4 text-sm">
//                 ${data.metadata.title ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Product:</span>
//                         <span class="text-gray-800 ml-2">${data.metadata.title}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.setId ? `
//                     <div>
//                         <span class="font-medium text-gray-600">SPL Set ID:</span>
//                         <span class="text-gray-800 ml-2 font-mono text-xs">${data.metadata.setId}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.versionNumber ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Version:</span>
//                         <span class="text-gray-800 ml-2">${data.metadata.versionNumber}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.effectiveDate ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Effective Date:</span>
//                         <span class="text-gray-800 ml-2">${formatDate(data.metadata.effectiveDate)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.manufacturer ? `
//                     <div class="col-span-2">
//                         <span class="font-medium text-gray-600">Manufacturer:</span>
//                         <span class="text-gray-800 ml-2">${data.metadata.manufacturer}</span>
//                     </div>
//                 ` : ''}
//             </div>
//         </div>
//     ` : '';
    
//     // Add images section if available
//     const imagesHtml = data.images && data.images.length > 0 ? `
//         <div class="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
//             <h4 class="font-bold text-purple-900 text-lg mb-4">
//                 <i class="fas fa-images mr-2"></i>Label Images & Diagrams
//             </h4>
//             <div class="grid grid-cols-3 gap-4">
//                 ${data.images.map(img => `
//                     <div class="bg-white border border-purple-300 rounded p-3">
//                         ${img.url ? `
//                             <a href="${img.url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
//                                 <i class="fas fa-external-link-alt mr-1"></i>View Image
//                             </a>
//                         ` : `
//                             <p class="text-xs text-gray-600 font-mono">${img.id}</p>
//                         `}
//                     </div>
//                 `).join('')}
//             </div>
//         </div>
//     ` : '';
    
//     content.innerHTML = metadataHtml + imagesHtml + contentHtml;
// }




// function renderLabelContent(data, labelId) {
//     const content = document.getElementById('labelContent');
//     const sectionLinks = document.getElementById('sectionLinks');
    
//     // Define section order as per FDA guidelines
//     const sectionOrder = [
//         'Boxed Warning',
//         'Lactic Acidosis',
//         'Indications and Usage',
//         'Dosage and Administration', 
//         'Dosage Forms and Strengths',
//         'Contraindications',
//         'Warnings and Precautions',
//         'Adverse Reactions',
//         'Drug Interactions',
//         'Use in Specific Populations',
//         'Drug Abuse and Dependence',
//         'Overdosage',
//         'Description',
//         'Clinical Pharmacology',
//         'Nonclinical Toxicology',
//         'Clinical Studies',
//         'References',
//         'How Supplied/Storage and Handling',
//         'Patient Counseling Information',
//         'Medication Guide'
//     ];
    
//     // Sort sections according to FDA order
//     const sortedSections = {};
//     sectionOrder.forEach(sectionName => {
//         if (data.sections && data.sections[sectionName]) {
//             sortedSections[sectionName] = data.sections[sectionName];
//         }
//     });
    
//     // Add any remaining sections not in the standard order
//     if (data.sections) {
//         Object.entries(data.sections).forEach(([key, value]) => {
//             if (!sortedSections[key] && value) {
//                 sortedSections[key] = value;
//             }
//         });
//     }
    
//     // Generate navigation links
//     const navLinksHtml = Object.keys(sortedSections).map((section, index) => {
//         const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
//         const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(section);
        
//         return `
//             <a href="#${sectionId}" 
//                onclick="scrollToSection('${sectionId}'); return false;"
//                class="block px-3 py-2 text-sm rounded transition-colors ${
//                    isImportant 
//                    ? 'text-red-700 hover:bg-red-50 font-medium' 
//                    : 'text-gray-700 hover:bg-gray-100'
//                }">
//                 ${isImportant ? '<i class="fas fa-exclamation-triangle text-xs mr-1"></i>' : ''}
//                 ${index + 1}. ${section}
//             </a>
//         `;
//     }).join('');
    
//     sectionLinks.innerHTML = navLinksHtml || '<p class="text-sm text-gray-500">No sections available</p>';
    
//     // Generate main content with proper text handling
//     const contentHtml = Object.entries(sortedSections).map(([section, text], index) => {
//         const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
//         const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(section);
        
//         // Clean and format the text content
//         const cleanedText = cleanLabelText(text);
        
//         return `
//             <div id="${sectionId}" class="mb-8 scroll-mt-4">
//                 ${isImportant ? `
//                     <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
//                         <h4 class="font-bold text-red-800 text-xl mb-3 flex items-center">
//                             <i class="fas fa-exclamation-triangle mr-2"></i>
//                             ${index + 1}. ${section.toUpperCase()}
//                         </h4>
//                         <div class="text-red-700 leading-relaxed whitespace-pre-wrap">
//                             ${formatLabelText(cleanedText)}
//                         </div>
//                     </div>
//                 ` : `
//                     <div class="mb-6">
//                         <h4 class="font-bold text-gray-900 text-lg mb-3 pb-2 border-b border-gray-200">
//                             ${index + 1}. ${section}
//                         </h4>
//                         <div class="text-gray-700 leading-relaxed whitespace-pre-wrap">
//                             ${formatLabelText(cleanedText)}
//                         </div>
//                     </div>
//                 `}
//             </div>
//         `;
//     }).join('');
    
//     // Add metadata section with proper value extraction
//     const metadataHtml = data.metadata ? `
//         <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
//             <h4 class="font-bold text-blue-900 text-lg mb-4">
//                 <i class="fas fa-info-circle mr-2"></i>Label Information
//             </h4>
//             <div class="grid grid-cols-2 gap-4 text-sm">
//                 ${data.metadata.title ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Product:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.metadata.title)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.setId ? `
//                     <div>
//                         <span class="font-medium text-gray-600">SPL Set ID:</span>
//                         <span class="text-gray-800 ml-2 font-mono text-xs">${extractValue(data.metadata.setId)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.versionNumber ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Version:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.metadata.versionNumber)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.effectiveDate ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Effective Date:</span>
//                         <span class="text-gray-800 ml-2">${formatDate(extractValue(data.metadata.effectiveDate))}</span>
//                     </div>
//                 ` : ''}
//                 ${data.metadata.manufacturer ? `
//                     <div class="col-span-2">
//                         <span class="font-medium text-gray-600">Manufacturer:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.metadata.manufacturer)}</span>
//                     </div>
//                 ` : ''}
//             </div>
//         </div>
//     ` : '';
    
//     // Add product info section if available
//     const productInfoHtml = data.productInfo && Object.keys(data.productInfo).length > 0 ? `
//         <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
//             <h4 class="font-bold text-green-900 text-lg mb-4">
//                 <i class="fas fa-pills mr-2"></i>Product Details
//             </h4>
//             <div class="grid grid-cols-2 gap-4 text-sm">
//                 ${data.productInfo.name ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Name:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.productInfo.name)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.productInfo.dosageForm ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Dosage Form:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.productInfo.dosageForm)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.productInfo.route ? `
//                     <div>
//                         <span class="font-medium text-gray-600">Route:</span>
//                         <span class="text-gray-800 ml-2">${extractValue(data.productInfo.route)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.productInfo.ndc ? `
//                     <div>
//                         <span class="font-medium text-gray-600">NDC:</span>
//                         <span class="text-gray-800 ml-2 font-mono text-xs">${extractValue(data.productInfo.ndc)}</span>
//                     </div>
//                 ` : ''}
//                 ${data.productInfo.activeIngredients && data.productInfo.activeIngredients.length > 0 ? `
//                     <div class="col-span-2">
//                         <span class="font-medium text-gray-600">Active Ingredients:</span>
//                         <ul class="mt-2 space-y-1">
//                             ${data.productInfo.activeIngredients.map(ing => `
//                                 <li class="text-gray-700 ml-4">
//                                     • ${extractValue(ing.name)} ${ing.strength ? `(${extractValue(ing.strength)})` : ''}
//                                 </li>
//                             `).join('')}
//                         </ul>
//                     </div>
//                 ` : ''}
//             </div>
//         </div>
//     ` : '';
    
//     // Add images section if available
//     const imagesHtml = data.images && data.images.length > 0 ? `
//         <div class="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
//             <h4 class="font-bold text-purple-900 text-lg mb-4">
//                 <i class="fas fa-images mr-2"></i>Label Images & Diagrams
//             </h4>
//             <div class="grid grid-cols-3 gap-4">
//                 ${data.images.map(img => `
//                     <div class="bg-white border border-purple-300 rounded p-3">
//                         ${img.url ? `
//                             <a href="${img.url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
//                                 <i class="fas fa-external-link-alt mr-1"></i>View Image
//                             </a>
//                         ` : `
//                             <p class="text-xs text-gray-600 font-mono">${img.id}</p>
//                         `}
//                         ${img.mediaType ? `<p class="text-xs text-gray-500 mt-1">Type: ${img.mediaType}</p>` : ''}
//                     </div>
//                 `).join('')}
//             </div>
//         </div>
//     ` : '';
    
//     content.innerHTML = metadataHtml + productInfoHtml + imagesHtml + contentHtml;
// }



// Function to clean label text and remove [object Object]
function cleanLabelText(text) {
    if (!text) return '';
    
    // If text is an object, try to extract its value
    if (typeof text === 'object') {
        text = extractValue(text);
    }
    
    // Convert to string and clean
    text = String(text);
    
    // Replace [object Object] with more meaningful text
    text = text.replace(/\[object Object\]/g, '[See full document]');
    
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}


// Function to format label text with proper styling
// function formatLabelText(text) {
//     if (!text) return '';
    
//     // Clean up [object Object] placeholders
//     text = text.replace(/\[object Object\]/g, '[See full document]');
    
//     // Format tables
//     text = text.replace(/\[Table\]/g, '<div class="bg-gray-100 p-2 rounded my-2 font-mono text-xs">📊 Table Content</div>');
    
//     // Format images
//     text = text.replace(/\[Image: ([^\]]+)\]/g, '<div class="bg-blue-100 p-2 rounded my-2 text-blue-700 text-sm">🖼️ Image: $1</div>');
    
//     // Format bullet points
//     text = text.replace(/^•\s*/gm, '<span class="inline-block w-4">•</span>');
    
//     // Format numbered lists
//     text = text.replace(/^(\d+)\.\s*/gm, '<span class="inline-block w-6 font-medium">$1.</span>');
    
//     // Handle subsections (text starting with numbers like 2.1, 2.2, etc.)
//     text = text.replace(/^(\d+\.\d+)\s+(.+)$/gm, '<div class="mt-4 mb-2"><strong>$1 $2</strong></div>');
    
//     return text;
// }


// function formatLabelText(text) {
//     if (!text) return '';
    
//     // Ensure text is a string
//     text = String(text);
    
//     // Clean up [object Object] placeholders
//     text = text.replace(/\[object Object\]/g, '<span class="text-blue-600 text-sm">[See full document]</span>');
    
//     // Format tables
//     text = text.replace(/\[Table\]/g, '<div class="bg-gray-100 p-2 rounded my-2 font-mono text-xs">📊 Table Content</div>');
    
//     // Format images
//     text = text.replace(/\[Image: ([^\]]+)\]/g, '<div class="bg-blue-100 p-2 rounded my-2 text-blue-700 text-sm">🖼️ Image: $1</div>');
    
//     // Format references like [See full document]
//     text = text.replace(/\[See full document\]/g, '<span class="text-blue-600 text-sm italic">[See full document]</span>');
    
//     // Format bullet points
//     text = text.replace(/^•\s*/gm, '<span class="inline-block w-4">•</span>');
    
//     // Format numbered lists
//     text = text.replace(/^(\d+)\.\s*/gm, '<span class="inline-block w-6 font-medium">$1.</span>');
    
//     // Handle subsections (text starting with numbers like 2.1, 2.2, etc.)
//     text = text.replace(/^(\d+\.\d+)\s+(.+)$/gm, '<div class="mt-4 mb-2"><strong>$1 $2</strong></div>');
    
//     // Format NDC numbers
//     text = text.replace(/NDC\s+([\d-]+)/g, '<span class="font-mono text-sm bg-gray-100 px-1 rounded">NDC $1</span>');
    
//     // Format dosage amounts
//     text = text.replace(/(\d+\s*mg)/gi, '<span class="font-semibold">$1</span>');
    
//     return text;
// }

function renderLabelContent(data, labelId) {
    const content = document.getElementById('labelContent');
    const sectionLinks = document.getElementById('sectionLinks');
    
    // Define section order as per FDA guidelines
    const sectionOrder = [
        'Boxed Warning',
        'Lactic Acidosis',
        'Indications and Usage',
        'Dosage and Administration',
        'Dosage Forms and Strengths',
        'Contraindications',
        'Warnings and Precautions',
        'Adverse Reactions',
        'Drug Interactions',
        'Use in Specific Populations',
        'Drug Abuse and Dependence',
        'Overdosage',
        'Description',
        'Clinical Pharmacology',
        'Nonclinical Toxicology',
        'Clinical Studies',
        'References',
        'How Supplied/Storage and Handling',
        'Patient Counseling Information',
        'Medication Guide'
    ];
    
    // Sort and filter sections - only include sections with actual content
    const sortedSections = {};
    sectionOrder.forEach(sectionName => {
        if (data.sections && data.sections[sectionName]) {
            const content = extractValue(data.sections[sectionName]);
            // Only include if we have meaningful content (not just IDs)
            if (content && content.length > 10 && !content.match(/^ID\d+$/)) {
                sortedSections[sectionName] = data.sections[sectionName];
            }
        }
    });
    
    // Add remaining sections with meaningful content
    if (data.sections) {
        Object.entries(data.sections).forEach(([key, value]) => {
            if (!sortedSections[key] && value) {
                const content = extractValue(value);
                if (content && content.length > 10 && !content.match(/^ID\d+$/)) {
                    sortedSections[key] = value;
                }
            }
        });
    }
    
    // Generate navigation links for actual sections only
    const navLinksHtml = Object.keys(sortedSections).map((section, index) => {
        const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
        const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(section);
        
        return `
            <a href="#${sectionId}" 
               onclick="scrollToSection('${sectionId}'); return false;"
               class="block px-3 py-2 text-sm rounded transition-colors ${
                   isImportant 
                   ? 'text-red-700 hover:bg-red-50 font-medium' 
                   : 'text-gray-700 hover:bg-gray-100'
               }">
                ${isImportant ? '<i class="fas fa-exclamation-triangle text-xs mr-1"></i>' : ''}
                ${index + 1}. ${section}
            </a>
        `;
    }).join('');
    
    sectionLinks.innerHTML = navLinksHtml || '<p class="text-sm text-gray-500">No sections with content available</p>';
    
    // Generate main content
    const contentHtml = Object.entries(sortedSections).map(([section, text], index) => {
        const sectionId = `section-${section.replace(/\s+/g, '-').toLowerCase()}`;
        const isImportant = ['Boxed Warning', 'Contraindications', 'Warnings and Precautions', 'Lactic Acidosis'].includes(section);
        
        // Extract and clean the text content
        let cleanedText = extractValue(text);
        
        // Skip if it's just an ID reference
        if (cleanedText.match(/^ID\d+$/)) {
            return '';
        }
        
        return `
            <div id="${sectionId}" class="mb-8 scroll-mt-4">
                ${isImportant ? `
                    <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
                        <h4 class="font-bold text-red-800 text-xl mb-3 flex items-center">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            ${index + 1}. ${section.toUpperCase()}
                        </h4>
                        <div class="text-red-700 leading-relaxed whitespace-pre-wrap">
                            ${formatLabelText(cleanedText)}
                        </div>
                    </div>
                ` : `
                    <div class="mb-6">
                        <h4 class="font-bold text-gray-900 text-lg mb-3 pb-2 border-b border-gray-200">
                            ${index + 1}. ${section}
                        </h4>
                        <div class="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            ${formatLabelText(cleanedText)}
                        </div>
                    </div>
                `}
            </div>
        `;
    }).filter(html => html !== '').join('');
    
    // Process metadata properly
    let processedMetadata = {};
    if (data.metadata) {
        processedMetadata = {
            title: extractValue(data.metadata.title) || 'Not specified',
            setId: extractValue(data.metadata.setId) || extractValue(data.metadata.splSetId) || '',
            versionNumber: extractValue(data.metadata.versionNumber) || extractValue(data.metadata.version) || '1.0',
            effectiveDate: extractValue(data.metadata.effectiveDate) || extractValue(data.metadata.effectivetime) || '',
            manufacturer: cleanManufacturerString(extractValue(data.metadata.manufacturer))
        };
    }
    
    // Generate metadata HTML with cleaned values
    const metadataHtml = processedMetadata && Object.keys(processedMetadata).length > 0 ? `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h4 class="font-bold text-blue-900 text-lg mb-4">
                <i class="fas fa-info-circle mr-2"></i>Label Information
            </h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
                ${processedMetadata.title ? `
                    <div>
                        <span class="font-medium text-gray-600">Product:</span>
                        <span class="text-gray-800 ml-2">${processedMetadata.title}</span>
                    </div>
                ` : ''}
                ${processedMetadata.setId ? `
                    <div>
                        <span class="font-medium text-gray-600">SPL Set ID:</span>
                        <span class="text-gray-800 ml-2 font-mono text-xs">${processedMetadata.setId}</span>
                    </div>
                ` : ''}
                ${processedMetadata.versionNumber ? `
                    <div>
                        <span class="font-medium text-gray-600">Version:</span>
                        <span class="text-gray-800 ml-2">${processedMetadata.versionNumber}</span>
                    </div>
                ` : ''}
                ${processedMetadata.effectiveDate && processedMetadata.effectiveDate !== 'N/A' ? `
                    <div>
                        <span class="font-medium text-gray-600">Effective Date:</span>
                        <span class="text-gray-800 ml-2">${LabelformatDate(processedMetadata.effectiveDate)}</span>
                    </div>
                ` : ''}
                ${processedMetadata.manufacturer && processedMetadata.manufacturer !== 'Not specified' ? `
                    <div class="col-span-2">
                        <span class="font-medium text-gray-600">Manufacturer:</span>
                        <span class="text-gray-800 ml-2">${processedMetadata.manufacturer}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    ` : '';
    
    // Process product info if available
    let productInfoHtml = '';
    if (data.productInfo && Object.keys(data.productInfo).length > 0) {
        const hasValidProductInfo = Object.entries(data.productInfo).some(([key, value]) => {
            const extracted = extractValue(value);
            return extracted && extracted.length > 0 && !extracted.match(/^ID\d+$/);
        });
        
        if (hasValidProductInfo) {
            productInfoHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                    <h4 class="font-bold text-green-900 text-lg mb-4">
                        <i class="fas fa-pills mr-2"></i>Product Details
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        ${Object.entries(data.productInfo).map(([key, value]) => {
                            const extracted = extractValue(value);
                            if (!extracted || extracted.match(/^ID\d+$/)) return '';
                            
                            return `
                                <div>
                                    <span class="font-medium text-gray-600">${key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                    <span class="text-gray-800 ml-2">${extracted}</span>
                                </div>
                            `;
                        }).filter(html => html !== '').join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // Combine all sections
    content.innerHTML = metadataHtml + productInfoHtml + contentHtml;
    
    // If no content sections found, show a message
    if (!contentHtml) {
        content.innerHTML += `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <i class="fas fa-exclamation-circle text-yellow-600 text-2xl mb-3"></i>
                <p class="text-yellow-800">No detailed label sections available.</p>
                <p class="text-sm text-yellow-600 mt-2">The label may contain only reference IDs or the content extraction needs improvement.</p>
            </div>
        `;
    }
}

// Enhanced formatLabelText function that handles ID references better
function formatLabelText(text) {
    if (!text) return '';
    
    // Ensure text is a string
    text = String(text);
    
    // Skip ID-only content
    if (text.match(/^ID\d+$/)) {
        return '<span class="text-gray-500 italic">Content reference only - see full document</span>';
    }
    
    // Clean up [object Object] placeholders
    text = text.replace(/\[object Object\]/g, '<span class="text-blue-600 text-sm italic">[See full document]</span>');
    
    // Clean up [See full document] references
    text = text.replace(/\[See full document\]/g, '<span class="text-blue-600 text-sm italic">[See full document]</span>');
    
    // Format tables
    text = text.replace(/\[Table\]/g, '<div class="bg-gray-100 p-2 rounded my-2 font-mono text-xs">📊 Table Content</div>');
    
    // Format images
    text = text.replace(/\[Image: ([^\]]+)\]/g, '<div class="bg-blue-100 p-2 rounded my-2 text-blue-700 text-sm">🖼️ Image: $1</div>');
    
    // Format bullet points
    text = text.replace(/^•\s*/gm, '<span class="inline-block w-4">•</span>');
    
    // Format numbered lists
    text = text.replace(/^(\d+)\.\s*/gm, '<span class="inline-block w-6 font-medium">$1.</span>');
    
    // Handle subsections
    text = text.replace(/^(\d+\.\d+)\s+(.+)$/gm, '<div class="mt-4 mb-2"><strong>$1 $2</strong></div>');
    
    // Format NDC numbers
    text = text.replace(/NDC\s+([\d-]+)/g, '<span class="font-mono text-sm bg-gray-100 px-1 rounded">NDC $1</span>');
    
    // Format dosage amounts
    text = text.replace(/(\d+\s*mg)/gi, '<span class="font-semibold">$1</span>');
    
    return text;
}

// Helper function to get current label ID from the modal
function getCurrentLabelId() {
    // Extract from the download button or from a data attribute
    const downloadBtn = document.querySelector('[onclick*="downloadLabel"]');
    if (downloadBtn) {
        const match = downloadBtn.getAttribute('onclick').match(/downloadLabel\('([^']+)'\)/);
        if (match) return match[1];
    }
    return null;
}

// Helper function to escape HTML for display
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Function to copy raw XML to clipboard
function copyRawXML() {
    const xmlContent = document.querySelector('.bg-gray-900 pre').textContent;
    navigator.clipboard.writeText(xmlContent).then(() => {
        // Show a temporary success message
        const btn = document.querySelector('[onclick="copyRawXML()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-600');
        }, 2000);
    });
}
// Function to scroll to a specific section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Highlight the section briefly
        element.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
        }, 2000);
    }
}


// Function to export label data
function exportLabelData(labelId) {
    // Implementation for exporting label data as JSON or CSV
    fetch(`${API_BASE}/label-content/${labelId}`)
        .then(response => response.json())
        .then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `label-${labelId}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
}

// Function to retry loading label
async function retryLoadLabel(labelId) {
    await viewFullLabel(labelId);
    document.getElementById('labelViewModal').remove();
}

function handleUpload(event) {
    // Prevent any default action
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Close the regular upload modal
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.classList.add('hidden');
    }
    
    // Open the enhanced upload modal
    openEnhancedUploadModal();
    
    return false; // Prevent default
}
        // Handle file upload
        // async function handleUpload() {
        //     const file = document.getElementById('uploadFile').files[0];
        //     const name = document.getElementById('uploadName').value || file?.name || 'Uploaded Label';
            
        //     if (!file) {
        //         alert('Please select a file');
        //         return;
        //     }
            
        //     const formData = new FormData();
        //     formData.append('file', file);
        //     formData.append('name', name);
            
        //     try {
        //         const response = await fetch(`${API_BASE}/upload-label`, {
        //             method: 'POST',
        //             body: formData
        //         });
                
        //         const result = await response.json();
                
        //         if (result.success) {
        //             state.uploadedLabels.push({
        //                 name: name,
        //                 content: result.content,
        //                 id: result.id
        //             });
                    
        //             populateCompareOptions();
        //             document.getElementById('uploadModal').classList.add('hidden');
        //             alert('Label uploaded successfully!');
        //         }
        //     } catch (error) {
        //         console.error('Upload error:', error);
        //         alert('Error uploading file');
        //     }
        // }

        // Download label
        function downloadLabel(labelId) {
            window.open(`${API_BASE}/download-label/${labelId}`, '_blank');
        }

        // Update chart
        function updateChart() {
            const ctx = document.getElementById('changesChart');
            if (!ctx) return;

            const changeData = {
                safety: 0,
                efficacy: 0,
                indication: 0,
                dosage: 0,
                other: 0
            };

            state.timeline.forEach(event => {
                if (event.changes) {
                    event.changes.forEach(change => {
                        changeData[change.type] = (changeData[change.type] || 0) + 1;
                    });
                }
            });

            if (state.chart) {
                state.chart.destroy();
            }

            state.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Safety', 'Efficacy', 'Indication', 'Dosage', 'Other'],
                    datasets: [{
                        data: Object.values(changeData),
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.8)',
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(147, 51, 234, 0.8)',
                            'rgba(251, 191, 36, 0.8)',
                            'rgba(156, 163, 175, 0.8)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} changes (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Switch tab
        function switchLabelTab(tabName) {
            document.querySelectorAll('.Labeltab-btn').forEach(btn => {
                btn.classList.remove('tab-active');
            });
            document.getElementById('Labeltab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('tab-active');
            
            document.querySelectorAll('.Labeltab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById('content' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.remove('hidden');
        }

        // Modal close functions
        function closeApplicationModal() {
            document.getElementById('applicationModal').classList.add('hidden');
        }

        function closeCompanyModal() {
            document.getElementById('companyModal').classList.add('hidden');
        }

        // Show/hide loading
        // function showLoading(show) {
        //     document.getElementById('loadingState').classList.toggle('hidden', !show);
        //     document.getElementById('mainContent').classList.toggle('hidden', show);
        //     document.getElementById('noResults').classList.add('hidden');
        // }

        const loadingStyles = `
<style>
    /* Optimized animations for the scanner loader */
    @keyframes smoothRotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideRight {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
    }
    
    @keyframes fadeInOut {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
    }
    
    .rotate-smooth {
        animation: smoothRotate 8s linear infinite;
        will-change: transform;
    }
    
    .slide-scanner {
        animation: slideRight 3s ease-in-out infinite;
        will-change: transform;
    }
    
    .scanner-line {
        background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(99, 102, 241, 0.6) 50%, 
            transparent 100%);
        width: 2px;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
    }
    
    /* Ensure the loading state covers the screen properly */
    #loadingState {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    #loadingState.hidden {
        display: none !important;
    }
</style>
`;

// Add styles to the document if they don't exist
function ensureLoadingStyles() {
    if (!document.getElementById('loadingAnimationStyles')) {
        const styleElement = document.createElement('div');
        styleElement.id = 'loadingAnimationStyles';
        styleElement.innerHTML = loadingStyles;
        document.head.appendChild(styleElement.firstElementChild);
    }
}

// Array of rotating field names
const loadingFieldNames = [
    'Active Ingredients',
    'Dosage Information',
    'Warning Labels',
    'Drug Interactions',
    'Side Effects',
    'Storage Instructions',
    'Manufacturing Details',
    'Clinical Data',
    'Contraindications',
    'FDA Compliance'
];

let fieldRotationInterval = null;
let currentFieldIndex = 0;

// Function to rotate the loading field text
function startFieldRotation() {
    const fieldElement = document.getElementById('loadingField');
    if (!fieldElement) return;
    
    // Clear any existing interval
    if (fieldRotationInterval) {
        clearInterval(fieldRotationInterval);
    }
    
    // Start rotation
    fieldRotationInterval = setInterval(() => {
        if (fieldElement) {
            currentFieldIndex = (currentFieldIndex + 1) % loadingFieldNames.length;
            fieldElement.style.transition = 'opacity 0.3s';
            fieldElement.style.opacity = '0';
            
            setTimeout(() => {
                fieldElement.textContent = loadingFieldNames[currentFieldIndex];
                fieldElement.style.opacity = '1';
            }, 300);
        } else {
            // Element no longer exists, clear interval
            clearInterval(fieldRotationInterval);
            fieldRotationInterval = null;
        }
    }, 2000);
}

// Function to stop field rotation
function stopFieldRotation() {
    if (fieldRotationInterval) {
        clearInterval(fieldRotationInterval);
        fieldRotationInterval = null;
    }
}

// Enhanced showLoading function
function showLabelLoading(show, customMessage = null) {
    const loadingState = document.getElementById('LabelLoadingState');
    const mainContent = document.getElementById('mainContentDONTHSFUOHFUSF');
    const noResults = document.getElementById('noResults');
    
    if (!loadingState) {
        console.error('Loading state element not found');
        return;
    }
    
    // Ensure styles are loaded
    ensureLoadingStyles();
    
    if (show) {
        // Show loading state
        loadingState.classList.remove('hidden');
        
        // Hide other content
        if (mainContent) {
            mainContent.classList.add('hidden');
        }
        if (noResults) {
            noResults.classList.add('hidden');
        }
        
        // Update custom message if provided
        if (customMessage) {
            const titleElement = loadingState.querySelector('h4.font-semibold.text-gray-800');
            if (titleElement) {
                titleElement.textContent = customMessage;
            }
        }
        
        // Start the field rotation animation
        startFieldRotation();
        
        // Log for debugging
        console.log('Loading state shown');
        
    } else {
        // Hide loading state
        loadingState.classList.add('hidden');
        
        // Show main content
        if (mainContent) {
            mainContent.classList.remove('hidden');
        }
        
        // Stop the field rotation animation
        stopFieldRotation();
        
        // Log for debugging
        console.log('Loading state hidden');
    }
}

// Additional helper functions for different loading scenarios
function showLoadingWithProgress(show, progress = 0, message = 'Loading Label Data') {
    showLabelLoading(show, message);
    
    if (show && progress > 0) {
        // You can add a progress bar to your loader if needed
        const progressBar = document.querySelector('#loadingState .progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
}

// Function to show quick loading (for fast operations)
function showQuickLoading(duration = 1000, message = 'Processing...') {
    showLabelLoading(true, message);
    setTimeout(() => {
        showLabelLoading(false);
    }, duration);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ensureLoadingStyles();
    });
} else {
    ensureLoadingStyles();
}




        // Show no results
        function showNoResults() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('noResults').classList.remove('hidden');
        }

        // Format date
        function formatDate(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        }

        // Update last sync
        // function updateLastSync() {
        //     const now = new Date();
        //     document.getElementById('lastSync').textContent = now.toLocaleTimeString('en-US', {
        //         hour: '2-digit',
        //         minute: '2-digit'
        //     });
        // }

        // Loader CSS
        const styleLABELLOADER = document.createElement('style');
        styleLABELLOADER.textContent = `
            .loader {
                border: 4px solid rgba(59, 130, 246, 0.1);
                border-left-color: #3b82f6;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }

                 .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
    
    /* Loader animation */
    .loader {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Section highlight animation */
    .ring-2 {
        box-shadow: 0 0 0 2px currentColor;
    }
    
    .ring-offset-2 {
        box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
    }
    
    /* Smooth transitions */
    * {
        transition: all 0.2s ease;
    }

        /* Enhanced gradient and glass effects */
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .glass-effect {
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        /* Timeline styles */
        .timeline-container {
            position: relative;
            overflow-x: auto;
            overflow-y: hidden;
        }
        .timeline-track {
            height: 2px;
            background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
        }
        .timeline-node {
            position: absolute;
            transform: translateX(-50%);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .timeline-node:hover {
            transform: translateX(-50%) scale(1.2);
            z-index: 10;
        }
        .timeline-card {
            position: absolute;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            padding: 12px;
            min-width: 200px;
            transform: translateX(-50%);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s ease;
        }
        .timeline-node:hover .timeline-card {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(-50%) translateY(-10px);
        }
        
        /* Comparison viewer styles */
        .label-compare-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            height: 70vh;
        }
        .label-panel {
            overflow-y: auto;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            position: relative;
        }
        .diff-highlight {
            animation: highlight 2s ease;
        }
        @keyframes highlight {
            0% { background: rgba(251, 191, 36, 0.5); }
            100% { background: rgba(251, 191, 36, 0.1); }
        }
        .diff-added {
            background: linear-gradient(90deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 100%);
            border-left: 4px solid #22c55e;
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 4px;
        }
        .diff-removed {
            background: linear-gradient(90deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.1) 100%);
            border-left: 4px solid #ef4444;
            padding: 8px 12px;
            margin: 4px 0;
            text-decoration: line-through;
            opacity: 0.7;
            border-radius: 4px;
        }
        .diff-modified {
            background: linear-gradient(90deg, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.1) 100%);
            border-left: 4px solid #fbbf24;
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 4px;
        }
        
        /* Note annotation styles */
        .note-marker {
            display: inline-block;
            width: 20px;
            height: 20px;
            background: #fbbf24;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 20px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 5px;
        }
        .note-tooltip {
            position: absolute;
            background: white;
            border: 2px solid #fbbf24;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            max-width: 300px;
        }
        
        /* Company analysis styles */
        .company-metric {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
            border-radius: 12px;
            padding: 16px;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .product-timeline {
            position: relative;
            padding-left: 30px;
        }
        .product-timeline::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
        }
        .product-event {
            position: relative;
            margin-bottom: 20px;
        }
        .product-event::before {
            content: '';
            position: absolute;
            left: -24px;
            top: 8px;
            width: 12px;
            height: 12px;
            background: white;
            border: 3px solid #3b82f6;
            border-radius: 50%;
        }
        
        /* Enhanced scrollbars */
        .custom-scrollbar::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
            border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #2563eb 0%, #7c3aed 100%);
        }
        
        /* Loading animations */
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        /* Modal enhancements */
        .modal-backdrop {
            backdrop-filter: blur(5px);
            background: rgba(0, 0, 0, 0.5);
        }
        .modal-content {
            max-height: 90vh;
            overflow-y: auto;
        }
        
        /* Tab animations */
        .tab-active {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }
        
        /* Hover effects */
        .hover-lift {
            transition: all 0.3s ease;
        }
        .hover-lift:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        
        /* Change type badges */
        .change-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .change-safety { background: #fee2e2; color: #dc2626; }
        .change-efficacy { background: #dbeafe; color: #2563eb; }
        .change-indication { background: #f3e8ff; color: #9333ea; }
        .change-dosage { background: #fef3c7; color: #d97706; }
        .change-warning { background: #fee2e2; color: #dc2626; }


        @keyframes slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slide-out {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
.animate-slide-in { animation: slide-in 0.3s ease-out; }
.animate-slide-out { animation: slide-out 0.3s ease-out; }
.loader {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}


        `;
        document.head.appendChild(styleLABELLOADER);


        window.quickSearch = quickSearch;
        window.closeApplicationModal = closeApplicationModal