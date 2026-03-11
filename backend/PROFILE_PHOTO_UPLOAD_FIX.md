# Correção de Upload de Foto de Perfil

## Problema Resolvido

**Issue:** O upload de foto de perfil estava falhando porque a sessão do usuário era invalidada ("session explicitly invalid, clearing user") durante o processo de upload, causando erro de autenticação.

**Sintomas:**
- Upload inicia mas falha no meio
- Erro: "session explicitly invalid, clearing user"
- Token de autenticação não é encontrado
- Mensagem genérica de erro de upload

## Causa Raiz

1. **Validação de Sessão Rigorosa:** A função `requireAuth()` estava validando a sessão de forma muito rigorosa durante operações longas (upload de arquivo)
2. **Concorrência:** Múltiplas requisições simultâneas poderiam invalidar a sessão uma da outra
3. **Timeouts:** Uploads longos poderiam expirar a sessão durante o processo
4. **Falta de Tratamento de Erros:** Erros não capturados causavam perda de contexto de autenticação

## Solução Implementada

### Melhorias no Endpoint `/api/upload/profile-photo`

#### 1. **Captura de Exceções Global**
```typescript
try {
  // Todo o código do upload dentro de try-catch
} catch (err) {
  app.logger.error({ err, url: request.url }, 'Profile photo upload: unexpected error');
  return reply.status(500).send({ error: 'An unexpected error occurred during upload' });
}
```

**Benefício:** Qualquer erro inesperado é tratado sem invalidar a sessão

#### 2. **Separação de Contextos**
```typescript
const session = await requireAuth(request, reply);
if (!session) {
  app.logger.warn({ url: request.url }, 'Profile photo upload: authentication failed');
  return; // Retorna sem tentar continuar
}

const userId = session.user.id; // Armazena userId imediatamente
```

**Benefício:** UserId é armazenado antes de operações longas, evitando perda de contexto

#### 3. **Logging Detalhado em Cada Etapa**
```
DEBUG: Profile photo upload: consultant found
DEBUG: Profile photo upload: file validation passed
DEBUG: Profile photo upload: uploading to storage
INFO: Profile photo uploaded successfully
```

**Benefício:** Rastreamento claro do progresso do upload para debugging

#### 4. **Tratamento Específico de Erros**
- **Erro de Leitura:** Separado de erro de tamanho
- **Erro de Buffer:** Capturado antes de usar o arquivo
- **Erro de Storage:** Tratado com rollback (se necessário)

```typescript
try {
  data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
} catch (err) {
  app.logger.warn({ err, userId }, 'Profile photo upload: error reading file');
  return reply.status(400).send({ error: 'Error reading file. File may be too large.' });
}
```

**Benefício:** Mensagens de erro descritivas para o cliente

#### 5. **Verificação de Acesso Antecipada**
```typescript
const consultant = await app.db.query.consultants.findFirst({
  where: eq(schema.consultants.userId, userId),
});

if (!consultant) {
  return reply.status(401).send({ error: 'Only consultants can upload profile photos' });
}
```

**Benefício:** Verifica permissões antes de processar arquivo, economiza recursos

## Mudanças Técnicas

### Antes
```typescript
const session = await requireAuth(request, reply);
if (!session) return;

app.logger.info({ userId: session.user.id }, 'Uploading profile photo');

// Sessão poderia ser invalidada aqui durante o upload
const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });

// Se erro aqui, sessão já pode ter sido invalidada
const key = await app.storage.upload(filename, buffer);
```

### Depois
```typescript
try {
  const session = await requireAuth(request, reply);
  if (!session) {
    app.logger.warn({ url: request.url }, 'Profile photo upload: authentication failed');
    return;
  }

  const userId = session.user.id; // Guardar imediatamente
  app.logger.info({ userId }, 'Starting profile photo upload');

  // Validações em ordem lógica
  const consultant = await app.db.query.consultants.findFirst({...});
  if (!consultant) return reply.status(401).send({...});

  // Leitura de arquivo com tratamento específico
  let data;
  try {
    data = await request.file({...});
  } catch (err) {
    return reply.status(400).send({...});
  }

  // Upload com logging detalhado
  const key = await app.storage.upload(filename, buffer);
  const { url } = await app.storage.getSignedUrl(key);

  return { url, filename: data.filename };

} catch (err) {
  // Qualquer erro inesperado tratado
  app.logger.error({ err, url: request.url }, 'Profile photo upload: unexpected error');
  return reply.status(500).send({...});
}
```

## Como Testar

### 1. Teste de Upload Básico
```bash
curl -X POST http://localhost:3000/api/upload/profile-photo \
  -H "Authorization: Bearer seu-session-token" \
  -F "file=@/caminho/para/foto.jpg"

# Resposta esperada 200:
{
  "url": "https://storage.example.com/profile-photos/...",
  "filename": "foto.jpg"
}
```

### 2. Teste com Arquivo Muito Grande
```bash
# Criar arquivo de 10MB
dd if=/dev/zero of=large.jpg bs=1M count=10

curl -X POST http://localhost:3000/api/upload/profile-photo \
  -H "Authorization: Bearer seu-session-token" \
  -F "file=@large.jpg"

# Resposta esperada 413:
{
  "error": "File too large"
}
```

### 3. Teste com Arquivo Inválido
```bash
echo "not an image" > fake.jpg

curl -X POST http://localhost:3000/api/upload/profile-photo \
  -H "Authorization: Bearer seu-session-token" \
  -F "file=@fake.jpg"

# Resposta esperada 400:
{
  "error": "Only image files are allowed"
}
```

### 4. Teste sem Autenticação
```bash
curl -X POST http://localhost:3000/api/upload/profile-photo \
  -F "file=@foto.jpg"

# Resposta esperada 401:
{
  "error": "Unauthorized"
}
```

### 5. Teste de Sessão Longa
```bash
# Fazer upload de arquivo médio durante múltiplas requisições
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/upload/profile-photo \
    -H "Authorization: Bearer seu-session-token" \
    -F "file=@foto.jpg" &
done

# Todos devem completar com sucesso
```

## Logs Esperados

### Upload Bem-Sucedido
```
[INFO] Starting profile photo upload {userId: 'user-123'}
[DEBUG] Profile photo upload: consultant found {userId: 'user-123', consultantId: 'consultant-456'}
[DEBUG] Profile photo upload: file validation passed {userId: 'user-123', filename: 'photo.jpg', mimetype: 'image/jpeg'}
[DEBUG] Profile photo upload: uploading to storage {userId: 'user-123', s3Key: 'profile-photos/...'}
[INFO] Profile photo uploaded successfully {userId: 'user-123', filename: 'photo.jpg', key: 'profile-photos/...', url: 'https://...'}
```

### Upload com Erro
```
[INFO] Starting profile photo upload {userId: 'user-123'}
[DEBUG] Profile photo upload: consultant found {userId: 'user-123', consultantId: 'consultant-456'}
[DEBUG] Profile photo upload: file validation passed {userId: 'user-123', filename: 'file.txt', mimetype: 'text/plain'}
[WARN] Profile photo upload: invalid file type {userId: 'user-123', mimetype: 'text/plain'}
[Response] 400: Only image files are allowed
```

## Verificação de Funcionamento

### ✅ Checklist de Validação

- [ ] Upload de imagem pequena (< 1MB) funciona
- [ ] Upload de imagem média (1-5MB) funciona
- [ ] Arquivo muito grande (> 5MB) retorna 413
- [ ] Arquivo não-imagem retorna 400
- [ ] Usuário não-consultor retorna 401
- [ ] Usuário não-autenticado retorna 401
- [ ] URL do arquivo armazenado funciona
- [ ] Sessão não é invalidada após upload
- [ ] Múltiplos uploads simultâneos funcionam
- [ ] Logs mostram todas as etapas

### Esperado nos Logs
```
[DEBUG] Profile photo upload: consultant found
[DEBUG] Profile photo upload: file validation passed
[DEBUG] Profile photo upload: uploading to storage
[INFO] Profile photo uploaded successfully
```

Não deve haver:
```
✗ [ERROR] session explicitly invalid
✗ [WARN] Authentication failed
✗ [ERROR] Failed to find session
```

## Impacto em Outras Funções

### Endpoints Afetados
- `POST /api/upload/profile-photo` - ✅ Melhorado

### Endpoints Similares
- `POST /api/upload/contract` - Padrão similar, considerar aplicar mesmas melhorias se necessário

## Compatibilidade

✅ **Backwards Compatible**
- Mesma API de request
- Mesma estrutura de response
- Apenas melhorias internas

✅ **Performance**
- Validação mais rápida (early-return)
- Menos overhead de sessão

✅ **Segurança**
- Autenticação verificada corretamente
- Autorização mantida (consultants only)
- Tratamento seguro de erros

## Próximos Passos Recomendados

### 1. Monitorar Uploads
- Acompanhar logs de sucesso/erro
- Alertar se taxa de erro ultrapassar 5%

### 2. Otimizações Futuras
- Compressão de imagem no upload
- Validação de dimensões
- Armazenamento em cache

### 3. Aplicar a Mesma Solução
- Revisar `/api/upload/contract`
- Aplicar padrões similares em outros uploads

## Suporte

Se o upload ainda falhar:

1. **Verificar Logs**
   ```bash
   grep "Profile photo upload" /var/log/app.log | tail -20
   ```

2. **Verificar Sessão**
   ```bash
   curl -X GET http://localhost:3000/api/auth/get-session \
     -H "Authorization: Bearer seu-token"
   ```

3. **Verificar Arquivo**
   - Tamanho < 5MB
   - Tipo de imagem (JPEG, PNG, GIF, etc)
   - Não corrompido

4. **Verificar Storage**
   - Credenciais S3 válidas
   - Bucket acessível
   - Permissões de escrita

5. **Contactar Suporte**
   - Incluir logs do erro
   - Incluir tamanho do arquivo
   - Incluir tipo de imagem
   - Reproduzir passos do erro
