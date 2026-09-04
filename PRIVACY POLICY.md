# Privacy Policy — IRON WOD

**Last updated: 4 September 2026**

This file mirrors the version hosted at [wsx79.github.io/iron-wod-cast/privacy.html](https://wsx79.github.io/iron-wod-cast/privacy.html), which is the canonical, linked-to copy.

IRON WOD (the **“App”**) is an Android workout timer, workout log and training-analysis application.

## 1. Data stored by IRON WOD

IRON WOD does not require an IRON WOD account and does not operate a developer-controlled cloud backend for users' workout data.

The App stores training and configuration data locally on the user's device, which may include:

- workout sessions, results and workout history;
- custom WODs and workout configuration;
- exercise catalogue data and user-created exercises;
- max lifts and performance records;
- athlete/profile information entered by the user;
- optional heart-rate data collected during a training session when a compatible Bluetooth heart-rate device is connected;
- Iron Coach, analytics, progress and training-related data derived from locally stored workout information;
- App settings such as language, measurement units, timer preferences, sound/voice options and equipment preferences.

IRON WOD does not sell this training data and does not upload it to an IRON WOD developer server.

## 2. Optional Google Drive backup

IRON WOD offers an optional cloud backup feature using the user's own Google account. When enabled by the user, the App uploads a single backup file (containing the same locally stored workout/training data described in Section 1) to a private, app-specific storage area of the user's Google Drive known as the **App Data Folder**.

The App Data Folder is not visible in the user's regular Google Drive file list and cannot be accessed by any other app or by the developer - only IRON WOD, running on a device where the user has signed in, can read or write that file. IRON WOD only requests the minimal Google Drive scope needed for this (`drive.appdata`) and never requests access to the user's other Drive files.

This backup is used solely to let the user restore their own data (e.g. after reinstalling the App or on a new device). The developer does not access, view or process the contents of this backup. Users can disable this feature and revoke IRON WOD's Google Drive access at any time from their Google Account settings.

## 3. Bluetooth and heart-rate devices

IRON WOD can optionally connect to compatible Bluetooth Low Energy (BLE) heart-rate devices.

When this feature is used, the App may access nearby-device/Bluetooth functionality in order to discover and communicate with the selected device. Heart-rate samples used by IRON WOD are processed as part of the training session and stored locally where the relevant workout/session feature saves them.

On older Android versions, Android may require location-related permission for Bluetooth device discovery even when IRON WOD is not using that permission to build a location history.

The heart-rate feature is optional and the App can be used without connecting a Bluetooth device.

## 4. Google Cast

IRON WOD includes optional Google Cast support so timers or workout information can be displayed on compatible Cast devices or televisions.

When Cast is used, Google Play services / the Google Cast SDK may process device, network and Cast-interaction information required to discover, connect to and communicate with Cast devices. Google states that the Cast SDK may also collect anonymized Cast interaction and app-usage information for improving the Cast experience.

IRON WOD uses a custom Cast web receiver to display the timer on a compatible TV or Cast device. The receiver is hosted publicly on GitHub Pages at:

**https://wsx79.github.io/iron-wod-cast/**

Related static assets used by the receiver, such as HTML, JavaScript, CSS and optional voice/audio resources, may be loaded from the same GitHub-hosted location.

When Cast is active, the receiver may download these public assets over the Internet. This is limited to resources needed to display and announce the timer. It is **not** used to upload the user's workout history to GitHub or to an IRON WOD developer server.

Users who do not want this network activity can simply avoid using the Cast feature.

## 5. Translation features

IRON WOD may use Google ML Kit on-device translation and language-identification technology for supported translation features, such as assisting with exercise text.

ML Kit translation uses language models downloaded to the device when required. Network access may therefore be used to download or update those models. Translation is performed using the ML Kit on-device translation functionality.

## 6. Google Play services

IRON WOD uses Google Play-related components for features such as Google Cast, Google Sign-In / Drive backup, and the optional Google Play in-app review flow. Those Google components may process technical information according to Google's own terms and privacy policies.

## 7. Permissions

Depending on the Android version and features used, IRON WOD may request or declare permissions including:

- **Internet / network state** — used by network-dependent components such as Google Cast, Google Drive backup, Google Play services and ML Kit model downloads;
- **Bluetooth / Nearby devices** — used for compatible BLE heart-rate devices and related device discovery;
- **Nearby Wi-Fi devices** — used where required by Android for nearby-device functionality such as Cast;
- **Location on older Android versions** — may be required by the Android Bluetooth scanning model on those versions;
- **Vibration** — used for timer feedback;
- **Wake lock** — used where necessary to support reliable timer/session behaviour while the device is active;
- **Notifications** — may be used by supported Android/system components where notification permission is required.

Permissions are used only for the associated App functionality.

## 8. Android backup and device transfer

Depending on the user's Android and Google backup settings, locally stored App data may be included in Android backup or device-transfer mechanisms. These services are controlled by the operating system and/or the user's Google/device settings, not by an IRON WOD developer server.

## 9. Data sharing and sale

IRON WOD does **not sell** users' personal or workout data.

The developer does not intentionally share users' locally stored workout history with advertisers or data brokers. Information may be processed by third-party platform/SDK providers only when required for the optional functionality described above, such as Google Cast, Google Drive backup, ML Kit model delivery or Google Play services.

## 10. Data control and deletion

Users can manage or delete workout/session data through the App where the relevant controls are available, including deleting their Google Drive backup by disabling the backup feature and removing IRON WOD's access from their Google Account.

Uninstalling IRON WOD removes the App's local data from the device, subject to copies that may remain in Android/Google/device backups controlled by the user or platform, including any Google Drive backup the user chose to create.

If the App provides backup/export functionality, exported copies remain under the user's control and must be deleted separately if no longer wanted.

## 11. Children's privacy

IRON WOD is a fitness and training application intended for general athletes and is not specifically directed to children under 13.

## 12. Security

IRON WOD is designed so that core workout information remains on the user's device, or in the user's own Google Drive App Data Folder when backup is enabled, rather than being stored in an IRON WOD developer-operated cloud account. No method of electronic storage or device security is completely risk-free, and users should protect their device, Google account and any exported backup files appropriately.

## 13. Changes to this Privacy Policy

This Privacy Policy may be updated when App functionality, third-party SDKs or legal requirements change. The current version will show its latest revision date at the top of this document.

## 14. Contact

**Developer:** Fabio Serra  
**Privacy contact:** ironwodapp@proton.me
