Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

# iOS e deploy

Destino: a FinApp é feita para app de loja em iOS e Android. Por agora só se entrega iOS; o Android entra depois (não há `@capacitor/android` nem pasta `android/` hoje). O que for só de iOS fica isolado e comentado.

## PWA (`vite.config.ts`, `vite-plugin-pwa`)

- `registerType: "autoUpdate"`; manifest próprio em `public/manifest.json` (`manifest: false` no plugin): nome FinApp, `pt-PT`, `standalone`, ícones v4, 3 capturas de ecrã.
- Precache `js,css,html,svg,woff2,json`, sem o PDF.js (`pdf-*.js`, `pdf.worker*`), que entra em `CacheFirst` (cache `pdfjs`) na primeira importação de PDF. Leituras do RTDB (`*.firebasedatabase.app`, GET) em `NetworkFirst`, 4 s, 7 dias; só protege o fallback de long-polling.
- `build.rollupOptions.output.keepNames: true`, para o `componentStack` do ErrorBoundary ser legível.

## iOS (Capacitor 8)

- `capacitor.config.ts`: `appId` `com.gabriel98pt.finapp`, `appName` `FinApp`, `webDir` `dist`. Projeto nativo em `ios/App` (`App.xcodeproj`, `CapApp-SPM`; Swift Package Manager). Alvo mínimo iOS 15.0.
- `ios/DerivedData/`, `ios/App/App/public` e `ios/capacitor-cordova-ios-plugins` são gerados e estão no `.gitignore`. O ESLint ignora `ios`.
- **`npx cap run ios` não funciona nesta máquina**: o Xcode instalado não tem `Simulator.app` em `Contents/Developer/Applications`. Usar `xcodebuild` e `simctl`/`devicectl`.
- Antes de compilar, ver o disco: `df -h /System/Volumes/Data` (enche com facilidade).

### Passos (simulador)

1. `npm run build`
2. `npx cap sync ios`
3. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination id=<UDID> -derivedDataPath ios/DerivedData/<UDID>` (nome do scheme `App`: confirmar)
4. `xcrun simctl install <UDID> <caminho do App.app em ios/DerivedData/<UDID>/Build/Products/…>` e `xcrun simctl launch <UDID> com.gabriel98pt.finapp`. A memória de trabalho antiga cita `com.finapp.app`; o `project.pbxproj` e o `capacitor.config.ts` dizem `com.gabriel98pt.finapp`: confirmar.

### Passos (iPhone físico)

1. `npm run build` e `npx cap sync ios`.
2. `xcrun devicectl list devices`: o estado pronto é «available (paired)»; «unavailable» é cabo ou bloqueio (religar e desbloquear).
3. `xcodebuild` com `-destination id=<UDID> -allowProvisioningUpdates` (equipa `<TEAM_ID>` no `project.pbxproj`). Dá para compilar antes com `-destination 'generic/platform=iOS'` (mesma pasta DerivedData) e só instalar quando o iPhone aparecer.
4. `xcrun devicectl device install app --device <UDID> <caminho do App.app>`.

**Conta gratuita da Apple:** a app instalada expira ao fim de 7 dias; repetir a instalação.
Cada entrega termina com a app atualizada no iPhone (regra do `CLAUDE.md`).

## Vercel

- `vercel.json` só tem cabeçalhos: CSP em modo `Report-Only` (`default-src 'self'`, ligações a `*.firebasedatabase.app` e aos domínios de login da Google), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` sem câmara, microfone e localização. Não há `rewrites` nem `redirects`.
- Projeto ligado em `.vercel/` (ignorado pelo git). A pasta `api/` é reconhecida sozinha: `api/copiloto-ia.ts` é a função do Copiloto de IA.
- Variáveis de ambiente da função, **só no painel da Vercel**, nunca no repositório: `GEMINI_API_KEY` (obrigatória) e `GEMINI_MODEL` (opcional; sem ela usa `gemini-2.0-flash`). A função exige um ID token do Firebase em `Authorization: Bearer`.
- Deploy automático por git: confirmar a ligação ao repositório e o ramo de produção no painel.

## Firebase

- Projeto `finapp1-20d00` (`.firebaserc`). `firebase.json`: regras da Realtime Database em `database.rules.json` (só o dono lê e escreve) e Auth por e-mail e senha.
- Dados em `users/{uid}/fin_v5/...`. A config do cliente em `src/services/firebase.ts` é pública por design; a segurança está nas regras.
- `.env*` e `*.local` estão no `.gitignore`.
