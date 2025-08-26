# The-Mass-Contact-Maker(updated version)(by vedant-mathur)
This application is designed to solve a simple problem. You might need to save a bunch of contacts from an excel sheet. This does that.

## Why does this exist?

Registration forms store data in Excel files/CSV files. However, if the people have to be added to, say, a WhatsApp group or some other means of communicational broadcast, it is far too tedious to do so manually. Instead, storing them as VCFs of nearly the same names in a single VCF file and installing them highly simplifies contact saving for the same and sending join requests, and makes it easy to delete them too.
I faced the same problem when I had to perform a similar task so I came up with this.

# Pull Requests Policy
I am open to pull requests, both that may perhaps want to fix certain preexisting features or add new ones.

## Features

- **File Upload**: Drag & drop Excel/CSV file upload
- **Enhanced Column Selection**: 
  - Phone number column (required)
  - First name column (optional)
  - Last name column (optional)  
  - Email column (optional)
- **Flexible Contact Naming**:
  - **Column Data Mode**: Uses actual names from Excel/CSV columns
  - **Sequential Numbering Mode**: Automatically numbers contacts (e.g., ABC_Committee_1, ABC_Committee_2, etc.)
  - **Mixed Mode**: Sequential group names as first names + column data as last names
- **International Phone Support**: Multiple country codes supported (India, USA, UK, etc.)
- **Data Preview**: Real-time preview of contacts with validation statistics
- **Multiple Output Options**:
  - Single VCF file
  - Custom range selection
  - Batch processing with ZIP output
- **Smart Contact Naming**: Uses actual names when available, falls back to group naming
- **Phone Number Validation**: Comprehensive validation for different formats
- **Email Support**: Include email addresses in VCF contacts

## Usage

1. **Upload File**: Upload an Excel (.xlsx/.xls) or CSV file containing contact data
2. **Enter Group Name**: Provide a group name (e.g., "ABC_Committee")
3. **Choose Naming Strategy**: 
   - **Column Data**: Use actual first/last names from your file
   - **Sequential Numbering**: Auto-number contacts (ABC_Committee_1, ABC_Committee_2, etc.)
   - **Mixed Mode**: Group name + numbers as first names, column data as last names
4. **Configure Columns**: 
   - Select the phone number column (required)
   - Optionally select first name, last name, and email columns
5. **Set Country Code**: Choose the appropriate country code for phone numbers
6. **Preview Data**: Review the contact preview and validation statistics
7. **Choose Output Format**: Select single file, range, or batch processing
8. **Generate VCF**: Click "Generate VCF" to download your contacts

### Sequential Numbering Example:
- Group Name: "ABC_Committee"
- Result: Contacts named ABC_Committee_1, ABC_Committee_2, ABC_Committee_3, etc.

### Mixed Mode Example:
- Group Name: "ABC_Committee"
- Last Name Column: Contains "Smith", "Johnson", "Williams"
- Result: 
  - First Name: ABC_Committee_1, Last Name: Smith
  - First Name: ABC_Committee_2, Last Name: Johnson  
  - First Name: ABC_Committee_3, Last Name: Williams

## Requirements

- Modern web browser
- Excel/CSV file with phone numbers
- Phone numbers should be valid and preferably in a standard format

## Tech Stack

- Pure JavaScript
- XLSX.js for Excel processing
- FileSaver.js for file downloads
- JSZip for batch processing

## Demo

[Live Demo](https://vcf.aadit.cc)

## License

MIT License
