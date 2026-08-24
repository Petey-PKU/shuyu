import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gradlePath = resolve('android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');

const signingVariables = `def shuyuReleaseStoreFile = System.getenv("SHUYU_ANDROID_KEYSTORE_FILE")
def shuyuReleaseStorePassword = System.getenv("SHUYU_ANDROID_KEYSTORE_PASSWORD")
def shuyuReleaseKeyAlias = System.getenv("SHUYU_ANDROID_KEY_ALIAS")
def shuyuReleaseKeyPassword = System.getenv("SHUYU_ANDROID_KEY_PASSWORD")
def shuyuHasReleaseSigning = shuyuReleaseStoreFile && shuyuReleaseStorePassword && shuyuReleaseKeyAlias && shuyuReleaseKeyPassword

`;

const debugSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const configurableSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (shuyuHasReleaseSigning) {
            release {
                storeFile file(shuyuReleaseStoreFile)
                storePassword shuyuReleaseStorePassword
                keyAlias shuyuReleaseKeyAlias
                keyPassword shuyuReleaseKeyPassword
            }
        }
    }`;

const templateReleaseSigning = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

if (!gradle.includes('def shuyuHasReleaseSigning')) {
  if (!gradle.includes('android {')) throw new Error('Android Gradle template marker not found.');
  gradle = gradle.replace('android {', `${signingVariables}android {`);
}

if (gradle.includes(debugSigning)) {
  gradle = gradle.replace(debugSigning, configurableSigning);
} else if (!gradle.includes('if (shuyuHasReleaseSigning)')) {
  throw new Error('Android signingConfigs template changed; refusing an unsafe build.');
}

if (gradle.includes(templateReleaseSigning)) {
  gradle = gradle.replace(
    templateReleaseSigning,
    '            signingConfig shuyuHasReleaseSigning ? signingConfigs.release : signingConfigs.debug',
  );
} else if (!gradle.includes('signingConfig shuyuHasReleaseSigning')) {
  throw new Error('Android release signing template changed; refusing an unsafe build.');
}

writeFileSync(gradlePath, gradle);
console.log(`Android signing configured: ${process.env.SHUYU_ANDROID_KEYSTORE_FILE ? 'release keystore' : 'test key'}`);
