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

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

module.exports = class GoogleDrive {
	constructor(config) {
		this.folder_id = config.folder_id;
		this.replace = config.replace;
		this.google_client = config.google_client;

		return this;
	}

	initialize() {
		return new Promise((resolve, reject) => {
			this.drive = google.drive({version: 'v3', auth: this.google_client.oAuth2Client});

			resolve(this);
		});
	}

	uploadFile(file) {
		return new Promise((resolve, reject) => {
			var n = file.lastIndexOf('/');
			var file_name = file.substring(n + 1);

			var metadata = {
				name: file_name,
				parents: [this.folder_id]
			};
			var media = {
				mimeType: 'application/pdf',
				body: fs.createReadStream(file)
			};

			this.drive.files.create({
				resource: metadata,
				media: media,
				fields: 'id'
			}, function(err, result) {
				if (err) {
					console.log(err);
					reject(err)
				} else {
					var url = 'https://docs.google.com/open?id=' + result.data.id;

					resolve(url);
				}
			});
		});
	}
}
