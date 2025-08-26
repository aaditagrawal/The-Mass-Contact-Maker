// Simple test to verify the application loads correctly
console.log("Starting application test...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded");
    
    // Check if all required elements exist
    const elements = [
        'drop-zone',
        'phone-column-selector', 
        'first-name-column-selector',
        'last-name-column-selector',
        'email-column-selector',
        'country-code',
        'group-name',
        'data-preview',
        'total-rows',
        'valid-phones', 
        'preview-list'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✓ Element ${id} found`);
        } else {
            console.error(`✗ Element ${id} NOT found`);
        }
    });
    
    console.log("Application test completed");
});
