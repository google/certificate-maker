# Certificate Maker

Certificate Maker is an experimental tool for turning HTML templates into PDF
files. It pulls data from a CSV or Google Sheet, updates the data source with
references to the generated PDF files, and optionally uploads the PDF files to
Google Drive.

## Getting Started

This assumes you already have [yarn](https://yarnpkg.com/lang/en/docs/install/)
installed.

1. Clone the repository in your local environment.
2. Run the setup scripts: first pre.sh, then mac.sh or ubuntu.sh depending on
   your operating system, and then post.sh.
3. Update the configuration file.
4. Create a template.
5. Invoke the index.js file!

## Creating a New Template

Templates live in ./certificates/templates/, and each set of templates that
shares a given configuration (eg. same data source, same target upload
directory, etc) should be grouped into its own subdirectory with a
settings.yaml file.

For example, a file and folder layout for a group of templates might look
like this:

* ./certificates/templates/example/settings.yaml
* ./certificates/templates/example/main.css
* ./certificates/templates/example/participant.html
* ./certificates/templates/example/winner.html

This example contains two templates, which would be referred to as:

* example/participant
* example/winner

All images, regardless of the template they belong to, should be placed in
./certificates/templates/images/, so that the symbolic link in
./certificates/intermediaries/ can be used to reference them during the
creation of PDF certificates.

## Creating a Data Source

Data sources can be Google Sheets or locally stored CSV files. Every data
source is assumed to begin with a single header row which specifies column
names, followed by the actual data.

Further, every data source should have two special columns: Template and
File. Data in the Template column specifies which template should be used
for a given row. The File column should, initially, contain no data, and
is where Certificate Maker will save a path or URL to the resulting PDF
file for each row.

## Notes

This is not an official Google product.

This is an experimental project - expect plenty of rough edges and bugs, and 
no support.
