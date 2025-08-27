document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileName = document.getElementById("file-name");
  const form = document.getElementById("contact-form");
  const groupNameInput = document.getElementById("group-name");
  const submitBtn = document.getElementById("submit-btn");
  const statusAlert = document.getElementById("status-alert");
  const phoneColumnSelector = document.getElementById("phone-column-selector");
  const firstNameColumnSelector = document.getElementById("first-name-column-selector");
  const lastNameColumnSelector = document.getElementById("last-name-column-selector");
  const emailColumnSelector = document.getElementById("email-column-selector");
  const countryCodeSelector = document.getElementById("country-code");
  const advancedToggle = document.getElementById("advanced-toggle");
  const advancedOptions = document.getElementById("advanced-options");
  const rangeOptions = document.getElementById("range-options");
  const batchOptions = document.getElementById("batch-options");
  const batchTypeRadios = document.getElementsByName("batch-type");
  const namingStrategyRadios = document.getElementsByName("naming-strategy");
  const rangeStart = document.getElementById("range-start");
  const rangeEnd = document.getElementById("range-end");
  const batchSize = document.getElementById("batch-size");
  const dataPreview = document.getElementById("data-preview");
  const totalRowsSpan = document.getElementById("total-rows");
  const validPhonesSpan = document.getElementById("valid-phones");
  const previewList = document.getElementById("preview-list");

  let currentData = null;

  if (
    !dropZone ||
    !fileInput ||
    !fileName ||
    !form ||
    !groupNameInput ||
    !submitBtn ||
    !statusAlert ||
    !phoneColumnSelector ||
    !advancedToggle ||
    !advancedOptions ||
    !rangeOptions ||
    !batchOptions ||
    !rangeStart ||
    !rangeEnd ||
    !batchSize
  ) {
    console.error("Required DOM elements not found");
    return;
  }

  function populateColumnSelector(headers) {
    try {
      if (!Array.isArray(headers)) {
        throw new Error("Invalid headers format");
      }

      const selectors = [
        phoneColumnSelector,
        firstNameColumnSelector, 
        lastNameColumnSelector,
        emailColumnSelector
      ];

      const placeholders = [
        "Select Phone Number Column",
        "Select First Name Column (Optional)",
        "Select Last Name Column (Optional)", 
        "Select Email Column (Optional)"
      ];

      selectors.forEach((selector, selectorIndex) => {
        if (selector) {
          selector.innerHTML = `<option value="">${placeholders[selectorIndex]}</option>`;
          
          for (let i = 0; i < Math.min(headers.length, 26); i++) {
            const option = document.createElement("option");
            option.value = i;
            const columnLetter = String.fromCharCode(65 + i);
            const header = headers[i] ? ` (${headers[i]})` : "";
            option.textContent = `Column ${columnLetter}${header}`;
            selector.appendChild(option);
          }
        }
      });
    } catch (error) {
      console.error("Error populating column selector:", error);
      showStatus(
        "error",
        `Error setting up column selection options: ${error.message}`,
      );
    }
  }

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("active");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("active");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("active");
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });

  advancedToggle.addEventListener("click", () => {
    advancedOptions.classList.toggle("hidden");
  });

  batchTypeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      try {
        rangeOptions.classList.add("hidden");
        batchOptions.classList.add("hidden");

        if (e.target.value === "range") {
          rangeOptions.classList.remove("hidden");
        } else if (e.target.value === "batch") {
          batchOptions.classList.remove("hidden");
        }
      } catch (error) {
        console.error("Error handling batch type change:", error);
      }
    });
  });

  async function handleFile(file) {
    try {
      if (!file) {
        showStatus("error", "No file selected.");
        return;
      }

      const validExtensions = [".xlsx", ".xls", ".csv"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );

      if (!hasValidExtension) {
        showStatus("error", "Please select a valid Excel or CSV file.");
        return;
      }

      fileName.textContent = `Selected file: ${file.name}`;

      let headers, rawData;
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        if (!text.trim()) {
          throw new Error("File is empty");
        }
        const lines = text.split(/[\r\n]+/).filter((line) => line.trim());
        if (lines.length === 0) {
          throw new Error("File contains no valid data");
        }
        headers = lines[0].split(",").map((h) => h.trim());
        rawData = lines.slice(1).map(line => line.split(",").map(cell => cell.trim()));
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        if (!workbook.SheetNames.length) {
          throw new Error("Excel file contains no sheets");
        }
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        headers = allRows[0] || [];
        rawData = allRows.slice(1);
      }

      if (headers.length === 0) {
        throw new Error("No headers found in file");
      }

      currentData = rawData;
      populateColumnSelector(headers);
      
      // Add event listeners for preview updates
      [phoneColumnSelector, firstNameColumnSelector, lastNameColumnSelector, emailColumnSelector].forEach(selector => {
        if (selector) {
          selector.addEventListener('change', updateDataPreview);
        }
      });
      
      // Add naming strategy listeners
      namingStrategyRadios.forEach(radio => {
        radio.addEventListener('change', updateDataPreview);
      });
      
      groupNameInput.addEventListener('input', updateDataPreview);
      
      updateDataPreview();
    } catch (error) {
      console.error("File processing error:", error);
      showStatus(
        "error",
        `Error reading file: ${error.message || "Unknown error occurred"}`,
      );
    }
  }

  function validatePhoneNumber(number) {
    if (!number) return false;
    try {
      const cleaned = number.toString().replace(/\D/g, "");
      return cleaned.length >= 10 && /^\d+$/.test(cleaned);
    } catch (error) {
      console.error("Phone validation error:", error);
      return false;
    }
  }

  function updateDataPreview() {
    if (!currentData || !dataPreview) return;

    const phoneColumn = phoneColumnSelector.value;
    if (!phoneColumn) {
      dataPreview.classList.add('hidden');
      return;
    }

    const phoneColumnIndex = parseInt(phoneColumn);
    const firstNameColumnIndex = firstNameColumnSelector.value ? parseInt(firstNameColumnSelector.value) : null;
    const lastNameColumnIndex = lastNameColumnSelector.value ? parseInt(lastNameColumnSelector.value) : null;
    const emailColumnIndex = emailColumnSelector.value ? parseInt(emailColumnSelector.value) : null;
    
    // Get selected naming strategy
    const namingStrategy = document.querySelector('input[name="naming-strategy"]:checked')?.value || 'use-columns';

    let validPhones = 0;
    const sampleContacts = [];

    currentData.forEach((row, index) => {
      if (Array.isArray(row) && row.length > phoneColumnIndex) {
        const phone = row[phoneColumnIndex];
        if (validatePhoneNumber(phone)) {
          validPhones++;
          
          if (sampleContacts.length < 5) {
            let firstName = '';
            let lastName = '';
            let displayName = '';
            // Always use a 3-digit sequence for numbering (e.g., 001, 042, 999)
            const paddedIndex = String(index + 1).padStart(3, '0');
            
            if (namingStrategy === 'sequential') {
              // Use sequential numbering with group name
              const groupName = groupNameInput.value.trim() || 'Contact';
              const sanitizedGroupName = groupName.replace(/[<>:"\/\\|?*]/g, "_");
              firstName = `${sanitizedGroupName}_${paddedIndex}`;
              lastName = '';
              displayName = firstName;
            } else if (namingStrategy === 'mixed') {
              // Mixed: Group name + number as first name, column data as last name
              const groupName = groupNameInput.value.trim() || 'Contact';
              const sanitizedGroupName = groupName.replace(/[<>:"\/\\|?*]/g, "_");
              firstName = `${sanitizedGroupName}_${paddedIndex}`;
              lastName = lastNameColumnIndex !== null ? (row[lastNameColumnIndex] || '').toString().trim() : '';
              displayName = lastName ? `${firstName} ${lastName}` : firstName;
            } else {
              // Use column data
              firstName = firstNameColumnIndex !== null ? (row[firstNameColumnIndex] || '').toString().trim() : '';
              lastName = lastNameColumnIndex !== null ? (row[lastNameColumnIndex] || '').toString().trim() : '';
              
              if (firstName || lastName) {
                displayName = `${firstName} ${lastName}`.trim();
              } else {
                const groupName = groupNameInput.value.trim() || 'Contact';
                const sanitizedGroupName = groupName.replace(/[<>:"\/\\|?*]/g, "_");
                displayName = `${sanitizedGroupName}_${paddedIndex}`;
              }
            }
            
            const email = emailColumnIndex !== null ? row[emailColumnIndex] || '' : '';
            
            sampleContacts.push({
              phone: phone,
              firstName: firstName,
              lastName: lastName,
              email: email,
              displayName: displayName,
              index: index + 1
            });
          }
        }
      }
    });

    totalRowsSpan.textContent = currentData.length;
    validPhonesSpan.textContent = validPhones;

    previewList.innerHTML = '';
    sampleContacts.forEach(contact => {
      const div = document.createElement('div');
      div.className = 'preview-contact';
      
      div.innerHTML = `
        <div class="contact-name">${contact.displayName}</div>
        <div class="contact-phone">${contact.phone}</div>
        ${contact.email ? `<div class="contact-email">${contact.email}</div>` : ''}
      `;
      previewList.appendChild(div);
    });

    dataPreview.classList.remove('hidden');
  }

  function createVcfContacts(contactsData, startIndex = 0) {
    if (!Array.isArray(contactsData) || contactsData.length === 0) {
      throw new Error("No valid contact data provided");
    }

    let vcf = "";
    let validContacts = 0;
    const groupName = groupNameInput.value.trim();
    const countryCode = countryCodeSelector.value;
    const namingStrategy = document.querySelector('input[name="naming-strategy"]:checked')?.value || 'use-columns';

    if (!groupName) {
      throw new Error("Group name is required");
    }

    contactsData.forEach((contact, index) => {
      if (validatePhoneNumber(contact.phone)) {
        try {
          const contactIndex = startIndex + index + 1;
          // Always use a 3-digit sequence for numbering (e.g., 001, 042, 999)
          const paddedIndex = String(contactIndex).padStart(3, '0');
          const sanitizedGroupName = groupName.replace(/[<>:"\/\\|?*]/g, "_");
          
          // Determine contact name based on naming strategy
          let displayName = '';
          let lastName = '';
          let firstName = '';
          
          if (namingStrategy === 'sequential') {
            // Sequential numbering: GroupName_1, GroupName_2, etc.
            firstName = `${sanitizedGroupName}_${paddedIndex}`;
            lastName = '';
            displayName = firstName;
          } else if (namingStrategy === 'mixed') {
            // Mixed: Group name + number as first name, column data as last name
            firstName = `${sanitizedGroupName}_${paddedIndex}`;
            lastName = contact.lastName || '';
            displayName = lastName ? `${firstName} ${lastName}` : firstName;
          } else {
            // Use column data if available
            if (contact.firstName || contact.lastName) {
              firstName = contact.firstName || '';
              lastName = contact.lastName || '';
              displayName = `${firstName} ${lastName}`.trim();
            } else {
              // Fallback to sequential if no column data
              firstName = `${sanitizedGroupName}_${paddedIndex}`;
              lastName = '';
              displayName = firstName;
            }
          }

          // Format phone number
          let formattedPhone = contact.phone.toString().replace(/\D/g, "");
          if (countryCode && !formattedPhone.startsWith(countryCode.replace('+', ''))) {
            formattedPhone = countryCode + formattedPhone;
          }

          vcf += "BEGIN:VCARD\n";
          vcf += "VERSION:3.0\n";
          vcf += `N:${lastName};${firstName};;;\n`;
          vcf += `FN:${displayName}\n`;
          vcf += `TEL;TYPE=CELL:${formattedPhone}\n`;
          
          if (contact.email && contact.email.trim()) {
            vcf += `EMAIL:${contact.email.trim()}\n`;
          }
          
          vcf += `X-WhatsApp-Group:${sanitizedGroupName}\n`;
          vcf += "END:VCARD\n\n";
          validContacts++;
        } catch (error) {
          console.error("Error creating VCF entry:", error);
        }
      }
    });

    if (validContacts === 0) {
      throw new Error("No valid phone numbers found");
    }

    const strategyText = namingStrategy === 'sequential' 
      ? 'with sequential numbering' 
      : namingStrategy === 'mixed'
      ? 'with mixed naming (group + sequential first names, column last names)'
      : 'using column data';
    showStatus(
      "success",
      `Successfully created VCF with ${validContacts} contacts ${strategyText} out of ${contactsData.length} total records.`,
    );
    return vcf;
  }

  function showStatus(type, message) {
    try {
      if (!statusAlert) {
        console.error("Status alert element not found");
        return;
      }
      statusAlert.className = `alert ${type}`;
      statusAlert.textContent = message;
      statusAlert.classList.remove("hidden");
    } catch (error) {
      console.error("Error showing status:", error);
    }
  }

  function setTimedLinkColor() {
    try {
      const hour = new Date().getHours();
      const color = hour >= 6 && hour < 18 ? "#FFC799" : "#99FFE4";
      document.documentElement.style.setProperty("--time-based-color", color);
    } catch (error) {
      console.error("Error setting timed link color:", error);
    }
  }

  setTimedLinkColor();
  setInterval(setTimedLinkColor, 60000);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      if (!fileInput.files[0]) {
        showStatus("error", "Please select an Excel or CSV file.");
        return;
      }

      if (!phoneColumnSelector.value) {
        showStatus(
          "error",
          "Please select the column containing phone numbers.",
        );
        return;
      }

      if (!groupNameInput.value.trim()) {
        showStatus("error", "Please enter a group name.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="button-content">Processing...</span>';

      const file = fileInput.files[0];
      const phoneColumnIndex = parseInt(phoneColumnSelector.value);
      const firstNameColumnIndex = firstNameColumnSelector.value ? parseInt(firstNameColumnSelector.value) : null;
      const lastNameColumnIndex = lastNameColumnSelector.value ? parseInt(lastNameColumnSelector.value) : null;
      const emailColumnIndex = emailColumnSelector.value ? parseInt(emailColumnSelector.value) : null;
      
      let rawData = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const rows = text
          .split(/[\r\n]+/)
          .filter((row) => row.trim())
          .map((row) => row.split(",").map(cell => cell.trim()));
        rawData = rows.slice(1); // Skip header
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        rawData = allRows.slice(1); // Skip header
      }

      // Transform raw data into contact objects
      const contactsData = rawData
        .filter((row) => Array.isArray(row) && row.length > phoneColumnIndex)
        .map((row) => {
          const contact = {
            phone: row[phoneColumnIndex],
            firstName: firstNameColumnIndex !== null ? (row[firstNameColumnIndex] || '').toString().trim() : '',
            lastName: lastNameColumnIndex !== null ? (row[lastNameColumnIndex] || '').toString().trim() : '',
            email: emailColumnIndex !== null ? (row[emailColumnIndex] || '').toString().trim() : ''
          };
          return contact;
        })
        .filter((contact) => contact.phone !== undefined && contact.phone !== null && contact.phone !== "");

      if (contactsData.length === 0) {
        throw new Error("No valid data found in selected columns");
      }

      const batchType = document.querySelector(
        'input[name="batch-type"]:checked',
      )?.value;
      if (!batchType) {
        throw new Error("Please select a batch type");
      }

      if (batchType === "single") {
        const vcfContent = createVcfContacts(contactsData);
        const blob = new Blob([vcfContent], {
          type: "text/vcard;charset=utf-8",
        });
        saveAs(blob, `${groupNameInput.value}_contacts.vcf`);
      } else if (batchType === "range") {
        const start = parseInt(rangeStart.value) - 1;
        const end = parseInt(rangeEnd.value);

        if (
          isNaN(start) ||
          isNaN(end) ||
          start < 0 ||
          end <= start ||
          end > contactsData.length
        ) {
          throw new Error("Invalid range values");
        }

        const rangeContacts = contactsData.slice(start, end);
        const vcfContent = createVcfContacts(rangeContacts, start);
        const blob = new Blob([vcfContent], {
          type: "text/vcard;charset=utf-8",
        });
        saveAs(
          blob,
          `${groupNameInput.value}_${start + 1}-${end}_contacts.vcf`,
        );
      } else if (batchType === "batch") {
        const size = parseInt(batchSize.value);
        if (isNaN(size) || size <= 0 || size > contactsData.length) {
          throw new Error("Invalid batch size");
        }

        const zip = new JSZip();

        for (let i = 0; i < contactsData.length; i += size) {
          const batch = contactsData.slice(i, i + size);
          const vcfContent = createVcfContacts(batch, i);
          const batchNum = Math.floor(i / size) + 1;
          zip.file(
            `${groupNameInput.value}_batch${batchNum}_contacts.vcf`,
            vcfContent,
          );
        }

        const zipContent = await zip.generateAsync({ type: "blob" });
        saveAs(zipContent, `${groupNameInput.value}_contacts.zip`);
      }
    } catch (error) {
      console.error("Processing error:", error);
      showStatus(
        "error",
        error.message ||
          "Error processing file. Please check your inputs and try again.",
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<span class="button-content"><span class="icon">📤</span> Generate VCF</span>';
    }
  });
});
