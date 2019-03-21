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
const he = require('he');
const nunjucks = require('nunjucks');
const readline = require('readline');
const sanitize = require('sanitize-filename');
const YAML = require('yaml');

const FileGenerator = require('./file_generator.js');

var fileGenerator;

module.exports = class TemplateEngine {
	constructor(config) {
		this.template_folder = config.template_folder;
		this.intermediary_folder = config.intermediary_folder;
		this.output_folder = config.output_folder;
		this.default_template = config.default_template;
		this.preserve_intermediary = config.preserve_intermediary;
		this.preserve_output = config.preserve_output;

		this.templates = {};
	}

	initialize() {
		return new Promise((resolve, reject) => {
			console.log('initialize file generator...');

			fileGenerator = new FileGenerator({});
		
			resolve(fileGenerator)
		})
		.then(() => fileGenerator.initialize());
	}

	cleanup() {
		fileGenerator.cleanup();
	}

	createInstance(config) {
		config.parent = this;
		if (!config.template)
			config.template = this.default_template;

		return new TemplateInstance(config);
	}

	getTemplate(template_name) {
		if (!this.templates[template_name])
			this.templates[template_name] = this.loadTemplate(template_name);

		return this.templates[template_name];
	}

	loadTemplate(template_name) {
		console.log('load template...');

		var template = new Template({
			parent: this,
			name: template_name,
			folder: this.template_folder
		});
		template.initialize();

		return template;
	}
}

class Template {
	constructor(config) {
		this.name = config.name;
		this.folder = config.folder;
		this.parent = config.parent;
	}

	initialize() {
		// find the template's folder
		var n = this.name.lastIndexOf('/');
		this.file_slug = this.name.substring(n + 1);
		this.path_slug = this.name.substring(0, n);
		this.path = this.folder + this.name.substring(0, n);
		this.template_file = this.path + '/' + this.file_slug + '.html';
		this.settings_file = this.path + '/settings.yaml';

		// read the settings
		var settings_file = fs.readFileSync(this.settings_file, 'utf8');
		var settings = YAML.parse(settings_file);
		for (var key in settings) {
			if (settings.hasOwnProperty(key)) {
				this[key] = settings[key];
			}
		}

		// create folders
		this.intermediary_folder = this.parent.intermediary_folder + this.path_slug;
		if (!fs.existsSync(__dirname + '/' + this.intermediary_folder)) {
			fs.mkdirSync(this.intermediary_folder, {recursive: true});
		}
		this.output_folder = this.parent.output_folder + this.path_slug;
		if (!fs.existsSync(__dirname + '/' + this.output_folder)) {
			fs.mkdirSync(this.output_folder, {recursive: true});
		}

		console.log('template loaded:');
		console.log(this);

		// read the template itself
		this.template_contents = fs.readFileSync(this.template_file, 'utf8');

		// prepare for templatizing
		this.compiled_file_name = nunjucks.compile(this.file_name);
		this.compiled_template = nunjucks.compile(this.template_contents);
	}

	getContents() {
		return this.template_contents;
	}

	renderContents(record) {
		return this.compiled_template.render(record);
	}

	renderFileName(record) {
		return this.compiled_file_name.render(record);
	}
}

class TemplateInstance {
	constructor(config) {
		this.parent = config.parent;
		this.record = config.record;
		this.template_name = config.template;

		this.render_package = {
			h: this.record,
			header: this.record
		};
		// add other variables directly
		for (var key in this.record) {
			if (!this.record.hasOwnProperty(key)) continue;
			if (this.render_package[key]) continue;
			this.render_package[key] = this.record[key];
		}
	}

	initialize() {
		return new Promise((resolve, reject) => {
			this.template = this.parent.getTemplate(this.template_name);

			this.render_package.s = {
				path: __dirname + '/' + this.parent.template_folder + this.template.path_slug + '/',
				timestamp: (+ new Date())
			};

			resolve(this.template);
		});
	}

	render() {
		return new Promise((resolve, reject) => {
			this.file_contents = this.template.renderContents(this.render_package);
			this.file_name = this.template.renderFileName(this.render_package);

			this.file_name = he.decode(this.file_name);
			this.file_name = sanitize(this.file_name);

			resolve(this);
		});
	}

	createFile() {
		return new Promise((resolve, reject) => {
			this.html_file_name = this.file_name + '.html';
			this.pdf_file_name = this.file_name + '.pdf';

			this.html_file_path = __dirname + '/' + this.template.intermediary_folder + '/' + this.html_file_name;
			this.pdf_file_path = __dirname + '/' + this.template.output_folder + '/' + this.pdf_file_name;

			// save html file
			fs.writeFileSync(this.html_file_path, this.file_contents);

			fileGenerator.load('file://' + this.html_file_path)
			.then(() => {
				var config = {
					path: this.pdf_file_path
				};

				if (this.template.hasOwnProperty('format'))
					config.format = this.template.format;
				if (this.template.hasOwnProperty('landscape'))
					config.landscape = this.template.landscape;

				return config;
			})
			.then((config) => fileGenerator.pdf(config))
			.then((pdf) => {
				this.pdf = pdf;
				resolve(this.pdf_file_path);
			});
		});
	}

	cleanup() {
		if (!this.parent.preserve_intermediary) {
			fs.unlinkSync(this.html_file_path);
		}
		if (!this.parent.preserve_output) {
			fs.unlinkSync(this.pdf_file_path);
		}
	}
}
