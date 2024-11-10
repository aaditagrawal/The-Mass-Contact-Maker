document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileName = document.getElementById("file-name");
  const form = document.getElementById("contact-form");
  const groupNameInput = document.getElementById("group-name");
  const submitBtn = document.getElementById("submit-btn");
  const statusAlert = document.getElementById("status-alert");
  const columnSelector = document.getElementById("column-selector");
  const advancedToggle = document.getElementById("advanced-toggle");
  const advancedOptions = document.getElementById("advanced-options");
  const rangeOptions = document.getElementById("range-options");
  const batchOptions = document.getElementById("batch-options");
  const batchTypeRadios = document.getElementsByName("batch-type");
  const rangeStart = document.getElementById("range-start");
  const rangeEnd = document.getElementById("range-end");
  const batchSize = document.getElementById("batch-size");

  function populateColumnSelector(headers) {
    try {
      columnSelector.innerHTML =
        '<option value="">Select Phone Number Column</option>';
      for (let i = 0; i < 26; i++) {
        const option = document.createElement("option");
        option.value = i;
        const columnLetter = String.fromCharCode(65 + i);
        const header = headers[i] ? ` (${headers[i]})` : "";
        option.textContent = `Column ${columnLetter}${header}`;
        columnSelector.appendChild(option);
      }
    } catch (error) {
      console.error("Error populating column selector:", error);
      showStatus("error", "Error setting up column selection options.");
    }
  }

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("active");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("active");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
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
      rangeOptions.classList.add("hidden");
      batchOptions.classList.add("hidden");

      if (e.target.value === "range") {
        rangeOptions.classList.remove("hidden");
      } else if (e.target.value === "batch") {
        batchOptions.classList.remove("hidden");
      }
    });
  });

  async function handleFile(file) {
    if (!file) {
      showStatus("error", "No file selected.");
      return;
    }

    if (
      !(
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".csv")
      )
    ) {
      showStatus("error", "Please select a valid Excel or CSV file.");
      return;
    }

    fileName.textContent = `Selected file: ${file.name}`;

    try {
      let headers;
      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        if (!text.trim()) {
          throw new Error("File is empty");
        }
        const lines = text.split(/[\r\n]+/).filter((line) => line.trim());
        if (lines.length === 0) {
          throw new Error("File contains no valid data");
        }
        headers = lines[0].split(",").map((h) => h.trim());
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        if (!workbook.SheetNames.length) {
          throw new Error("Excel file contains no sheets");
        }
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data_rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        headers = data_rows[0] || [];
      }

      if (headers.length === 0) {
        throw new Error("No headers found in file");
      }

      populateColumnSelector(headers);
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

  function createVcfContacts(numbers, startIndex = 0) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("No valid numbers provided");
    }

    let vcf = "";
    let validNumbers = 0;
    const groupName = groupNameInput.value.trim();

    if (!groupName) {
      throw new Error("Group name is required");
    }

    numbers.forEach((number, index) => {
      if (validatePhoneNumber(number)) {
        try {
          const contactIndex = startIndex + index + 1;
          vcf += "BEGIN:VCARD\n";
          vcf += "VERSION:3.0\n";
          vcf += `N:${groupName}_${contactIndex};;;\n`;
          vcf += `FN:${groupName}_${contactIndex}\n`;
          vcf += `TEL;TYPE=CELL:+91${number}\n`;
          vcf += `X-WhatsApp-Group:${groupName}\n`;
          vcf += "END:VCARD\n\n";
          validNumbers++;
        } catch (error) {
          console.error("Error creating VCF entry:", error);
        }
      }
    });

    if (validNumbers === 0) {
      throw new Error("No valid phone numbers found");
    }

    showStatus(
      "success",
      `Successfully created VCF with ${validNumbers} contacts out of ${numbers.length} total numbers.`,
    );
    return vcf;
  }

  function showStatus(type, message) {
    try {
      statusAlert.className = `alert ${type}`;
      statusAlert.textContent = message;
      statusAlert.classList.remove("hidden");
    } catch (error) {
      console.error("Error showing status:", error);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      if (!fileInput.files[0]) {
        showStatus("error", "Please select an Excel or CSV file.");
        return;
      }

      if (!columnSelector.value) {
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
      const selectedColumn = parseInt(columnSelector.value);
      let numbers = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const rows = text
          .split(/[\r\n]+/)
          .filter((row) => row.trim())
          .map((row) => row.split(","));
        numbers = rows
          .map((row) => row[selectedColumn]?.trim())
          .filter((num) => num && num !== "");
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        numbers = rows
          .filter((row) => Array.isArray(row) && row.length > selectedColumn)
          .map((row) => row[selectedColumn])
          .filter((num) => num !== undefined && num !== null && num !== "");
      }

      if (numbers.length === 0) {
        throw new Error("No valid data found in selected column");
      }

      const batchType = document.querySelector(
        'input[name="batch-type"]:checked',
      )?.value;
      if (!batchType) {
        throw new Error("Please select a batch type");
      }

      if (batchType === "single") {
        const vcfContent = createVcfContacts(numbers);
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
          end > numbers.length
        ) {
          throw new Error("Invalid range values");
        }

        const rangeNumbers = numbers.slice(start, end);
        const vcfContent = createVcfContacts(rangeNumbers, start);
        const blob = new Blob([vcfContent], {
          type: "text/vcard;charset=utf-8",
        });
        saveAs(
          blob,
          `${groupNameInput.value}_${start + 1}-${end}_contacts.vcf`,
        );
      } else if (batchType === "batch") {
        const size = parseInt(batchSize.value);
        if (isNaN(size) || size <= 0) {
          throw new Error("Invalid batch size");
        }

        const zip = new JSZip();

        for (let i = 0; i < numbers.length; i += size) {
          const batch = numbers.slice(i, i + size);
          const vcfContent = createVcfContacts(batch, i);
          zip.file(
            `${groupNameInput.value}_batch${Math.floor(i / size) + 1}_contacts.vcf`,
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
