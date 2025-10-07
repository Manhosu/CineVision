/// <reference types="cypress" />

// Custom commands for admin panel testing

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as admin user
       */
      loginAsAdmin(): Chainable<void>;

      /**
       * Login as regular user
       */
      loginAsUser(): Chainable<void>;

      /**
       * Wait for page to be fully loaded
       */
      waitForPageLoad(): Chainable<void>;

      /**
       * Check if element has loading state
       */
      shouldBeLoading(selector: string): Chainable<void>;

      /**
       * Check if element is not loading
       */
      shouldNotBeLoading(selector: string): Chainable<void>;

      /**
       * Fill admin content form
       */
      fillContentForm(data: ContentFormData): Chainable<void>;

      /**
       * Check toast message
       */
      checkToastMessage(message: string, type?: 'success' | 'error' | 'warning'): Chainable<void>;
    }
  }
}

interface ContentFormData {
  title: string;
  description?: string;
  price: string;
  status?: string;
  availability?: string;
  genre?: string;
  director?: string;
}

Cypress.Commands.add('loginAsAdmin', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('admin_token', 'mock-admin-token');
    win.localStorage.setItem('admin_user', JSON.stringify({
      id: 'admin-1',
      email: 'admin@cinevision.com',
      role: 'admin'
    }));
  });
});

Cypress.Commands.add('loginAsUser', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('user_token', 'mock-user-token');
    win.localStorage.setItem('user', JSON.stringify({
      id: 'user-1',
      email: 'user@cinevision.com',
      role: 'user'
    }));
  });
});

Cypress.Commands.add('waitForPageLoad', () => {
  // Wait for the page to be fully loaded
  cy.get('body').should('exist');
  cy.get('[data-testid="loading"]').should('not.exist');
});

Cypress.Commands.add('shouldBeLoading', (selector: string) => {
  cy.get(selector).should('contain', 'Carregando').or('have.class', 'animate-spin');
});

Cypress.Commands.add('shouldNotBeLoading', (selector: string) => {
  cy.get(selector).should('not.contain', 'Carregando').and('not.have.class', 'animate-spin');
});

Cypress.Commands.add('fillContentForm', (data: ContentFormData) => {
  if (data.title) {
    cy.get('input[name="title"]').clear().type(data.title);
  }

  if (data.description) {
    cy.get('textarea[name="description"]').clear().type(data.description);
  }

  if (data.price) {
    cy.get('input[name="price_cents"]').clear().type(data.price);
  }

  if (data.status) {
    cy.get('select[name="status"]').select(data.status);
  }

  if (data.availability) {
    cy.get('select[name="availability"]').select(data.availability);
  }

  if (data.genre) {
    cy.get('input[name="genre"]').clear().type(data.genre);
  }

  if (data.director) {
    cy.get('input[name="director"]').clear().type(data.director);
  }
});

Cypress.Commands.add('checkToastMessage', (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  const className = type === 'success' ? '.toast-success' :
                   type === 'error' ? '.toast-error' :
                   '.toast-warning';

  cy.get(className, { timeout: 5000 })
    .should('be.visible')
    .and('contain', message);
});

// Add data-testid selectors for better testing
Cypress.Commands.overwrite('get', (originalFn, selector, options) => {
  if (typeof selector === 'string' && selector.startsWith('data-testid=')) {
    const testId = selector.replace('data-testid=', '');
    return originalFn(`[data-testid="${testId}"]`, options);
  }

  return originalFn(selector, options);
});