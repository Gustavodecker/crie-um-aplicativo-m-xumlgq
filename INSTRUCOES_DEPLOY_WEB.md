
# 🚀 Instruções de Deploy Web - Passo a Passo

## 📋 Índice

1. [Acesso Imediato (Natively)](#acesso-imediato)
2. [Deploy com Domínio Próprio (Vercel)](#deploy-vercel)
3. [Deploy Alternativo (Netlify)](#deploy-netlify)
4. [Configuração de Domínio](#configuracao-dominio)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Acesso Imediato (Natively) {#acesso-imediato}

### ✅ Seu app JÁ ESTÁ ONLINE!

**Não precisa fazer nada. O app já está funcionando na web.**

### Como Acessar:

1. **Abra o painel do Natively**
   - Acesse: https://app.natively.ai
   - Faça login com sua conta

2. **Encontre seu projeto**
   - Clique em "Projects" ou "Meus Projetos"
   - Selecione "Consultoria de Sono Infantil"

3. **Copie o link web**
   - No topo da página, você verá um link como:
   ```
   https://app.natively.ai/preview/abc123xyz
   ```
   - Copie este link

4. **Teste o acesso**
   - Cole o link em um navegador
   - Faça login com suas credenciais
   - Pronto! O app está funcionando

### Compartilhando com Clientes:

```
Olá! Você pode acessar o app pelo navegador:

🔗 [COLE SEU LINK AQUI]

Use o mesmo login e senha do aplicativo.
```

---

## 🌐 Deploy com Domínio Próprio (Vercel) {#deploy-vercel}

Se você quer um domínio personalizado (ex: `consultoriasono.com.br`):

### Passo 1: Criar Conta na Vercel

1. Acesse: https://vercel.com
2. Clique em "Sign Up"
3. Escolha uma opção:
   - Login com GitHub (recomendado)
   - Login com GitLab
   - Login com Email

### Passo 2: Preparar o Projeto

O Natively já preparou tudo para você. Seu projeto está configurado com:

```json
{
  "web": {
    "bundler": "metro",
    "output": "static"
  }
}
```

### Passo 3: Fazer Deploy

**Opção A - Via Interface Web:**

1. No painel da Vercel, clique em "New Project"
2. Clique em "Import Git Repository"
3. Conecte seu repositório (se estiver no GitHub)
4. Configure:
   - Framework Preset: `Other`
   - Build Command: `npm run build:web`
   - Output Directory: `dist`
5. Clique em "Deploy"

**Opção B - Via Natively (Mais Fácil):**

1. No painel do Natively, vá em "Deploy"
2. Selecione "Vercel"
3. Clique em "Deploy to Vercel"
4. Autorize a conexão
5. Pronto! Deploy automático

### Passo 4: Configurar Domínio

1. Na Vercel, vá em "Settings" > "Domains"
2. Clique em "Add Domain"
3. Digite seu domínio (ex: `consultoriasono.com.br`)
4. Siga as instruções para configurar DNS

**Configuração DNS (no seu provedor de domínio):**

```
Tipo: A
Nome: @
Valor: 76.76.21.21

Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

### Resultado:

- ✅ Seu app estará em: `https://consultoriasono.com.br`
- ✅ HTTPS automático (SSL grátis)
- ✅ CDN global (rápido no mundo todo)
- ✅ Deploy automático a cada atualização

---

## 🔷 Deploy Alternativo (Netlify) {#deploy-netlify}

Alternativa à Vercel, também gratuita e fácil:

### Passo 1: Criar Conta

1. Acesse: https://netlify.com
2. Clique em "Sign Up"
3. Faça login com GitHub, GitLab ou Email

### Passo 2: Deploy

**Opção A - Drag & Drop:**

1. No painel do Netlify, vá em "Sites"
2. Arraste a pasta `dist` (após build) para a área de upload
3. Pronto! Site no ar

**Opção B - Git Integration:**

1. Clique em "New site from Git"
2. Conecte seu repositório
3. Configure:
   - Build command: `npm run build:web`
   - Publish directory: `dist`
4. Clique em "Deploy site"

### Passo 3: Domínio Personalizado

1. Vá em "Domain settings"
2. Clique em "Add custom domain"
3. Digite seu domínio
4. Configure DNS conforme instruções

---

## 🌍 Configuração de Domínio {#configuracao-dominio}

### Onde Comprar Domínio:

**Brasil:**
- Registro.br (domínios .br)
- HostGator
- Locaweb
- UOL Host

**Internacional:**
- Namecheap
- GoDaddy
- Google Domains

### Preços Médios:

- `.com.br`: R$ 40/ano
- `.com`: R$ 60/ano
- `.app`: R$ 80/ano

### Configuração DNS:

Após comprar o domínio, configure os DNS:

**Para Vercel:**
```
A Record: @ → 76.76.21.21
CNAME: www → cname.vercel-dns.com
```

**Para Netlify:**
```
A Record: @ → 75.2.60.5
CNAME: www → [seu-site].netlify.app
```

**Tempo de Propagação:** 24-48 horas (geralmente 1-2 horas)

---

## 🔧 Troubleshooting {#troubleshooting}

### Problema: Link do Natively não funciona

**Solução:**
1. Verifique se você está logado no Natively
2. Confirme que o projeto está ativo
3. Tente abrir em modo anônimo do navegador
4. Limpe o cache do navegador

### Problema: Deploy na Vercel falha

**Solução:**
1. Verifique se o comando de build está correto
2. Confirme que a pasta `dist` existe após o build
3. Veja os logs de erro no painel da Vercel
4. Entre em contato com o suporte do Natively

### Problema: Domínio não funciona

**Solução:**
1. Aguarde 24-48h para propagação DNS
2. Verifique se os registros DNS estão corretos
3. Use https://dnschecker.org para verificar propagação
4. Confirme que o SSL está ativo (pode levar algumas horas)

### Problema: App carrega mas não funciona

**Solução:**
1. Verifique se o backend está online
2. Confirme que a URL do backend está correta em `app.json`
3. Abra o console do navegador (F12) para ver erros
4. Teste o login - pode ser problema de autenticação

### Problema: Upload de arquivos não funciona na web

**Solução:**
1. Verifique se o backend aceita uploads via web
2. Confirme que o CORS está configurado corretamente
3. Teste com arquivos menores (< 5MB)
4. Veja os logs do backend para erros

---

## 📊 Checklist de Deploy

Antes de compartilhar o link com clientes:

- [ ] Testei o login
- [ ] Testei cadastro de bebê
- [ ] Testei preenchimento de rotina
- [ ] Testei upload de fotos
- [ ] Testei upload de PDF
- [ ] Testei relatórios
- [ ] Testei em Chrome
- [ ] Testei em Safari
- [ ] Testei em mobile (navegador)
- [ ] Testei em tablet
- [ ] Verifiquei que o HTTPS está ativo
- [ ] Confirmei que os dados sincronizam com o app mobile

---

## 🎉 Pronto!

Seu app está configurado e pronto para acesso web!

**Opções disponíveis:**

1. ✅ **Acesso imediato**: Link do Natively (já funciona)
2. 🚀 **Domínio próprio**: Deploy na Vercel/Netlify
3. 📱 **Apps mobile**: Publicação nas lojas (próximo passo)

**Próximos passos:**

1. Copie o link do Natively
2. Teste todas as funcionalidades
3. Compartilhe com suas clientes
4. (Opcional) Configure domínio próprio

---

## 🆘 Precisa de Ajuda?

- **Documentação Natively**: https://docs.natively.ai
- **Suporte Vercel**: https://vercel.com/support
- **Suporte Netlify**: https://www.netlify.com/support
- **Comunidade**: Discord/Slack do Natively

---

*Última atualização: Março 2025*
