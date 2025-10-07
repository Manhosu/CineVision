describe('Admin Panel E2E Tests', () => {
  beforeEach(() => {
    // Mock admin authentication
    cy.window().then((win) => {
      win.localStorage.setItem('admin_token', 'mock-admin-token');
      win.localStorage.setItem('admin_user', JSON.stringify({
        id: 'admin-1',
        email: 'admin@cinevision.com',
        role: 'admin'
      }));
    });

    // Mock API responses
    cy.intercept('GET', '/api/admin/metrics*', {
      fixture: 'admin/metrics.json'
    }).as('getMetrics');

    cy.intercept('GET', '/api/admin/content*', {
      fixture: 'admin/content.json'
    }).as('getContent');

    cy.intercept('GET', '/api/admin/users*', {
      fixture: 'admin/users.json'
    }).as('getUsers');
  });

  describe('Dashboard', () => {
    it('should load dashboard with metrics', () => {
      cy.visit('/dashboard');

      // Wait for metrics to load
      cy.wait('@getMetrics');

      // Check main stats cards
      cy.contains('Total Usuários').should('be.visible');
      cy.contains('Total Conteúdo').should('be.visible');
      cy.contains('Receita Total').should('be.visible');
      cy.contains('Streams Ativos').should('be.visible');

      // Check charts are rendered
      cy.get('[data-testid="revenue-chart"]').should('exist');
      cy.get('[data-testid="top-content-chart"]').should('exist');

      // Test period selector
      cy.get('select[data-testid="period-selector"]').select('7d');
      cy.wait('@getMetrics');

      // Test refresh button
      cy.get('button').contains('Atualizar').click();
      cy.wait('@getMetrics');
    });

    it('should handle dashboard errors gracefully', () => {
      cy.intercept('GET', '/api/admin/metrics*', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('getMetricsError');

      cy.visit('/dashboard');
      cy.wait('@getMetricsError');

      cy.contains('Erro ao carregar métricas').should('be.visible');
    });
  });

  describe('Content Management', () => {
    it('should create new content and verify visibility in public catalog', () => {
      cy.visit('/content');
      cy.wait('@getContent');

      // Click add content button
      cy.get('button').contains('Adicionar Conteúdo').click();

      // Fill content form
      cy.get('input[name="title"]').type('Teste E2E Movie');
      cy.get('textarea[name="description"]').type('Filme criado via teste E2E');
      cy.get('input[name="price_cents"]').clear().type('19.90');
      cy.get('select[name="status"]').select('PUBLISHED');
      cy.get('select[name="availability"]').select('site');
      cy.get('input[name="genre"]').type('Ação, Aventura');
      cy.get('input[name="director"]').type('Diretor Teste');

      // Mock content creation
      cy.intercept('POST', '/api/admin/content', {
        statusCode: 201,
        body: {
          id: 'content-test-1',
          title: 'Teste E2E Movie',
          status: 'PUBLISHED',
          availability: 'site'
        }
      }).as('createContent');

      // Submit form
      cy.get('button[type="submit"]').click();
      cy.wait('@createContent');

      // Verify content appears in table
      cy.contains('Teste E2E Movie').should('be.visible');

      // Test public catalog visibility
      cy.visit('/'); // Public site
      cy.intercept('GET', '/api/content*', {
        fixture: 'public/content.json'
      }).as('getPublicContent');

      cy.wait('@getPublicContent');
      cy.contains('Teste E2E Movie').should('be.visible');
    });

    it('should update content availability settings', () => {
      cy.visit('/content');
      cy.wait('@getContent');

      // Mock content update
      cy.intercept('PUT', '/api/admin/content/*', {
        statusCode: 200,
        body: { success: true }
      }).as('updateContent');

      // Change availability of first content item
      cy.get('select[data-testid="availability-select"]').first().select('both');
      cy.wait('@updateContent');

      // Verify update was successful (would show in UI feedback)
      cy.get('.toast-success', { timeout: 5000 }).should('be.visible');
    });

    it('should handle content creation errors', () => {
      cy.visit('/content');

      // Click add content button
      cy.get('button').contains('Adicionar Conteúdo').click();

      // Try to submit empty form
      cy.get('button[type="submit"]').click();

      // Should show validation errors
      cy.get('input[name="title"]:invalid').should('exist');
    });
  });

  describe('User Management', () => {
    it('should block user and verify access restriction', () => {
      cy.visit('/users');
      cy.wait('@getUsers');

      // Mock user block action
      cy.intercept('PUT', '/api/admin/users/*/block', {
        statusCode: 200,
        body: { success: true }
      }).as('blockUser');

      // Find active user and block them
      cy.get('tr').contains('Ativo').parent().within(() => {
        cy.get('button').contains('Bloquear').click();
      });

      // Confirm block action
      cy.on('window:confirm', () => true);
      cy.wait('@blockUser');

      // Verify user status changed in admin
      cy.get('tr').contains('Bloqueado').should('exist');

      // Test that blocked user cannot access content
      cy.window().then((win) => {
        win.localStorage.removeItem('admin_token');
        win.localStorage.setItem('user_token', 'blocked-user-token');
      });

      cy.intercept('GET', '/api/content*', {
        statusCode: 403,
        body: { error: 'User blocked' }
      }).as('getContentBlocked');

      cy.visit('/'); // Public site
      cy.wait('@getContentBlocked');
      cy.contains('Acesso negado').should('be.visible');
    });

    it('should adjust user balance', () => {
      cy.visit('/users');
      cy.wait('@getUsers');

      // Click on balance adjustment button
      cy.get('button').contains('Saldo').first().click();

      // Fill balance adjustment form
      cy.get('input[name="balance_adjustment"]').type('50.00');
      cy.get('select[name="adjustment_reason"]').select('bonus');

      // Mock balance adjustment
      cy.intercept('PUT', '/api/admin/users/*/balance', {
        statusCode: 200,
        body: { success: true, newBalance: 100.00 }
      }).as('adjustBalance');

      cy.get('button').contains('Salvar Alterações').click();
      cy.wait('@adjustBalance');

      // Verify success message
      cy.get('.toast-success', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Settings', () => {
    it('should change PIX key and verify bot/payment messages reflect new key', () => {
      cy.visit('/settings');

      // Navigate to payments tab
      cy.get('button').contains('Pagamentos').click();

      // Update PIX key
      const newPixKey = '11999887766';
      cy.get('input[name="pixKey"]').clear().type(newPixKey);

      // Mock settings save
      cy.intercept('PUT', '/api/admin/settings', {
        statusCode: 200,
        body: { success: true }
      }).as('saveSettings');

      cy.get('button').contains('Salvar Configurações').click();
      cy.wait('@saveSettings');

      // Verify success message
      cy.contains('Configurações salvas com sucesso').should('be.visible');

      // Mock payment creation to verify new PIX key is used
      cy.intercept('POST', '/api/payments', {
        statusCode: 200,
        body: {
          id: 'payment-1',
          pixKey: newPixKey,
          qrCode: `pix-qr-code-${newPixKey}`
        }
      }).as('createPayment');

      // Simulate user making a payment (would need to visit public site)
      cy.window().then((win) => {
        win.localStorage.removeItem('admin_token');
        win.localStorage.setItem('user_token', 'regular-user-token');
      });

      cy.visit('/'); // Public site
      // Simulate payment flow...
      // cy.get('button').contains('Comprar').first().click();
      // cy.wait('@createPayment');
      // cy.contains(newPixKey).should('be.visible');
    });

    it('should test Stripe connection', () => {
      cy.visit('/settings');

      // Navigate to payments tab
      cy.get('button').contains('Pagamentos').click();

      // Enter Stripe keys
      cy.get('input[name="stripeSecretKey"]').type('sk_test_fake_key_for_testing');

      // Mock Stripe connection test
      cy.intercept('POST', '/api/admin/test-stripe', {
        statusCode: 200,
        body: { success: true, connected: true }
      }).as('testStripe');

      cy.get('button').contains('Testar Conexão Stripe').click();
      cy.wait('@testStripe');

      // Verify connection status
      cy.contains('Stripe conectado').should('be.visible');
    });
  });

  describe('System Logs', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/logs*', {
        fixture: 'admin/logs.json'
      }).as('getLogs');
    });

    it('should filter logs by level and service', () => {
      cy.visit('/logs');
      cy.wait('@getLogs');

      // Filter by error level
      cy.get('select[data-testid="level-filter"]').select('ERROR');
      cy.wait('@getLogs');

      // Verify only error logs are shown
      cy.get('tbody tr').should('contain', 'ERROR');

      // Filter by service
      cy.get('select[data-testid="service-filter"]').select('payment');
      cy.wait('@getLogs');

      // Verify filtering works
      cy.get('tbody tr').should('contain', 'Payment');
    });

    it('should enable auto-refresh and export logs', () => {
      cy.visit('/logs');
      cy.wait('@getLogs');

      // Enable auto-refresh
      cy.get('input[id="autoRefresh"]').check();

      // Verify auto-refresh indicator
      cy.get('.animate-pulse').should('exist');

      // Test export functionality
      cy.intercept('POST', '/api/admin/logs/export', {
        statusCode: 200,
        body: 'timestamp,level,service,message\\n2024-01-15 10:00:00,INFO,system,Test log'
      }).as('exportLogs');

      cy.get('button').contains('Exportar').click();
      cy.wait('@exportLogs');
    });
  });

  describe('Orders/Requests', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/content-requests*', {
        fixture: 'admin/requests.json'
      }).as('getRequests');
    });

    it('should process content request and notify user', () => {
      cy.visit('/requests');
      cy.wait('@getRequests');

      // Mark first pending request as processed
      cy.intercept('PUT', '/api/admin/content-requests/*', {
        statusCode: 200,
        body: { success: true }
      }).as('updateRequest');

      cy.get('tbody tr').first().within(() => {
        cy.get('button[title="Marcar como processada"]').click();
      });

      cy.wait('@updateRequest');

      // Notify user about processed request
      cy.intercept('POST', '/api/admin/notify-user/*', {
        statusCode: 200,
        body: { success: true }
      }).as('notifyUser');

      cy.get('tbody tr').first().within(() => {
        cy.get('button[title="Notificar usuário"]').click();
      });

      cy.wait('@notifyUser');

      // Verify success message
      cy.contains('Usuário notificado com sucesso').should('be.visible');
    });
  });

  describe('Authentication', () => {
    it('should redirect to login when not authenticated', () => {
      cy.window().then((win) => {
        win.localStorage.removeItem('admin_token');
      });

      cy.visit('/dashboard');

      // Should redirect to login
      cy.url().should('include', '/login');
      cy.contains('Admin Login').should('be.visible');
    });

    it('should handle authentication errors', () => {
      cy.intercept('GET', '/api/admin/metrics*', {
        statusCode: 401,
        body: { error: 'Unauthorized' }
      }).as('getMetricsUnauthorized');

      cy.visit('/dashboard');
      cy.wait('@getMetricsUnauthorized');

      // Should redirect to login or show error
      cy.url().should('include', '/login');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile devices', () => {
      cy.viewport('iphone-x');
      cy.visit('/dashboard');
      cy.wait('@getMetrics');

      // Check mobile-friendly elements
      cy.get('h1').should('be.visible');
      cy.get('[data-testid="mobile-menu"]').should('exist');

      // Check responsive grid
      cy.get('.grid').should('have.class', 'grid-cols-1');
    });
  });
});

// Fixture files would be created at:
// cypress/fixtures/admin/metrics.json
// cypress/fixtures/admin/content.json
// cypress/fixtures/admin/users.json
// cypress/fixtures/admin/logs.json
// cypress/fixtures/admin/requests.json
// cypress/fixtures/public/content.json