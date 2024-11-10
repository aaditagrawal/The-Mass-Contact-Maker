# The-Mass-Contact-Maker
This application is designed to solve a simple problem. You might need to save a bunch of contacts from an excel sheet. This does that.

## Why does this exist?

Registration forms store data in Excel files/CSV files. However, if the people have to be added to, say, a WhatsApp group or some other means of communicational broadcast, it is far too tedious to do so manually. Instead, storing them as VCFs of nearly the same names in a single VCF file and installing them highly simplifies contact saving for the same and sending join requests, and makes it easy to delete them too.
I faced the same problem when I had to perform a similar task so I came up with this.

# Pull Requests Policy
I am open to pull requests, both that may perhaps want to fix certain preexisting features or add new ones.

## Features

- Drag & drop Excel/CSV file upload
- Phone number validation
- Multiple output options:
  - Single VCF file
  - Custom range selection
  - Batch processing with ZIP output
- Group naming support
- Column selection for phone numbers

## Usage

1. Upload an Excel (.xlsx/.xls) or CSV file
2. Enter a group name for your contacts
3. Select the column containing phone numbers
4. Choose output format (single/range/batch)
5. Click "Generate VCF" to download

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
