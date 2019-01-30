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
const puppeteer = require('puppeteer');
const readline = require('readline');

module.exports = class FileGenerator {
	constructor(config) {

	}

	initialize() {
		return new Promise((resolve, reject) => {
			puppeteer
				.launch({
					args: ['--no-sandbox', '--disable-setuid-sandbox']
				})
				.then((browser) => {
					this.browser = browser;
					return this.browser;
				})
				.then(() => this.browser.newPage())
				.then((page) => {
					this.page = page;
					return this.page;
				})
				.then(() => resolve(this))
				.catch((error) => reject(error));
		});
	}

	load(value) {
		return this.page.goto(value, {waitUntil: 'networkidle2'});
	}

	cleanup() {
		this.browser.close();
	}

	precapture(config, default_config) {
		config = Object.assign({}, default_config, config);

		if (!config.path) throw('File generator missing path argument.');

		if (config.viewport) {
			this.page.setViewport(config.viewport);
			delete config.viewport;
		}

		return config;
	}

	pdf(config) {
		config = this.precapture(config, {
			printBackground: true
		});
		return this.page.pdf(config);
	}

	screenshot(config) {
		config = this.precapture(config, {});

		return this.page.screenshot(config);
	}
}
