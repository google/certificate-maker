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

const csv = require('csv');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const ENUM_DATA_TYPE_CSV = 'csv';
const ENUM_DATA_TYPE_GOOGLE_SHEET = 'google_sheet';

module.exports = class DataSource {
	constructor(config) {
		this.template_header = config.template_header;
		this.file_header = config.file_header;
		this.change = config.change;
		this.csv_file = config.csv_file;
		this.google_client = config.google_client;
		this.google_sheet_id = config.google_sheet_id;
		this.worksheet= config.worksheet;

		if (this.csv_file) {
			this.data_type = ENUM_DATA_TYPE_CSV;
			this.data_source = new DataSourceCsvFile({
				parent: this,
				csv_file: this.csv_file
			});
		} else if (this.google_sheet_id && this.worksheet) {
			this.data_type = ENUM_DATA_TYPE_GOOGLE_SHEET;
			this.data_source = new DataSourceGoogleSheet({
				parent: this,
				google_client: this.google_client,
				google_sheet_id: this.google_sheet_id,
				worksheet: this.worksheet
			});
		} else {
			throw('No data source specified.');
		}

		return this;
	}

	initialize() {
		return new Promise((resolve, reject) => {
			this.load()
			.then(() => this.buildMetadata())
			.then((result) => {
				this.metadata = result;
			})
			.then(() => this.buildLookupTable())
			.then(() => this.loadValues())
			.then((result) => {
				this.value_array = result;
			})
			.then(() => this.buildRecords())
			.catch((error) => reject(error))
			.then(() => resolve(this));
		});
	}

	cleanup() {
		this.data_source.cleanup();
	}

	load() {
		return this.data_source.load();
	}

	buildMetadata() {
		return this.data_source.buildMetadata();
	}

	buildLookupTable() {
		console.log('build lookup table...');

		this.lookup = {
			header: [],
			index: {}
		};

		for (var i = 0; i < this.metadata.headers.length; i++) {
			this.lookup.header.push(this.metadata.headers[i]);
			this.lookup.index[this.metadata.headers[i]] = i;
		}

		this.lookup.template_index = this.lookup.index[this.template_header];
		this.lookup.file_index = this.lookup.index[this.file_header];

		return this.lookup;
	}

	loadValues() {
		return this.data_source.loadValues();
	}

	buildRecords() {
		console.log('build records...');

		this.record_array = [];
		for (var i = 0; i < this.value_array.length; i++) {
			let values = this.value_array[i];
			let record = {};

			for (var j = 0; j < values.length; j++) {
				record[this.lookup.header[j]] = values[j];
			}

			this.record_array.push(record);
		}

		return this;
	}

	saveFileReference(index, file) {
		var object = {};
		object[this.file_header] = file;
		return this.save(index, object);
	}

	save(index, object) {
		// update value_array and record_array
		for (var key in object) {
			if (!object.hasOwnProperty(key)) continue;
			this.record_array[index][key] = object[key];
			this.value_array[index][this.lookup.index[key]] = object[key];
		}

		// save
		return this.data_source.save(index, object);
	}
}

class DataSourceCsvFile {
	constructor(config) {
		this.parent = config.parent;
		this.csv_file = config.csv_file;
	}

	load() {
		return new Promise((resolve, reject) => {
			console.log('load CSV file...');

			this.csv = {
				file: this.csv_file,
				raw: fs.readFileSync(this.csv_file)
			};

			console.log('parse CSV...');
			this.csv.records = csv.parse(this.csv.raw, {
				delimiter: ','
			});

			resolve(this);
		});
	}

	cleanup() {

	}

	buildMetadata() {
		return new Promise((resolve, reject) => {
			console.log('build metadata...');

			this.metadata = {
				columns: this.csv.records.state.expectedRecordLength,
				rows: this.csv.records.info.records,
				headers: this.csv.records.read()
			}

			resolve(this.metadata);
		});
	}

	loadValues() {
		return new Promise((resolve, reject) => {
			console.log('load values...');

			this.csv.value_array = [];
			let record;
			while (record = this.csv.records.read()) {
				this.csv.value_array.push(record);
			}

			resolve(this.csv.value_array);
		});
	}

	save(index, object) {
		var csv_value_array = this.parent.value_array.slice();
		csv_value_array.unshift(this.metadata.headers);

		csv.stringify(
			csv_value_array,
			(err, output) => {
				this.csv.raw = output;
				fs.writeFileSync(this.csv.file, this.csv.raw);
			}
		);
	}
}

class DataSourceGoogleSheet {
	constructor(config) {
		this.parent = config.parent;
		this.google_client = config.google_client;
		this.google_sheet_id = config.google_sheet_id;
		this.worksheet = config.worksheet;
	}

	load() {
		return new Promise((resolve, reject) => {
			console.log('load Google Sheet...');

			this.sheet = {
				auth: this.google_client.oAuth2Client,
				id: this.google_sheet_id,
				worksheet_name: this.worksheet
			};

			this.sheet.client = google.sheets({version: 'v4', auth: this.sheet.auth});
			this.sheet.client.spreadsheets.get({
				spreadsheetId: this.sheet.id
			}, (err, res) => {
				if (err) reject(err);

				console.log('locate the worksheet...');

				for (var i = 0; i < res.data.sheets.length; i++) {
					if (res.data.sheets[i].properties.title == this.sheet.worksheet_name) {
						console.log('found the worksheet!');
						this.sheet.worksheet_index = i;
						this.sheet.worksheet_properties = res.data.sheets[i].properties;
						this.sheet.worksheet_id = this.sheet.worksheet_properties.sheetId;
						break;
					}
				}
				if (!this.sheet.worksheet_id) reject('Could not locate specified worksheet.');

				resolve(this);
			});
		});
	}

	cleanup() {
		
	}

	buildMetadata() {
		return new Promise((resolve, reject) => {
			console.log('build metadata...');

			this.metadata = {
				columns: this.sheet.worksheet_properties.gridProperties.columnCount,
				rows: this.sheet.worksheet_properties.gridProperties.rowCount,
				frozen_rows: this.sheet.worksheet_properties.gridProperties.frozenRowCount
			};

			this.sheet.client.spreadsheets.values.get({
				spreadsheetId: this.sheet.id,
				range: this.sheet.worksheet_name + '!1:1'
			}, (err, res) => {
				if (err) reject(err);
				this.metadata.headers = res.data.values[0];
				resolve(this.metadata);
			});
		});
	}

	loadValues() {
		return new Promise((resolve, reject) => {
			console.log('load values...');

			this.sheet.client.spreadsheets.values.get({
				spreadsheetId: this.sheet.id,
				range: this.sheet.worksheet_name + '!2:' + this.metadata.rows
			}, (err, res) => {
				if (err) reject(err);

				this.sheet.value_array = res.data.values;

				resolve(this.sheet.value_array);
			});
		});
	}

	save(index, object) {
		return new Promise((resolve, reject) => {
			var row = index + 2; // add 1 for header, add 1 more to compensate for 0-index

			var record = new Array(this.metadata.columns);

			// map object values to an array for storing
			for (var key in object) {
				if (!object.hasOwnProperty(key)) continue;
				var column = this.parent.lookup.index[key];
				record[column] = object[key];
			}

			// save!
			this.sheet.client.spreadsheets.values.update({
				spreadsheetId: this.google_sheet_id,
				range: this.sheet.worksheet_name + '!' + 'A' + row + ':' + this.getLetterFromIndex(this.metadata.columns, false) + row,
				valueInputOption: 'RAW',
				resource: {values: [record]}
			}, (err, res) => {
				if (err) reject(err);

				resolve(res);
			});
		});
	}

	getLetterFromIndex(index, zero_index = true) {
		if (zero_index)
			index++;

		var x;
		var letter = '';

		while (index > 0) {
			x = (index - 1) % 26;
			letter = String.fromCharCode(x + 65) + letter;
			index = (index - x - 1) / 26;
		}

		return letter;
	}

	getIndexFromLetter(letter, zero_index = true) {
		var index = 0;
		var length = letter.length;
		for (var i = 0; i < length; i++) {
			index += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
		}

		if (zero_index) 
			index--;

		return index;
	}
}
