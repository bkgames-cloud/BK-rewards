# =============================================================================
# R8 / ProGuard — BK Rewards (Capacitor + WebView + Billing + Cordova IAP)
# =============================================================================

# Traces utiles en production (Play Console / crash reports)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor / plugins (réflexion, Bridge) ---
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    <methods>;
}

# --- Cordova (cordova-plugin-purchase, etc.) ---
-keep class org.apache.cordova.** { *; }
-keep class cc.fovea.** { *; }
-dontwarn org.apache.cordova.**

# --- Google Play Billing ---
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# --- WebView / JS interfaces ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- AndroidX / Splash ---
-keep class androidx.** { *; }
-dontwarn androidx.**

# --- Gson / réflexion (dépendances transitives) ---
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# --- AdMob (transitif) : évite warnings ; classes conservées par le SDK consumer ---
-dontwarn com.google.android.gms.ads.**
-keep class com.google.ads.** { *; }
-keep class com.google.android.gms.** { *; }

# --- OkHttp / Conscrypt (souvent tirés par les SDK Google) ---
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
