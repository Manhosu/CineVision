# Limpar Uploads Travados

Se houver uploads travados no sistema, abra o console do navegador (F12) e execute:

```javascript
// Limpar todos os uploads do localStorage
localStorage.removeItem('cinevision_upload_tasks');

// Recarregar a página
location.reload();
```

Ou clique no botão X vermelho no canto superior direito do modal de uploads quando não houver uploads em andamento.
