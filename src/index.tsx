/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { LiveAPIProvider } from './contexts/LiveAPIContext'; // Import the provider

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Retrieve the API key from environment variables
const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("REACT_APP_GEMINI_API_KEY is not defined. Please set it in your .env file.");
}

root.render(
  <React.StrictMode>
    <LiveAPIProvider apiKey={apiKey}> {/* Wrap App with LiveAPIProvider and pass apiKey */}
      <App />
    </LiveAPIProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
