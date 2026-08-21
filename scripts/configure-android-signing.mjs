import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gradlePath = resolve('android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');

const signingVariables = `def shuzhongyuReleaseStoreFile = System.getenv("SHUZHONGYU_ANDROID_KEYSTORE_FILE")
def shuzhongyuReleaseStorePassword = System.getenv("SHUZHONGYU_ANDROID_KEYSTORE_PASSWORD")
def shuzhongyuReleaseKeyAlias = System.getenv("SHUZHONGYU_ANDROID_KEY_ALIAS")
def shuzhongyuReleaseKeyPassword = System.getenv("SHUZHONGYU_ANDROID_KEY_PASSWORD")
def shuzhongyuHasReleaseSigning = shuzhongyuReleaseStoreFile && shuzhongyuReleaseStorePassword && shuzhongyuReleaseKeyAlias && shuzhongyuReleaseKeyPassword

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
        if (shuzhongyuHasReleaseSigning) {
            release {
                storeFile file(shuzhongyuReleaseStoreFile)
                storePassword shuzhongyuReleaseStorePassword
                keyAlias shuzhongyuReleaseKeyAlias
                keyPassword shuzhongyuReleaseKeyPassword
            }
        }
    }`;

const templateReleaseSigning = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

if (!gradle.includes('def shuzhongyuHasReleaseSigning')) {
  if (!gradle.includes('android {')) throw new Error('Android Gradle template marker not found.');
  gradle = gradle.replace('android {', `${signingVariables}android {`);
}

if (gradle.includes(debugSigning)) {
  gradle = gradle.replace(debugSigning, configurableSigning);
} else if (!gradle.includes('if (shuzhongyuHasReleaseSigning)')) {
  throw new Error('Android signingConfigs template changed; refusing an unsafe build.');
}

if (gradle.includes(templateReleaseSigning)) {
  gradle = gradle.replace(
    templateReleaseSigning,
    '            signingConfig shuzhongyuHasReleaseSigning ? signingConfigs.release : signingConfigs.debug',
  );
} else if (!gradle.includes('signingConfig shuzhongyuHasReleaseSigning')) {
  throw new Error('Android release signing template changed; refusing an unsafe build.');
}

writeFileSync(gradlePath, gradle);
console.log(`Android signing configured: ${process.env.SHUZHONGYU_ANDROID_KEYSTORE_FILE ? 'release keystore' : 'test key'}`);
