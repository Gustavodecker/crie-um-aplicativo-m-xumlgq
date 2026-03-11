# Guia de Autenticação para Mães (Token-Based)

## Problema Resolvido

**Como a mãe cria a conta?**

Anteriormente, mães recebiam um token quando um bebê era registrado, mas não havia um fluxo claro para elas fazerem login usando esse token. Agora temos três endpoints para suportar o fluxo de autenticação baseado em token.

## Fluxo de Autenticação para Mães

### Opção 1: Usar Token para Validar (Recomendado)

**1. Validar o Token**
```
POST /api/auth/validate-token
Content-Type: application/json

{
  "token": "abc123def456..."
}

Resposta 200:
{
  "valid": true,
  "babyId": "uuid-baby-id",
  "babyName": "João",
  "motherEmail": "mae@exemplo.com",
  "consultantName": "Dra. Maria",
  "accountExists": false  // ou true
}
```

**2. Se a conta não existe (accountExists: false):**
- Mãe precisa se registrar via `/api/auth/sign-up/email` com seu email
- Usa a mesma senha em ambos os endpoints
- Depois usa `/api/init/mother` com o token para associar a conta ao bebê

**3. Se a conta já existe (accountExists: true):**
- Mãe faz login normalmente via `/api/auth/sign-in/email`
- Ou pode usar `/api/auth/sign-in/token` para validar o token

### Opção 2: Sign-in Direto com Token

```
POST /api/auth/sign-in/token
Content-Type: application/json

{
  "token": "abc123def456..."
}

Resposta 200:
{
  "baby": {
    "id": "uuid-baby-id",
    "name": "João",
    "birthDate": "2023-01-15",
    "consultantId": "uuid-consultant",
    "consultantName": "Dra. Maria"
  },
  "mother": {
    "userId": "user-id",
    "email": "mae@exemplo.com",
    "name": "Ana Silva"
  },
  "message": "Token validated. Use standard sign-in with email and password to authenticate."
}

Resposta 400 (se conta não existe):
{
  "error": "Account not found for this mother. Please sign up first.",
  "babyId": "uuid-baby-id",
  "motherEmail": "mae@exemplo.com"
}
```

## Endpoints Criados

### 1. POST /api/auth/validate-token

**Descrição:** Valida um token de bebê e retorna informações da mãe

**Request Body:**
```json
{
  "token": "string (requerido)"
}
```

**Response 200 (Valid Token):**
```json
{
  "valid": true,
  "babyId": "uuid",
  "babyName": "string",
  "motherEmail": "string",
  "consultantName": "string",
  "accountExists": boolean
}
```

**Response 404 (Invalid Token):**
```json
{
  "error": "Invalid token. Baby not found."
}
```

**Use Cases:**
- Verificar se um token é válido antes de pedir ao usuário para se registrar
- Mostrar informações do bebê para qual a mãe se registrará
- Verificar se a conta já existe

---

### 2. POST /api/auth/sign-in/token

**Descrição:** Autentica mãe usando token de bebê (requer que a conta exista)

**Request Body:**
```json
{
  "token": "string (requerido)"
}
```

**Response 200 (Account Exists):**
```json
{
  "baby": {
    "id": "uuid",
    "name": "string",
    "birthDate": "YYYY-MM-DD",
    "consultantId": "uuid",
    "consultantName": "string"
  },
  "mother": {
    "userId": "string",
    "email": "string",
    "name": "string"
  },
  "message": "Token validated. Use standard sign-in with email and password to authenticate."
}
```

**Response 400 (Account Doesn't Exist):**
```json
{
  "error": "Account not found for this mother. Please sign up first.",
  "babyId": "uuid",
  "motherEmail": "string"
}
```

**Response 404 (Invalid Token):**
```json
{
  "error": "Invalid token. Baby not found."
}
```

**Use Cases:**
- Quick login flow with just the token
- Verify token and get baby/mother info
- Prompt user to complete standard sign-in if needed

---

### 3. POST /api/auth/create-account-with-token

**Descrição:** Cria uma conta e faz login da mãe usando token (ainda em desenvolvimento)

**Request Body:**
```json
{
  "token": "string (requerido)",
  "name": "string (requerido)",
  "password": "string (requerido)"
}
```

**Current Response 400:**
```json
{
  "error": "Please use the standard sign-up endpoint to create your account",
  "babyId": "uuid",
  "motherEmail": "string",
  "message": "Sign up with your email address, then use the token to link your account to the baby"
}
```

**Note:** Este endpoint valida o token e a mãe, mas recomenda usar o fluxo padrão:
1. `/api/auth/sign-up/email` - Cria a conta
2. `/api/init/mother` - Associa a mãe ao bebê

---

## Fluxo Recomendado para Aplicação

### Fluxo A: Registrar Nova Mãe

```
1. Usuário insere o token do bebê
   ↓
2. POST /api/auth/validate-token
   ↓
3. Se accountExists: false
   ↓
4. POST /api/auth/sign-up/email
   - email: baby.motherEmail
   - password: (user provides)
   - name: (user provides or from baby)
   ↓
5. POST /api/init/mother
   - token: (baby token)
   ↓
6. Mãe está registrada e autenticada!
```

### Fluxo B: Mãe Já Registrada

```
1. Usuário insere o token do bebê
   ↓
2. POST /api/auth/validate-token
   ↓
3. Se accountExists: true
   ↓
4. POST /api/auth/sign-in/email
   - email: baby.motherEmail
   - password: (user provides)
   ↓
5. Mãe está autenticada!
```

### Fluxo C: Sign-in Rápido com Token

```
1. Usuário insere o token do bebê
   ↓
2. POST /api/auth/sign-in/token
   ↓
3. Se resultado mostra conta existe:
   - Mostrar info do bebê
   - Pedir email e senha para signin final
   ↓
4. POST /api/auth/sign-in/email
   ↓
5. Mãe está autenticada!
```

## Como Funciona no Backend

1. **Validação de Token:**
   - Token é comparado com a coluna `token` na tabela `babies`
   - Se encontrado, retorna informações da mãe

2. **Associação Mãe-Bebê:**
   - Ao registrar, a mãe insere seu email
   - Quando usa `/api/init/mother` com o token:
     - Backend valida que email da mãe == email do bebê
     - Atualiza `motherUserId` na tabela `babies`

3. **Segurança:**
   - Tokens são únicos por bebê
   - Email de registro da mãe deve corresponder ao email registrado no bebê
   - Sessão é criada após autenticação bem-sucedida

## Tratamento de Erros

### Erro: "Invalid token. Baby not found."
- **Causa:** Token digitado incorretamente ou não existe
- **Solução:** Verificar se o token foi copiado corretamente

### Erro: "Account not found for this mother. Please sign up first."
- **Causa:** Token é válido mas a mãe ainda não criou uma conta
- **Solução:** Usar `/api/auth/sign-up/email` primeiro

### Erro: "Email does not match registered mother email"
- **Causa:** Email de signup é diferente do email registrado para o bebê
- **Solução:** Usar o mesmo email que foi registrado quando o bebê foi criado

### Erro: "Account already exists for this mother. Please sign in instead."
- **Causa:** Tentando criar uma conta que já existe
- **Solução:** Usar `/api/auth/sign-in/email` ao invés de sign-up

## Melhores Práticas

### 1. Validar Token Antes de Mostrar Formulário
```javascript
// Frontend
const response = await fetch('/api/auth/validate-token', {
  method: 'POST',
  body: JSON.stringify({ token })
});

const data = await response.json();

if (!data.valid) {
  showError("Token inválido");
  return;
}

if (data.accountExists) {
  showSignInForm(data.motherEmail);
} else {
  showSignUpForm(data.motherEmail, data.babyName);
}
```

### 2. Preservar o Token para Linkar Conta
```javascript
// Frontend - após sign-up com email/senha
const signUpResponse = await fetch('/api/auth/sign-up/email', {
  method: 'POST',
  body: JSON.stringify({ email, password, name })
});

// Agora linkar o token ao bebê
const initResponse = await fetch('/api/init/mother', {
  method: 'POST',
  body: JSON.stringify({ token })
});
```

### 3. Armazenar o Token Recebido
- Quando um bebê é registrado, um token é gerado
- Enviar token via email, SMS, ou in-app para a mãe
- Mãe guarda o token para registro/login posterior

## Exemplos de Uso com cURL

### Validar Token
```bash
curl -X POST http://localhost:3000/api/auth/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token": "seu-token-aqui"}'
```

### Sign-in com Token
```bash
curl -X POST http://localhost:3000/api/auth/sign-in/token \
  -H "Content-Type: application/json" \
  -d '{"token": "seu-token-aqui"}'
```

### Sign-up Normal (passo 1)
```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mae@exemplo.com",
    "password": "senha123",
    "name": "Ana Silva"
  }'
```

### Associar Mãe ao Bebê (passo 2)
```bash
curl -X POST http://localhost:3000/api/init/mother \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-session-token" \
  -d '{"token": "seu-token-de-bebe"}'
```

## Campos na Resposta

### Baby Object
```json
{
  "id": "uuid - ID do bebê",
  "name": "string - Nome do bebê",
  "birthDate": "YYYY-MM-DD - Data de nascimento",
  "consultantId": "uuid - ID da consultora",
  "consultantName": "string - Nome da consultora"
}
```

### Mother Object
```json
{
  "userId": "string - ID do usuário da mãe",
  "email": "string - Email da mãe",
  "name": "string - Nome completo da mãe"
}
```

### Validation Response
```json
{
  "valid": "boolean - Token é válido?",
  "babyId": "uuid - ID do bebê",
  "babyName": "string - Nome do bebê",
  "motherEmail": "string - Email registrado da mãe",
  "consultantName": "string - Nome da consultora",
  "accountExists": "boolean - Conta da mãe já existe?"
}
```

## Dúvidas Comuns

**P: O token nunca expira?**
R: Tokens de bebê não expiram. Mães podem usar o mesmo token indefinidamente para se conectar ao bebê.

**P: Posso usar o mesmo token para múltiplas mães?**
R: Cada bebê tem um token único. Não há suporte oficial para múltiplas mães por bebê no fluxo de token.

**P: E se a mãe esquecer a senha?**
R: Usar o fluxo normal de "esqueci a senha" em `/api/auth/request-password-reset`.

**P: O token é enviado no email quando o bebê é registrado?**
R: Sim, a token é incluída na informação do bebê. Recomenda-se enviar via email ou SMS para a mãe.

**P: Posso compartilhar o token com outro membro da família?**
R: Sim! O token dá acesso às informações do bebê para qualquer pessoa que o tenha. Recomenda-se não compartilhar com pessoas não autorizadas.

## Suporte

Para problemas com autenticação:
1. Verificar logs do servidor
2. Validar token com `/api/auth/validate-token`
3. Verificar email usado no signup vs email do bebê
4. Garantir que a sessão não expirou (30 dias)
