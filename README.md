# Certificate Maker

Certificate Maker is an experimental tool for turning HTML templates into PDF
files. It pulls data from a CSV or Google Sheet, updates the data source with
references to the generated PDF files, and optionally uploads the PDF files to
Google Drive.

## Getting Started

If things are setup properly, you should be able to run the following command
with no errors:

```./index.js --csv_file docs/example.csv --no-upload```

Once things are running, you can experiment with creating templates, and
adjusting configuration files!

### Installation on Mac OS X

1. Clone the repository into your local environment: `git clone
   https://github.com/google/certificate-maker.git`
2. Go into the repository directory: `cd certificate-maker`
3. Install [Homebrew](https://brew.sh/).
4. Install wget: `brew install wget`
5. Install fontconfig: `brew install fontconfig`
6. Install Node.js: `brew install node`
6. Install yarn: `brew install yarn`
7. Run the pre-setup script: `./setup/pre.sh`
8. Run the Mac OS X setup script: `./setup/mac.sh`
9. Run the post-setup script: `./setup/post.sh` 

### Installation on Ubuntu

1. Clone the repository into your local environment: `git clone
   https://github.com/google/certificate-maker.git`
2. Go into the repository directory: `cd certificate-maker`
3. Run the pre-setup script: `./setup/pre.sh`
4. Run the Mac OS X setup script: `./setup/ubuntu.sh`
5. Run the post-setup script: `./setup/post.sh` 

### Connecting to Google Drive and Google Sheets

You'll need to authenticate with Google Drive in order to upload files or read
data from Google Sheets:

1. Create a new Google Cloud Platform project.
2. Enable the Google Drive API and Google Sheets API.
3. Create OAuth Client credentials, download and save as
   ./config/auth/credentials.json
4. Next time you run Certificate Maker in a way that requires use of the Google
   APIs, you'll be prompted to authenticate.

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
