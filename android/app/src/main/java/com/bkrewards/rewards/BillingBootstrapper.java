package com.bkrewards.rewards;

import android.app.Application;
import android.util.Log;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;

/**
 * Bootstrap minimal de Google Play Billing.
 *
 * Objectif : s'assurer que la librairie de facturation est bien présente et initialisable
 * (détection Play Console + base technique), sans déclencher d'achat automatiquement.
 */
public final class BillingBootstrapper {
    private static final String TAG = "Billing";
    private static BillingClient client;

    private BillingBootstrapper() {}

    public static void init(Application application) {
        if (client != null) return;
        try {
            PendingPurchasesParams params = PendingPurchasesParams.newBuilder().enableOneTimeProducts().build();
            client = BillingClient.newBuilder(application)
                    .setListener((billingResult, purchases) -> {
                        // Aucun flux automatique ici (rewarded-only ads + achats à la demande).
                    })
                    .enablePendingPurchases(params)
                    .build();

            client.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult billingResult) {
                    Log.d(TAG, "setup finished: " + billingResult.getResponseCode());
                    // On peut laisser la connexion ouverte; pas de requêtes automatiques.
                }

                @Override
                public void onBillingServiceDisconnected() {
                    Log.d(TAG, "service disconnected");
                }
            });
        } catch (Throwable t) {
            Log.w(TAG, "init failed", t);
        }
    }
}

