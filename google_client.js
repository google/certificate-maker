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

module.exports = class GoogleClient {
  constructor(config) {
    this.credentials_file = config.credentials_file;
    this.token_file = config.token_file;
    this.scopes = config.scopes;

    return this;
  }

  loadCredentials() {
    console.log('load credentials file...');

    return fs.readFileSync(this.credentials_file);
  }

  parseCredentials(credentials) {
    console.log('parse credentials file...');

    credentials = JSON.parse(credentials);
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    this.oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    return this.oAuth2Client;
  }

  loadToken() {
    console.log('load token file...');

    return fs.readFileSync(this.token_file);
  }

  parseToken(token) {
    console.log('parse token file...');

    token = JSON.parse(token);
    this.oAuth2Client.setCredentials(token);

    return this.oAuth2Client;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      var credentials = this.loadCredentials();
      this.oAuth2Client = this.parseCredentials(credentials);

      try {
        var token = this.loadToken();
        this.oAuth2Client = this.parseToken(token);
        resolve(this.oAuth2Client);
      } catch(error) {
        this.getNewToken((result) => {
          resolve(this.oAuth2Client);
        }, (error) => {
          reject(error);
        });
      }
    });
  }

  getNewToken(onSuccess, onError) {
    console.log('get a new token...');

    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      this.oAuth2Client.getToken(code, (err, token) => {
        if (err) return onError('Error retrieving access token', err);
        this.oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(this.token_file, JSON.stringify(token), (err) => {
          if (err) console.error(err);
          console.log('Token stored to', this.token_file);
        });
        onSuccess(this);
      });
    });
  }
}
