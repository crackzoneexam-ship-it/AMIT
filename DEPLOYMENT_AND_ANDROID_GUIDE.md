# X Ludo — Deployment, Firebase & Android APK Guide

## 1. Architecture Overview
- **Frontend**: React 19 + TypeScript + Tailwind CSS (mobile-first portrait layout)
- **Backend**: Node.js + Express + `ws` WebSocket server (`server.ts`) on port `3000`
- **Game Engine**: Shared deterministic Indian Classic Ludo rules (`src/shared/ludoEngine.ts`) and 3-tier AI (`src/shared/ludoAI.ts`)
- **Persistence**: Server-authoritative store (`data/xludo-store.json`) with verified match history and rankings, plus optional Firebase blueprint (`firebase-blueprint.json`) and hardened security rules (`firestore.rules`).

---

## 2. Firebase & Google Sign-In Setup (Optional Cloud Upgrade)
Firebase setup was declined during initial generation, so the app runs on its live Node.js WebSocket backend + Guest authentication (`XLD-...`) without faking Google login. To enable Google Sign-In & Cloud Firestore:

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** -> **Sign-in method** -> enable **Google** and **Anonymous**.
3. Create a **Cloud Firestore** database and deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
4. Add `firebase-applet-config.json` in the project root with your Web App config (`apiKey`, `authDomain`, `projectId`, `appId`, `firestoreDatabaseId`).
5. Wire `linkWithPopup(auth.currentUser, new GoogleAuthProvider())` on the client so guest accounts upgrade cleanly to Google without losing match history.

---

## 3. Android Capacitor Packaging (`com.xludo.game`)
The repository includes `capacitor.config.ts` and hardware back-button handling in `src/utils/capacitorBridge.ts`.

### A. Initialize Android Project
```bash
npm install -D @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
```

### B. AndroidManifest.xml Requirements
Inside `android/app/src/main/AndroidManifest.xml`, verify:
1. Internet permission:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   ```
2. Portrait orientation lock on `<activity android:name=".MainActivity" ...>`:
   ```xml
   android:screenOrientation="portrait"
   ```

### C. App Icon & Splash Screen
Generate Android launcher icons and splash screens using `@capacitor/assets` from `src/assets/images/xludo_app_icon_1794902708319.jpg`:
```bash
npx @capacitor/assets generate --android
npx cap sync android
```

### D. Connecting Android App to Your Live Multiplayer Backend
When running inside a native Android APK (`capacitor://localhost`), set `server.url` in `capacitor.config.ts` to your deployed HTTPS backend URL (or proxy API/WebSocket calls to your hosted Node.js server URL).

---

## 4. Building Debug & Signed Release APK

### Debug APK (for device testing)
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Signed Release APK (Google Play / Distribution)
1. Generate a release keystore (keep it private, never commit it):
   ```bash
   keytool -genkey -v -keystore xludo-release.keystore -alias xludo -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure signing in `android/app/build.gradle`:
   ```groovy
   android {
     signingConfigs {
       release {
         storeFile file("../../xludo-release.keystore")
         storePassword System.getenv("KEYSTORE_PASS")
         keyAlias "xludo"
         keyPassword System.getenv("KEY_PASS")
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
         minifyEnabled true
         proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
       }
     }
   }
   ```
3. Build the signed release APK (or `.aab` bundle for Play Store):
   ```bash
   cd android
   ./gradlew assembleRelease
   # Output: android/app/build/outputs/apk/release/app-release.apk
   ```
