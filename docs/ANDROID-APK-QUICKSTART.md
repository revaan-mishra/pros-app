# Try the PROS Android app on a Mac

You need Android Studio and the signed `PROS-android.apk`. The virtual phone runs PROS on your Mac with the same accounts as the web app. [Download the APK and checksum](https://github.com/revaan-mishra/pros-app/releases/tag/v1.0.1)

## 1. Start the virtual phone

Open Android Studio. From the welcome screen, choose **More Actions → Virtual Device Manager**. If a project is open, choose **View → Tool Windows → Device Manager**. Click the play button next to **Medium Phone API 37.0** and wait for its home screen. If the list is empty, create a phone and choose an ARM64 Android system image on Apple silicon. [Android Device Manager guide](https://developer.android.com/studio/run/managing-avds)

If it sits on the Google logo for several minutes, stop the virtual phone and use **Cold Boot Now** from its Device Manager menu. If that stalls too, try **Software** graphics in the virtual device settings. [Android Emulator graphics settings](https://developer.android.com/studio/run/emulator-acceleration)

## 2. Install the APK

In Finder, open the folder containing `PROS-android.apk` and drag the file onto the running phone screen. When the installer finishes, swipe up on the virtual home screen and tap **PROS**. [Android Emulator APK install guide](https://developer.android.com/studio/run/emulator-install-add-files)

## 3. Run a quick check

- Choose **Explore a sample world** to look around. Select **Create your world** in the sample banner, then choose **Begin your journey**. Sign in or create and verify an account, then choose **Open my world**.
- From **Today**, choose **Log activity** and save time against one of your starting skills. Check the save result and make sure the skill's XP has increased in **Skills**.
- Close **PROS** from the phone's recent apps screen, reopen it, and confirm the activity is still there.
- After online setup, turn on **Airplane mode** from the virtual phone's quick settings. Log another activity, reopen the app, and confirm it is still there. Reconnect and check that the same activity appears when you sign in on the web.

For build instructions, see the [native setup guide](NATIVE-MOBILE.md).
