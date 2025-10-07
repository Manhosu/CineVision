// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global before hook for all tests
beforeEach(() => {
  // Set viewport for consistent testing
  cy.viewport(1280, 720);

  // Clear localStorage and sessionStorage
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing the test on uncaught exceptions
  // that are expected in the application (like network errors)
  if (err.message.includes('Network Error') ||
      err.message.includes('fetch')) {
    return false;
  }

  // Let other errors fail the test
  return true;
});

// Custom assertions
chai.use(function (chai, utils) {
  chai.Assertion.addMethod('beVisible', function () {
    const obj = this._obj;
    this.assert(
      obj.should('be.visible'),
      'expected #{this} to be visible',
      'expected #{this} to not be visible'
    );
  });
});