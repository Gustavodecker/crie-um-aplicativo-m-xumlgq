# Exemplos Rápidos de Integração

## 1️⃣ Validar Token de Bebê

```javascript
// Frontend - JavaScript
async function validateBabyToken(token) {
  try {
    const response = await fetch('/api/auth/validate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token inválido:', data.error);
      return null;
    }

    return data;
    // {
    //   "valid": true,
    //   "babyId": "uuid",
    //   "babyName": "João",
    //   "motherEmail": "mae@exemplo.com",
    //   "consultantName": "Dra. Maria",
    //   "accountExists": false
    // }
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return null;
  }
}
```

---

## 2️⃣ Fluxo Completo de Signup com Token

```javascript
// Frontend - Registro de mãe com token
async function signUpMotherWithToken() {
  const token = prompt('Digite o token do bebê:');
  if (!token) return;

  // Passo 1: Validar token
  console.log('Validando token...');
  const validation = await validateBabyToken(token);

  if (!validation?.valid) {
    alert('Token inválido!');
    return;
  }

  if (validation.accountExists) {
    // Conta já existe - pedir signin
    console.log('Conta já existe para este email');
    signInWithEmail(validation.motherEmail);
    return;
  }

  // Passo 2: Coletar dados da mãe
  const motherData = {
    email: validation.motherEmail,
    name: prompt('Seu nome completo:') || validation.babyName + ' (mãe)',
    password: prompt('Crie uma senha:')
  };

  if (!motherData.password) {
    alert('Senha é obrigatória');
    return;
  }

  console.log('Criando conta...');
  const signUpResponse = await fetch('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(motherData)
  });

  if (!signUpResponse.ok) {
    alert('Erro ao criar conta');
    return;
  }

  const signUpData = await signUpResponse.json();
  const sessionToken = signUpData.session?.token;

  console.log('Associando mãe ao bebê...');

  // Passo 3: Associar mãe ao bebê
  const initResponse = await fetch('/api/init/mother', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ token })
  });

  if (!initResponse.ok) {
    alert('Erro ao associar ao bebê');
    return;
  }

  const babyData = await initResponse.json();

  // Sucesso!
  console.log('Mãe registrada com sucesso!');
  console.log('Bebê:', babyData.name);
  console.log('Consultora:', babyData.consultantName || 'Não atribuída');

  // Armazenar sessão
  localStorage.setItem('sessionToken', sessionToken);
  localStorage.setItem('userId', signUpData.user.id);

  // Redirecionar para dashboard
  window.location.href = '/dashboard';
}
```

---

## 3️⃣ Signin para Mãe Existente

```javascript
// Frontend - Signin com email/senha
async function signInWithEmail(email, password) {
  try {
    const response = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Email ou senha incorretos');
      return null;
    }

    // Armazenar sessão
    localStorage.setItem('sessionToken', data.session.token);
    localStorage.setItem('userId', data.user.id);

    return data;
  } catch (error) {
    console.error('Erro ao fazer signin:', error);
    return null;
  }
}
```

---

## 4️⃣ Upload de Foto de Perfil

```javascript
// Frontend - Upload de foto
async function uploadProfilePhoto(file) {
  const sessionToken = localStorage.getItem('sessionToken');

  if (!sessionToken) {
    alert('Você não está autenticado');
    return null;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload/profile-photo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Erro ao enviar foto: ${error.error}`);
      return null;
    }

    const data = await response.json();
    console.log('Foto enviada com sucesso!');
    console.log('URL:', data.url);

    return data;
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    alert('Erro ao enviar foto');
    return null;
  }
}

// Usar:
const fileInput = document.getElementById('photoInput');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Por favor, selecione uma imagem');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Arquivo muito grande (máximo 5MB)');
    return;
  }

  const result = await uploadProfilePhoto(file);
  if (result) {
    // Mostrar foto em preview
    document.getElementById('photoPreview').src = result.url;
  }
});
```

---

## 5️⃣ Fluxo Alternativo: Sign-in com Token

```javascript
// Frontend - Signin direto com token
async function signInWithToken(token) {
  try {
    const response = await fetch('/api/auth/sign-in/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 400) {
        // Conta não existe
        alert('Conta não criada para este email. Faça signup primeiro.');
        return {
          needsSignUp: true,
          motherEmail: data.motherEmail,
          babyId: data.babyId
        };
      }
      alert('Token inválido');
      return null;
    }

    // Token validado, mostrar informações
    console.log('Bebê:', data.baby);
    console.log('Mãe:', data.mother);

    alert(`Token validado! Faça login com ${data.mother.email}`);

    // Usuário deve fazer signin com email/senha
    return {
      needsSignIn: true,
      email: data.mother.email,
      baby: data.baby,
      mother: data.mother
    };
  } catch (error) {
    console.error('Erro:', error);
    return null;
  }
}
```

---

## 6️⃣ Componente React (Exemplo)

```jsx
// React Component - Form de Signup com Token
import { useState } from 'react';

export function SignUpWithTokenForm() {
  const [token, setToken] = useState('');
  const [step, setStep] = useState('token'); // token, signup, loading
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleValidateToken = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Token inválido');
        return;
      }

      setValidation(data);

      if (data.accountExists) {
        // Pedir signin
        alert('Conta já existe! Faça login com seu email.');
        window.location.href = '/signin';
      } else {
        // Pedir signup
        setStep('signup');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const name = formData.get('name');
    const password = formData.get('password');

    try {
      // Signup
      const signUpRes = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validation.motherEmail,
          name,
          password
        })
      });

      const signUpData = await signUpRes.json();

      // Init mother
      const initRes = await fetch('/api/init/mother', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signUpData.session.token}`
        },
        body: JSON.stringify({ token })
      });

      if (!initRes.ok) {
        alert('Erro ao associar ao bebê');
        return;
      }

      // Sucesso
      localStorage.setItem('sessionToken', signUpData.session.token);
      window.location.href = '/dashboard';
    } finally {
      setLoading(false);
    }
  };

  if (step === 'token') {
    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        handleValidateToken();
      }}>
        <h2>Registrar como Mãe</h2>
        <input
          type="text"
          placeholder="Cole o token do bebê"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Validando...' : 'Continuar'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUp}>
      <h2>Criar Conta - {validation?.babyName}</h2>
      <p>Email: {validation?.motherEmail}</p>

      <input
        name="name"
        type="text"
        placeholder="Seu nome completo"
        required
      />

      <input
        name="password"
        type="password"
        placeholder="Crie uma senha"
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Criando conta...' : 'Criar Conta'}
      </button>
    </form>
  );
}
```

---

## 7️⃣ Componente React - Upload de Foto

```jsx
import { useState } from 'react';

export function PhotoUploadForm() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande (máximo 5MB)');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result);
    };
    reader.readAsDataURL(file);

    // Upload
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/profile-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Erro: ${data.error}`);
        setPreview(null);
        return;
      }

      alert('Foto salva com sucesso!');
      console.log('Foto URL:', data.url);
    } catch (error) {
      alert('Erro ao enviar foto');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Foto de Perfil</h2>
      {preview && (
        <img src={preview} alt="Preview" style={{ maxWidth: '200px' }} />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={loading}
      />
      {loading && <p>Enviando...</p>}
    </div>
  );
}
```

---

## 8️⃣ Tratamento de Erros

```javascript
// Helper function para tratamento de erros
function getErrorMessage(status, errorData) {
  const messages = {
    400: 'Dados inválidos',
    401: 'Não autenticado',
    404: 'Recurso não encontrado',
    409: 'Conflito (ex: conta já existe)',
    413: 'Arquivo muito grande',
    500: 'Erro no servidor'
  };

  return errorData?.error || messages[status] || 'Erro desconhecido';
}

// Usar:
const response = await fetch('/api/auth/validate-token', {...});
const data = await response.json();

if (!response.ok) {
  const message = getErrorMessage(response.status, data);
  alert(`Erro: ${message}`);
}
```

---

## 🧪 Testes com cURL

```bash
# 1. Validar token
curl -X POST http://localhost:3000/api/auth/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"seu-token"}'

# 2. Sign-in com token
curl -X POST http://localhost:3000/api/auth/sign-in/token \
  -H "Content-Type: application/json" \
  -d '{"token":"seu-token"}'

# 3. Sign-up com email
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"mae@exemplo.com","password":"senha123","name":"Ana"}'

# 4. Init mother (associar ao bebê)
curl -X POST http://localhost:3000/api/init/mother \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-session-token" \
  -d '{"token":"seu-token-de-bebe"}'

# 5. Upload de foto
curl -X POST http://localhost:3000/api/upload/profile-photo \
  -H "Authorization: Bearer seu-session-token" \
  -F "file=@/caminho/para/foto.jpg"
```

---

## ✅ Checklist de Implementação

- [ ] Implementar validateBabyToken()
- [ ] Implementar signUpMotherWithToken()
- [ ] Implementar signInWithEmail()
- [ ] Implementar uploadProfilePhoto()
- [ ] Criar form de token
- [ ] Criar form de signup
- [ ] Criar form de upload
- [ ] Testar fluxo completo
- [ ] Testar upload com diferentes arquivos
- [ ] Adicionar validação no frontend
- [ ] Adicionar tratamento de erros
- [ ] Testar em produção

---

Pronto para integrar! Esses exemplos cobrem todos os casos de uso principais.
