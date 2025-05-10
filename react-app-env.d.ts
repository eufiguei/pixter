/// <reference types="react" />
/// <reference types="react-dom" />

// This ensures React is available globally
import React from 'react';
import ReactDOM from 'react-dom';

declare global {
  const React: typeof React;
  const ReactDOM: typeof ReactDOM;
}
