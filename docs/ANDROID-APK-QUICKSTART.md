# Try the PROS Android preview on a Mac

You need Android Studio and `PROS-preview.apk`. The virtual phone runs the app on your Mac. This preview supports the sample and local profiles. Live sign-in and cross-device sync are planned for a separate build.

## 1. Start the virtual phone

Open Android Studio. From the welcome screen, choose **More Actions → Virtual Device Manager**. If a project is open, choose **View → Tool Windows → Device Manager**. Click the play button next to **Medium Phone API 37.0** and wait for its home screen. If the list is empty, create a phone and choose an ARM64 Android system image on Apple silicon. [Android Device Manager guide](https://developer.android.com/studio/run/managing-avds)

If it sits on the Google logo for several minutes, stop the virtual phone and use **Cold Boot Now** from its Device Manager menu. If that stalls too, try **Software** graphics in the virtual device settings. [Android Emulator graphics settings](https://developer.android.com/studio/run/emulator-acceleration)

## 2. Install the APK

In Finder, open the folder containing `PROS-preview.apk` and drag the file onto the running phone screen. When the installer finishes, swipe up on the virtual home screen and tap **PROS Preview**. [Android Emulator APK install guide](https://developer.android.com/studio/run/emulator-install-add-files)

## 3. Run a quick check

- Choose **Explore a sample world** to look around. Select **Create your world** in the sample banner, then choose **Begin your journey** and finish setting up a local profile.
- From **Today**, choose **Log activity** and save time against one of your starting skills. Check the save result and make sure the skill's XP has increased in **Skills**.
- Close **PROS Preview** from the phone's recent apps screen, reopen it, and confirm the activity is still there.
- Turn on **Airplane mode** from the virtual phone's quick settings. Turn off Wi-Fi as well if it stays on. Log another activity, reopen the app, and confirm the second save is still there. Turn airplane mode off when finished.

For build instructions, see the [native setup guide](NATIVE-MOBILE.md).
