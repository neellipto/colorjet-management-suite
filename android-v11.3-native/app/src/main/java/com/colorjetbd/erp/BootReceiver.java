package com.colorjetbd.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        boolean active = context.getSharedPreferences(BackgroundLocationService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(BackgroundLocationService.KEY_ACTIVE, false);
        if (active) BackgroundLocationService.start(context, null);
    }
}
