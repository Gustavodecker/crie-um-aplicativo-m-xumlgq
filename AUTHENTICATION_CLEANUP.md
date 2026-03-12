
# Limpeza de Autenticação - Resumo das Alterações

## Problema Identificado

O aplicativo estava enfrentando conflitos de autenticação devido ao uso simultâneo de:
- Better Auth (armazenando em `sleep-consultant_cookie` e `sleep-consultant_session_data`)
- Autenticação manual via Bearer token
- Limpeza automática de tokens durante inicialização

## Alterações Realizadas

### 1. **lib/auth.ts** - Simplificado para JWT Manual
✅ **Removido:** Toda integração com Better Auth (`authClient`, `expoClient`)
✅ **Mantido:** Apenas funções de gerenciamento de Bearer token
✅ **Armazenamento:** 
- Web: `localStorage`
- Mobile: `AsyncStorage`
- Chave única: `sleep-consultant_bearer_token`

**Funções disponíveis:**
- `setBearerToken(token)` - Salva token
- `getBearerToken()` - Recupera token
- `clearAuthTokens()` - Limpa TODOS os tokens (incluindo resíduos do Better Auth)

### 2. **contexts/AuthContext.tsx** - Autenticação Simplificada
✅ **Removido:** 
- Importação de `authClient` do Better Auth
- Funções OAuth (`signInWithGoogle`, `signInWithApple`, `signInWithGitHub`)
- Popup OAuth para web
- Qualquer referência a Better Auth

✅ **Mantido:**
- `signInWithEmail(email, password)` - Login com email/senha
- `signUpWithEmail(email, password, name)` - Registro de consultora
- `createAccountWithToken(token, email, password)` - Registro de mãe com token
- `validateBabyToken(token)` - Validação de token do bebê
- `signOut()` - Logout manual

✅ **Comportamento de `clearAuthTokens()`:**
- ❌ **NÃO** é chamado automaticamente na inicialização
- ✅ **SIM** é chamado apenas em:
  1. Logout manual (`signOut()`)
  2. Resposta 401 explícita do backend

### 3. **utils/api.ts** - API Helpers Limpos
✅ **Removido:** Referências a Better Auth
✅ **Mantido:** Todas as funções de API com Bearer token
- `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()`
- `authenticatedGet()`, `authenticatedPost()`, etc.

### 4. **Arquivos Deletados**
❌ `app/auth-callback.tsx` - Callback OAuth do Better Auth
❌ `app/auth-popup.tsx` - Popup OAuth do Better Auth

### 5. **app/auth.tsx** - Tela de Login Inalterada
✅ Continua funcionando normalmente
✅ Usa apenas `signInWithEmail`, `signUpWithEmail`, `createAccountWithToken`

## Fluxo de Autenticação Atual

### Login de Consultora
1. Usuário insere email e senha
2. `signInWithEmail()` chama `/api/auth/sign-in/email`
3. Backend retorna `{ session: { token }, user }`
4. Token é salvo em `sleep-consultant_bearer_token`
5. Estado `user` e `userRole` são atualizados
6. Redirecionamento para `/(tabs)`

### Login de Mãe
1. Usuário insere email e senha
2. `signInWithEmail()` chama `/api/auth/sign-in/email`
3. Backend retorna `{ session: { token }, user }`
4. Token é salvo em `sleep-consultant_bearer_token`
5. Sistema verifica se usuário tem bebê vinculado
6. `userRole` é definido como "mother"
7. Redirecionamento para `/(tabs)`

### Criação de Conta de Mãe com Token
1. Usuário insere token do bebê
2. `validateBabyToken()` valida o token
3. Usuário insere email e senha
4. `createAccountWithToken()` chama `/api/mothers/create-account-with-token`
5. Backend cria conta e retorna `{ session: { token }, user }`
6. Token é salvo em `sleep-consultant_bearer_token`
7. `userRole` é definido como "mother"
8. Redirecionamento para `/(tabs)`

### Logout
1. Usuário clica em "Sair da conta"
2. `signOut()` é chamado
3. Estado local é limpo (`user = null`, `userRole = null`)
4. `clearAuthTokens()` remove TODOS os tokens do storage
5. Redirecionamento para `/auth`

## Verificações de Segurança

✅ **Token só é limpo quando:**
- Logout manual
- Backend retorna 401 (não autorizado)

❌ **Token NÃO é limpo quando:**
- App inicia
- Erro de rede (500, timeout, etc.)
- Usuário está carregando dados

## Próximos Passos

1. ✅ Testar login de consultora
2. ✅ Testar login de mãe
3. ✅ Testar criação de conta de mãe com token
4. ✅ Testar logout
5. ✅ Verificar que tokens não são limpos automaticamente
6. ✅ Confirmar que não há mais conflitos de armazenamento

## Comandos para Limpar Cache (se necessário)

Se ainda houver problemas com "Requiring unknown module", execute:

```bash
# Limpar cache do Metro
npx expo start --clear

# Ou no terminal do Expo
r (reload)
```

## Armazenamento Atual

**Web (localStorage):**
- `sleep-consultant_bearer_token` - Token JWT

**Mobile (AsyncStorage):**
- `sleep-consultant_bearer_token` - Token JWT
- `userRole` - "consultant" ou "mother"

**Removido:**
- ❌ `sleep-consultant_cookie`
- ❌ `sleep-consultant_session_data`
- ❌ Qualquer chave do Better Auth
