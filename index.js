#!/usr/bin/env node
// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const camelCase = require('camelcase');
const commander = require('commander');
const fs = require('fs');
const YAML = require('yaml');
const readline = require('readline');
const {google} = require('googleapis');

const DataSource = require('./data_source.js');
const GoogleClient = require('./google_client.js');
const GoogleDrive = require('./google_drive.js');
const TemplateEngine = require('./template_engine.js');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/spreadsheets.readonly',
				'https://www.googleapis.com/auth/drive',
				'https://www.googleapis.com/auth/drive.file',
				'https://spreadsheets.google.com/feeds'];

var settings = {};
var googleClient;
var googleDrive;
var dataSource;
var templateEngine;

async function processRecords() {
	console.log('iterate over each record...');

	for (let [index, record] of dataSource.record_array.entries()) {
		// see if a file has already been generated
		if (dataSource.lookup.file_index &&
			record[dataSource.file_header]) {
			if (!settings.replace) {
				console.log('skipping record #' + index);
				continue;
			}
		}

		console.log('processing record #' + index);

		// load template from record if available
		var template;
		if (dataSource.lookup.template_index &&
			record[dataSource.template_header]) {
			template = record[dataSource.template_header];
		}

		let instance = templateEngine.createInstance({
			record: record,
			template: template
		});

		// create template instance for this record
		await instance.initialize();
		await instance.render();
		let file = await instance.createFile();

		// upload file
		if (settings.upload)
			file = await googleDrive.uploadFile(file);

		// save reference to file
		if (settings.change)
			dataSource.saveFileReference(index, file);

		await instance.cleanup();
	}
}

async function main() {
	// load settings
	console.log('load settings and command line arguments...');
	settings = configure();
	console.log('settings loaded:');
	console.log(settings);

	// load Google Client if necessary
	if (!settings.csv_file | settings.upload) {
		console.log('initialize OAuth client...');
		googleClient = new GoogleClient({
			credentials_file: settings.credentials_file,
			token_file: settings.token_file,
			scopes: SCOPES
		});
		await googleClient.initialize();
	}

	// load Google Drive if necessary
	if (!settings.csv_file | settings.upload) {
		console.log('initializing drive connection...');
		googleDrive = new GoogleDrive({
			upload: settings.upload,
			replace: settings.replace,
			google_client: googleClient,
			folder_id: settings.google_folder_id
		});
		await googleDrive.initialize();
	}

	// load data source
	console.log('initialize data source...');
	dataSource = new DataSource({
		template_header: settings.template_header,
		file_header: settings.file_header,
		change: settings.change,
		csv_file: settings.csv_file,
		google_client: googleClient,
		google_sheet_id: settings.google_sheet_id,
		worksheet: settings.worksheet
	});
	await dataSource.initialize();
	console.log('data source (' + dataSource.data_type + ') loaded:');
	console.log(dataSource.metadata);

	// load template engine
	console.log('initialize template engine...');
	templateEngine = new TemplateEngine({
		template_folder: settings.template_folder,
		intermediary_folder: settings.intermediary_folder,
		output_folder: settings.output_folder,
		default_template: settings.template,
		preserve_intermediary: settings.preserve_intermediary,
		preserve_output: settings.preserve_output
	});
	await templateEngine.initialize();

	// OK, now actually do some work!
	await processRecords();

	// clean up after ourselves
	await dataSource.cleanup();
	await templateEngine.cleanup();
}

function configure() {
	var defaultSettings = {
		'template_header': 'Template',
		'file_header': 'File',
		'preserve_intermediary': false,
		'preserve_output': true,
		'upload': true,
		'change': true,
		'replace': false,
		'output_folder': 'certificates/results/',
		'google_folder_id': '',
		'intermediary_folder': 'certificates/intermediaries/',
		'template_folder': 'certificates/templates/',
		'config_file': 'config/settings.yaml',
		'credentials_file': 'config/auth/credentials.json',
		'token_file': 'config/auth/token.json',
		'csv_file': '',
		'google_sheet_id': '',
		'worksheet': '',
		'template': ''
	}

	commander.usage('[options] <file ...>')
	  .option('--template_header [value]', 'Label of the column with template information.')
	  .option('--file_header [value]', 'Label of column with reference to resulting files.')
	  .option('--preserve_intermediary', 'Preserve local intermediary files after upload.')
	  .option('--preserve_output', 'Preserve local result files after upload.')
	  .option('--no-upload', 'Don\'t upload files to Google Drive.')
	  .option('--no-change', 'Don\'t update data source with reference to resulting files.')
	  .option('-r, --replace', 'Process all records replacing existing files, rather than skipping.')
	  .option('--output_folder [value]', 'Where to store resulting files.')
	  .option('--intermediary_folder [value]', 'Where to store intermediary files.')
	  .option('--template_folder [value]', 'Where to find template files.')
	  .option('--config_file [value]', 'Location of the settings file.')
	  .option('--credentials_file [value]', 'Location of the credentials file.')
	  .option('--token_file [value]', 'Location of the token file.')
	  .option('-c, --csv_file [value]', 'Location of a CSV to pull data from.')
	  .option('-s, --google_sheet_id [value]', 'ID of a Google Sheet to pull data from.')
	  .option('-w, --worksheet [value]', 'Name of tab in Google Sheet to pull data from.')
	  .option('-d, --google_folder_id [value]', 'ID of a Google Drive Folder to upload files to.')
	  .option('-t, --template [value]', 'Template to use by default.')
	  .parse(process.argv);

	var commandLineSettings = {};
	for (var key in defaultSettings) {
		if (defaultSettings.hasOwnProperty(key) &&
			commander.hasOwnProperty(key)) {
			commandLineSettings[key] = commander[key];
		}
	}

	var settings = Object.assign({}, defaultSettings, commandLineSettings);
	var configFile = fs.readFileSync(settings.config_file, 'utf8');
	var configFileYaml = YAML.parse(configFile);
	var configFileSettings = {};
	for (var key in configFileYaml) {
		if (configFileYaml.hasOwnProperty(key)) {
			configFileSettings[key] = configFileYaml[key];
		}
	}

	settings = Object.assign({}, defaultSettings, configFileSettings, commandLineSettings);
	return settings;
}

main();
